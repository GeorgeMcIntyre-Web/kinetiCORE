"""
FastAPI application for FEA service.
Provides REST API endpoints for submitting and querying FEA jobs.
"""

import uuid
from datetime import datetime

from celery.result import AsyncResult
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .core.celery_app import celery_app
from .core.config import settings
from .models.fea import (
    FeaJobRequest,
    FeaJobResult,
    FeaJobStatus,
    FeaJobStatusType,
)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint.

    Returns:
        Simple status message
    """
    return {"status": "healthy", "service": settings.app_name}


@app.post("/fea/jobs", response_model=FeaJobStatus)
async def submit_fea_job(request: FeaJobRequest) -> FeaJobStatus:
    """
    Submit a new FEA job for processing.

    Args:
        request: FEA job request with materials, BCs, loads

    Returns:
        Job status with unique job_id

    Raises:
        HTTPException: If job submission fails
    """
    # Generate unique job ID
    job_id = str(uuid.uuid4())

    # Convert request to dict for Celery (JSON serializable)
    request_dict = request.model_dump(by_alias=True)

    # Submit task to Celery worker
    # Import task here to avoid circular imports
    from .worker import run_fea_analysis

    try:
        task = run_fea_analysis.apply_async(
            args=[job_id, request_dict],
            task_id=job_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit job to worker: {str(e)}",
        )

    # Return initial status
    return FeaJobStatus(
        job_id=job_id,
        status=FeaJobStatusType.QUEUED,
        message="Job queued for processing",
        updated_at=datetime.utcnow().isoformat(),
    )


@app.get("/fea/jobs/{job_id}", response_model=FeaJobStatus)
async def get_fea_job_status(job_id: str) -> FeaJobStatus:
    """
    Get current status of an FEA job.

    Args:
        job_id: Unique job identifier

    Returns:
        Current job status

    Raises:
        HTTPException: If job not found
    """
    # Query Celery for task status
    task_result = AsyncResult(job_id, app=celery_app)

    if not task_result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Map Celery state to our status enum
    # See: https://docs.celeryq.dev/en/stable/reference/celery.states.html
    state = task_result.state

    if state in ("PENDING", "RECEIVED"):
        status = FeaJobStatusType.QUEUED
        message = "Job is queued"
    elif state in ("STARTED", "RETRY"):
        status = FeaJobStatusType.RUNNING
        message = "Job is running"
    elif state == "SUCCESS":
        status = FeaJobStatusType.COMPLETED
        message = "Job completed successfully"
    elif state == "FAILURE":
        status = FeaJobStatusType.ERROR
        message = f"Job failed: {str(task_result.info)}"
    else:
        # Any other state (REVOKED, REJECTED, etc.) treated as error
        status = FeaJobStatusType.ERROR
        message = f"Job state: {state}"

    # Extract progress if available
    progress = None
    if state == "STARTED" and isinstance(task_result.info, dict):
        progress = task_result.info.get("progress")

    return FeaJobStatus(
        job_id=job_id,
        status=status,
        progress=progress,
        message=message,
        updated_at=datetime.utcnow().isoformat(),
    )


@app.get("/fea/jobs/{job_id}/result", response_model=FeaJobResult)
async def get_fea_job_result(job_id: str) -> FeaJobResult:
    """
    Get result of a completed FEA job.

    Args:
        job_id: Unique job identifier

    Returns:
        Job result with displacements and stresses

    Raises:
        HTTPException: If job not found, not completed, or failed
    """
    # Query Celery for task result
    task_result = AsyncResult(job_id, app=celery_app)

    if not task_result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    state = task_result.state

    # Check if job is complete
    if state == "PENDING" or state == "STARTED":
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} result not ready yet (status: {state})",
        )

    # Check if job failed
    if state == "FAILURE":
        error_msg = str(task_result.info) if task_result.info else "Unknown error"
        return FeaJobResult(
            job_id=job_id,
            status="error",
            error=error_msg,
        )

    # Job succeeded - return result
    if state != "SUCCESS":
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected job state: {state}",
        )

    result_dict = task_result.result

    if not result_dict:
        raise HTTPException(
            status_code=500,
            detail="Job completed but no result data available",
        )

    # Parse result dict into Pydantic model
    try:
        return FeaJobResult(**result_dict)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse result data: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
