"""
Celery application configuration.
Used by both the FastAPI app (to submit tasks) and the worker (to execute tasks).
"""

import os
from celery import Celery

from .config import settings

# Check if running in test mode (set by pytest conftest)
is_test_mode = os.getenv("CELERY_ALWAYS_EAGER", "False") == "True"

# Create Celery app
celery_app = Celery(
    "kineticore_fea",
    broker=settings.celery_broker_url if not is_test_mode else "memory://",
    backend=settings.celery_result_backend if not is_test_mode else "cache+memory://",
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
    # Test mode settings
    task_always_eager=is_test_mode,
    task_eager_propagates=False if is_test_mode else True,  # Don't propagate in tests
    broker_connection_retry_on_startup=not is_test_mode,
)
