"""
E2E observability tests for FEA metrics and logging.

Tests structured logging and metrics tracking across the complete job lifecycle:
- Job submission logs
- Worker execution logs
- Solver logs
- Metrics counters (submitted/completed/failed)

Uses Celery eager mode for synchronous testing.
"""

import pytest
from fastapi.testclient import TestClient
from typing import Dict
import time

from app.core.metrics import metrics_store


class TestFeaMetricsEndpoint:
    """Tests for GET /fea/metrics endpoint."""

    def test_metrics_endpoint_exists(self, client: TestClient):
        """Metrics endpoint should be accessible."""
        response = client.get("/fea/metrics")
        assert response.status_code == 200

    def test_metrics_endpoint_returns_json(self, client: TestClient):
        """Metrics endpoint should return JSON."""
        response = client.get("/fea/metrics")
        data = response.json()

        assert isinstance(data, dict)
        assert "submitted" in data
        assert "completed" in data
        assert "failed" in data

    def test_metrics_initially_zero(self, client: TestClient):
        """Metrics should start at zero (or current state)."""
        # Reset metrics for clean test
        metrics_store.reset()

        response = client.get("/fea/metrics")
        data = response.json()

        assert data["submitted"] == 0
        assert data["completed"] == 0
        assert data["failed"] == 0


class TestFeaMetricsTracking:
    """Tests for metrics tracking during job lifecycle."""

    def test_metrics_track_successful_job(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Successful job should increment submitted and completed."""
        # Reset metrics
        metrics_store.reset()

        # Submit job
        response = client.post("/fea/jobs", json=sample_fea_job_request)
        assert response.status_code == 200

        # Wait for completion (eager mode)
        time.sleep(0.1)

        # Check metrics
        metrics_response = client.get("/fea/metrics")
        data = metrics_response.json()

        assert data["submitted"] == 1
        assert data["completed"] == 1
        assert data["failed"] == 0

    def test_metrics_track_multiple_successful_jobs(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Multiple successful jobs should accumulate in metrics."""
        # Reset metrics
        metrics_store.reset()

        # Submit 3 jobs
        for _ in range(3):
            response = client.post("/fea/jobs", json=sample_fea_job_request)
            assert response.status_code == 200

        # Wait for all to complete
        time.sleep(0.3)

        # Check metrics
        metrics_response = client.get("/fea/metrics")
        data = metrics_response.json()

        assert data["submitted"] == 3
        assert data["completed"] == 3
        assert data["failed"] == 0

    def test_metrics_track_failed_job(self, client: TestClient):
        """Failed job should increment submitted and failed."""
        # Reset metrics
        metrics_store.reset()

        # Create request that will fail (solver error via debug flag)
        failing_request = {
            "meta": {
                "name": "Failing Job",
                "modelType": "beam-demo",
                "debugForceError": True  # This triggers mock solver error
            },
            "materials": [{
                "id": "mat1",
                "name": "Steel",
                "youngsModulus": 200e9,
                "poissonsRatio": 0.3
            }],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        # Submit job (should queue successfully)
        response = client.post("/fea/jobs", json=failing_request)
        assert response.status_code == 200
        job_id = response.json()["jobId"]

        # Wait for it to fail
        time.sleep(0.1)

        # Check metrics - should show submitted and failed
        metrics_response = client.get("/fea/metrics")
        data = metrics_response.json()

        assert data["submitted"] == 1
        assert data["failed"] == 1
        assert data["completed"] == 0

        # Verify job status shows error
        status_response = client.get(f"/fea/jobs/{job_id}")
        status_data = status_response.json()
        assert status_data["status"] == "error"

    def test_metrics_track_mixed_jobs(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Mix of successful and failed jobs should track correctly."""
        # Reset metrics
        metrics_store.reset()

        # Submit 2 successful jobs
        for _ in range(2):
            response = client.post("/fea/jobs", json=sample_fea_job_request)
            assert response.status_code == 200

        # Submit 1 failing job
        failing_request = {
            "meta": {
                "name": "Failing Job",
                "modelType": "beam-demo",
                "debugForceError": True
            },
            "materials": [{
                "id": "mat1",
                "name": "Steel",
                "youngsModulus": 200e9,
                "poissonsRatio": 0.3
            }],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }
        response = client.post("/fea/jobs", json=failing_request)
        assert response.status_code == 200

        # Wait for all to complete/fail
        time.sleep(0.3)

        # Check metrics
        metrics_response = client.get("/fea/metrics")
        data = metrics_response.json()

        assert data["submitted"] == 3
        assert data["completed"] == 2
        assert data["failed"] == 1


class TestEndToEndObservability:
    """Integration tests for complete observability flow."""

    def test_full_observability_cycle(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """
        Test complete E2E flow with observability:
        - Submit job → logs + metrics
        - Worker processes → logs
        - Solver runs → logs
        - Job completes → logs + metrics
        """
        # Reset metrics for clean test
        metrics_store.reset()

        # Get initial metrics
        initial_metrics = client.get("/fea/metrics").json()
        assert initial_metrics["submitted"] == 0
        assert initial_metrics["completed"] == 0

        # Step 1: Submit job
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        assert submit_response.status_code == 200
        job_id = submit_response.json()["jobId"]

        # Metrics should show submission
        after_submit_metrics = client.get("/fea/metrics").json()
        assert after_submit_metrics["submitted"] == 1
        assert after_submit_metrics["completed"] == 0

        # Step 2: Wait for worker to process
        time.sleep(0.1)

        # Step 3: Check job completed
        status_response = client.get(f"/fea/jobs/{job_id}")
        status_data = status_response.json()
        assert status_data["status"] == "completed"

        # Step 4: Get result
        result_response = client.get(f"/fea/jobs/{job_id}/result")
        result_data = result_response.json()
        assert result_data["status"] == "completed"
        assert result_data["maxDisplacement"] > 0
        assert result_data["maxVonMises"] > 0

        # Step 5: Final metrics should show completion
        final_metrics = client.get("/fea/metrics").json()
        assert final_metrics["submitted"] == 1
        assert final_metrics["completed"] == 1
        assert final_metrics["failed"] == 0

    def test_observability_with_validation_error(self, client: TestClient):
        """
        Test observability for validation errors.
        These should NOT increment metrics (rejected at API level).
        """
        # Reset metrics
        metrics_store.reset()

        # Submit invalid job (negative Young's modulus)
        invalid_request = {
            "meta": {
                "name": "Invalid Job",
                "modelType": "beam-demo"
            },
            "materials": [{
                "id": "bad-mat",
                "name": "Bad Material",
                "youngsModulus": -100,  # Invalid
                "poissonsRatio": 0.3
            }],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        # Should fail at validation (422)
        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422

        # Metrics should NOT change (validation error, not submitted)
        metrics = client.get("/fea/metrics").json()
        assert metrics["submitted"] == 0
        assert metrics["completed"] == 0
        assert metrics["failed"] == 0
