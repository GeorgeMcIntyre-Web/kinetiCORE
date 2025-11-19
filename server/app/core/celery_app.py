"""
Celery application configuration.
Used by both the FastAPI app (to submit tasks) and the worker (to execute tasks).
"""

from celery import Celery

from .config import settings

# Create Celery app
celery_app = Celery(
    "kineticore_fea",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=settings.celery_task_track_started,
    task_time_limit=settings.celery_task_time_limit,
    # Auto-discover tasks in app.worker module
    imports=["app.worker"],
)
