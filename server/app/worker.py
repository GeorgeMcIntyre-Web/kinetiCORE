"""
Celery worker tasks for FEA computation.
This module defines the async tasks that run in the background.
"""

import logging
from typing import Any, Dict

from celery import Task

from .core.celery_app import celery_app
from .core.metrics import metrics_store
from .models.fea import FeaJobRequest
from .solvers.mock_solver import solve_mock_beam

logger = logging.getLogger(__name__)


class FeaTask(Task):
    """Custom task class with progress tracking."""

    def update_progress(self, progress: float, message: str = "") -> None:
        """
        Update task progress.

        Args:
            progress: Progress percentage (0-100)
            message: Optional status message
        """
        self.update_state(
            state="STARTED",
            meta={
                "progress": progress,
                "message": message,
            },
        )


@celery_app.task(bind=True, base=FeaTask, name="app.worker.run_fea_analysis")
def run_fea_analysis(self: FeaTask, job_id: str, request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run FEA analysis task.

    This task is executed by Celery workers in the background.
    It processes the FEA job request and returns the result.

    Args:
        self: Task instance (injected by Celery when bind=True)
        job_id: Unique job identifier
        request_data: FEA job request dictionary

    Returns:
        Result dictionary matching FeaJobResult schema

    Raises:
        Exception: If solver fails
    """
    # Update status to running
    self.update_progress(0.0, "Starting FEA analysis")

    # Validate request using Pydantic
    try:
        validated_request = FeaJobRequest.model_validate(request_data)
        model_type = validated_request.meta.model_type
        logger.info(
            f"Worker task start: job_id={job_id} model_type={model_type} "
            f"task_id={self.request.id}"
        )
    except Exception as e:
        logger.error(f"Worker validation failed: job_id={job_id} error={str(e)}")
        metrics_store.increment_failed()
        raise ValueError(f"Invalid FEA job request: {str(e)}")

    # Add job_id to request data for solver
    request_data_with_id = {**request_data, "meta": {**request_data.get("meta", {}), "jobId": job_id}}

    # Determine model type
    model_type = validated_request.meta.model_type

    try:
        # Update progress
        self.update_progress(10.0, "Preparing solver input")

        # Route to appropriate solver
        if model_type in ["beam-demo", "shell-demo", "biw-proto"]:
            # For now, all model types use mock beam solver
            # TODO: Add real Gmsh + CalculiX integration for shell-demo and biw-proto
            logger.info(f"Worker routing solver: job_id={job_id} solver=mock model_type={model_type}")
            self.update_progress(20.0, "Running mock solver")
            result = solve_mock_beam(request_data_with_id)
        else:
            error_msg = f"Unsupported model type: {model_type}"
            logger.error(f"Worker model_type error: job_id={job_id} error={error_msg}")
            metrics_store.increment_failed()
            raise ValueError(error_msg)

        # Update progress
        self.update_progress(90.0, "Processing results")

        # Validate result
        if not result:
            logger.error(f"Worker empty result: job_id={job_id}")
            metrics_store.increment_failed()
            raise RuntimeError("Solver returned empty result")

        if result.get("status") == "error":
            error_msg = result.get("error", "Unknown solver error")
            logger.error(f"Worker solver error: job_id={job_id} error={error_msg}")
            metrics_store.increment_failed()
            # Return error result instead of raising exception
            # This allows the API to query the error via /result endpoint
            return result

        # Extract key metrics from result for logging
        max_disp = result.get("maxDisplacement", 0)
        max_stress = result.get("maxVonMises", 0)
        solve_time = result.get("meta", {}).get("solveTime", 0)

        # Complete
        self.update_progress(100.0, "Analysis complete")
        logger.info(
            f"Worker task complete: job_id={job_id} max_disp={max_disp:.6f}m "
            f"max_stress={max_stress/1e6:.2f}MPa solve_time={solve_time:.2f}s"
        )

        # Increment success metric
        metrics_store.increment_completed()

        return result

    except Exception as e:
        # Log error and increment failure metric
        error_msg = f"FEA analysis failed for job {job_id}: {str(e)}"
        logger.error(f"Worker task failed: job_id={job_id} error={str(e)}")
        metrics_store.increment_failed()
        raise RuntimeError(error_msg) from e
