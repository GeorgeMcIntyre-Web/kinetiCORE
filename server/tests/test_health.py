"""
Health endpoint tests.

Verifies that the FEA service health check endpoint returns correct status.
Tests aligned with the real API in server/app/main.py
"""

import pytest
from fastapi.testclient import TestClient


def test_health_endpoint_returns_200(client: TestClient):
    """Health endpoint should return 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_endpoint_returns_json(client: TestClient):
    """Health endpoint should return JSON content type."""
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]


def test_health_endpoint_has_status_field(client: TestClient):
    """Health endpoint should have 'status' field."""
    response = client.get("/health")
    data = response.json()

    assert "status" in data
    assert data["status"] == "healthy"


def test_health_endpoint_has_service_field(client: TestClient):
    """Health endpoint should have 'service' field."""
    response = client.get("/health")
    data = response.json()

    assert "service" in data
    assert isinstance(data["service"], str)


def test_health_endpoint_no_auth_required(client: TestClient):
    """Health endpoint should not require authentication."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_endpoint_is_idempotent(client: TestClient):
    """Health endpoint should return consistent results."""
    response1 = client.get("/health")
    response2 = client.get("/health")

    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response1.json() == response2.json()
