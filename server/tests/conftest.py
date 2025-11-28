"""
Pytest fixtures for kinetiCORE FEA backend tests.

Provides:
- FastAPI test client
- Celery test configuration (eager mode)
- Mock Redis fixture
- Sample FEA job data builders
"""

import pytest
from fastapi.testclient import TestClient
from typing import Dict, Any

# Set Celery eager mode BEFORE importing app/celery_app
import os
os.environ["CELERY_ALWAYS_EAGER"] = "True"

from app.main import app
from app.core.celery_app import celery_app


@pytest.fixture(scope="session", autouse=True)
def celery_eager_mode():
    """
    Configure Celery to run tasks synchronously in-process.

    This eliminates the need for a Redis broker during tests.
    Tasks execute immediately when called, allowing synchronous testing.
    """
    # Store original settings
    original_always_eager = celery_app.conf.task_always_eager
    original_eager_propagates = celery_app.conf.task_eager_propagates
    original_broker_connection_retry = celery_app.conf.broker_connection_retry
    original_broker_connection_retry_on_startup = celery_app.conf.broker_connection_retry_on_startup

    # Enable eager mode
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False  # Don't propagate exceptions to caller
    # Disable broker connection attempts in test mode
    celery_app.conf.broker_connection_retry = False
    celery_app.conf.broker_connection_retry_on_startup = False

    yield

    # Restore original settings
    celery_app.conf.task_always_eager = original_always_eager
    celery_app.conf.task_eager_propagates = original_eager_propagates
    celery_app.conf.broker_connection_retry = original_broker_connection_retry
    celery_app.conf.broker_connection_retry_on_startup = original_broker_connection_retry_on_startup


@pytest.fixture
def client():
    """FastAPI test client for HTTP endpoint testing."""
    # Reset metrics before each test that uses the client
    from app.core.metrics import metrics_store
    metrics_store.reset()

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_fea_job_request() -> Dict[str, Any]:
    """
    Complete FEA job request with all required fields.

    Matches the actual FeaJobRequest model in server/app/models/fea.py.
    Represents a simple cantilever beam analysis.
    """
    return {
        "meta": {
            "name": "Test Beam Analysis",
            "modelType": "beam-demo"
        },
        "materials": [{
            "id": "mat-steel",
            "name": "Structural Steel",
            "youngsModulus": 200e9,  # 200 GPa
            "poissonsRatio": 0.3
        }],
        "boundaryConditions": [{
            "type": "fixed",
            "nodeIds": [1, 2, 3]
        }],
        "loads": [{
            "type": "concentrated",
            "nodeIds": [100],
            "force": {"x": 0, "y": -1000, "z": 0}  # 1000N downward
        }]
    }
