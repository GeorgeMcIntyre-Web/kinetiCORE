"""
FEA job lifecycle tests.

Tests the complete flow aligned with the REAL API in server/app/main.py:
1. Submit job (POST /fea/jobs) → returns 200 with jobId and status="queued"
2. Check status (GET /fea/jobs/{jobId}) → returns status (queued/running/completed/error)
3. Retrieve result (GET /fea/jobs/{jobId}/result) → returns result when complete

Uses Celery eager mode (tasks run synchronously in-process).
"""

import pytest
from fastapi.testclient import TestClient
from typing import Dict, Any
import time


class TestJobSubmission:
    """Tests for POST /fea/jobs endpoint."""

    def test_submit_job_returns_200(self, client: TestClient, sample_fea_job_request: Dict):
        """Job submission should return 200 OK."""
        response = client.post("/fea/jobs", json=sample_fea_job_request)
        assert response.status_code == 200

    def test_submit_job_returns_job_id(self, client: TestClient, sample_fea_job_request: Dict):
        """Job submission should return a jobId."""
        response = client.post("/fea/jobs", json=sample_fea_job_request)
        data = response.json()

        assert "jobId" in data
        assert isinstance(data["jobId"], str)
        assert len(data["jobId"]) > 0

    def test_submit_job_initial_status_queued(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Newly submitted job should have status='queued'."""
        response = client.post("/fea/jobs", json=sample_fea_job_request)
        data = response.json()

        assert data["status"] == "queued"

    def test_submit_job_returns_message(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Job submission should return a message."""
        response = client.post("/fea/jobs", json=sample_fea_job_request)
        data = response.json()

        assert "message" in data
        assert isinstance(data["message"], str)

    def test_submit_job_with_invalid_material_fails(self, client: TestClient):
        """Job with invalid material properties should be rejected."""
        invalid_request = {
            "meta": {
                "name": "Invalid Job",
                "modelType": "beam-demo"
            },
            "materials": [
                {
                    "id": "bad-mat",
                    "name": "Bad Material",
                    "youngsModulus": -100,  # Invalid: negative
                    "poissonsRatio": 0.3
                }
            ],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422  # Validation error

    def test_submit_job_with_invalid_poissons_ratio_fails(self, client: TestClient):
        """Job with invalid Poisson's ratio should be rejected."""
        invalid_request = {
            "meta": {
                "name": "Invalid Job",
                "modelType": "beam-demo"
            },
            "materials": [
                {
                    "id": "bad-mat",
                    "name": "Bad Material",
                    "youngsModulus": 200e9,
                    "poissonsRatio": 0.6  # Invalid: >= 0.5
                }
            ],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422

    def test_submit_job_without_materials_fails(self, client: TestClient):
        """Job without materials should be rejected."""
        invalid_request = {
            "meta": {
                "name": "No Materials",
                "modelType": "beam-demo"
            },
            "materials": [],  # Empty
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422

    def test_submit_job_without_boundary_conditions_fails(self, client: TestClient):
        """Job without boundary conditions should be rejected."""
        invalid_request = {
            "meta": {
                "name": "No BCs",
                "modelType": "beam-demo"
            },
            "materials": [
                {
                    "id": "mat1",
                    "name": "Steel",
                    "youngsModulus": 200e9,
                    "poissonsRatio": 0.3
                }
            ],
            "boundaryConditions": [],  # Empty
            "loads": [{"type": "concentrated", "nodeIds": [2], "force": {"x": 0, "y": -100, "z": 0}}]
        }

        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422

    def test_submit_job_without_loads_fails(self, client: TestClient):
        """Job without loads should be rejected."""
        invalid_request = {
            "meta": {
                "name": "No Loads",
                "modelType": "beam-demo"
            },
            "materials": [
                {
                    "id": "mat1",
                    "name": "Steel",
                    "youngsModulus": 200e9,
                    "poissonsRatio": 0.3
                }
            ],
            "boundaryConditions": [{"type": "fixed", "nodeIds": [1]}],
            "loads": []  # Empty
        }

        response = client.post("/fea/jobs", json=invalid_request)
        assert response.status_code == 422


class TestJobStatus:
    """Tests for GET /fea/jobs/{jobId} endpoint."""

    def test_get_status_for_completed_job(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Should return 'completed' status after job finishes."""
        # Submit job
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        # In eager mode, task completes immediately
        time.sleep(0.1)

        # Get status
        status_response = client.get(f"/fea/jobs/{job_id}")
        assert status_response.status_code == 200

        data = status_response.json()
        assert data["status"] == "completed"

    def test_get_status_returns_job_id(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Status endpoint should return the jobId."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        status_response = client.get(f"/fea/jobs/{job_id}")
        data = status_response.json()

        assert data["jobId"] == job_id

    def test_get_status_for_nonexistent_job_returns_404(self, client: TestClient):
        """Status endpoint should return 404 for unknown job."""
        fake_job_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/fea/jobs/{fake_job_id}")

        assert response.status_code == 404


class TestJobResult:
    """Tests for GET /fea/jobs/{jobId}/result endpoint."""

    def test_get_result_returns_200_when_completed(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Result endpoint should return 200 when job is complete."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        result_response = client.get(f"/fea/jobs/{job_id}/result")
        assert result_response.status_code == 200

    def test_get_result_includes_job_id(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Result should include the jobId."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        result_response = client.get(f"/fea/jobs/{job_id}/result")
        data = result_response.json()

        assert data["jobId"] == job_id

    def test_get_result_includes_max_displacement(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Result should include maxDisplacement > 0."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        result_response = client.get(f"/fea/jobs/{job_id}/result")
        data = result_response.json()

        assert "maxDisplacement" in data
        assert isinstance(data["maxDisplacement"], (int, float))
        assert data["maxDisplacement"] > 0

    def test_get_result_includes_max_von_mises(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Result should include maxVonMises > 0."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        result_response = client.get(f"/fea/jobs/{job_id}/result")
        data = result_response.json()

        assert "maxVonMises" in data
        assert isinstance(data["maxVonMises"], (int, float))
        assert data["maxVonMises"] > 0

    def test_get_result_includes_fields(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Result should include fields with node data."""
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        job_id = submit_response.json()["jobId"]

        time.sleep(0.1)

        result_response = client.get(f"/fea/jobs/{job_id}/result")
        data = result_response.json()

        assert "fields" in data
        assert data["fields"] is not None

    def test_get_result_for_nonexistent_job_returns_404(self, client: TestClient):
        """Result endpoint should return 404 for unknown job."""
        fake_job_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/fea/jobs/{fake_job_id}/result")

        assert response.status_code == 404


class TestEndToEndJobFlow:
    """Integration tests for complete job lifecycle."""

    def test_full_job_cycle(self, client: TestClient, sample_fea_job_request: Dict):
        """Test complete flow: submit → status → result."""
        # Step 1: Submit job
        submit_response = client.post("/fea/jobs", json=sample_fea_job_request)
        assert submit_response.status_code == 200

        job_id = submit_response.json()["jobId"]
        assert job_id is not None

        # Step 2: Wait for completion (eager mode should be instant)
        time.sleep(0.1)

        # Step 3: Check status
        status_response = client.get(f"/fea/jobs/{job_id}")
        assert status_response.status_code == 200
        assert status_response.json()["status"] == "completed"

        # Step 4: Get result
        result_response = client.get(f"/fea/jobs/{job_id}/result")
        assert result_response.status_code == 200

        result = result_response.json()
        assert result["status"] == "completed"
        assert result["maxDisplacement"] > 0
        assert result["maxVonMises"] > 0

    def test_multiple_jobs_independent(
        self, client: TestClient, sample_fea_job_request: Dict
    ):
        """Multiple jobs should be tracked independently."""
        # Submit two jobs
        response1 = client.post("/fea/jobs", json=sample_fea_job_request)
        response2 = client.post("/fea/jobs", json=sample_fea_job_request)

        job_id_1 = response1.json()["jobId"]
        job_id_2 = response2.json()["jobId"]

        # Should have different IDs
        assert job_id_1 != job_id_2

        time.sleep(0.2)

        # Both should complete
        result1 = client.get(f"/fea/jobs/{job_id_1}/result")
        result2 = client.get(f"/fea/jobs/{job_id_2}/result")

        assert result1.status_code == 200
        assert result2.status_code == 200

        assert result1.json()["jobId"] == job_id_1
        assert result2.json()["jobId"] == job_id_2
