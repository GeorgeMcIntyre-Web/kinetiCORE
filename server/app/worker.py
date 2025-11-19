"""
Celery worker tasks for FEA computation.
This module defines the async tasks that run in the background.
"""

from typing import Any, Dict

from celery import Task

from .core.celery_app import celery_app
from .solvers.mock_solver import solve_mock_beam


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

    # Add job_id to request data for solver
    request_data_with_id = {**request_data, "meta": {**request_data.get("meta", {}), "jobId": job_id}}

    # Determine model type
    model_type = request_data.get("meta", {}).get("modelType", "beam-demo")

    try:
        # Update progress
        self.update_progress(10.0, "Preparing solver input")

        # Route to appropriate solver
        if model_type in ["beam-demo", "shell-demo", "biw-proto"]:
            # For now, all model types use mock beam solver
            # TODO: Add real Gmsh + CalculiX integration for shell-demo and biw-proto
            self.update_progress(20.0, "Running mock solver")
            result = solve_mock_beam(request_data_with_id)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

        # Update progress
        self.update_progress(90.0, "Processing results")

        # Validate result
        if not result:
            raise RuntimeError("Solver returned empty result")

        if result.get("status") == "error":
            error_msg = result.get("error", "Unknown solver error")
            raise RuntimeError(f"Solver failed: {error_msg}")

        # Complete
        self.update_progress(100.0, "Analysis complete")

        return result

    except Exception as e:
        # Log error and re-raise
        error_msg = f"FEA analysis failed for job {job_id}: {str(e)}"
        print(f"ERROR: {error_msg}")
        raise RuntimeError(error_msg) from e
