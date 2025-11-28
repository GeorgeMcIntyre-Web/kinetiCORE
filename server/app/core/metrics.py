"""
Simple in-memory metrics for FEA job tracking.

This is a lightweight metrics system for debugging and E2E observability.
NOT intended as a production metrics solution (use Prometheus/Grafana for that).

Thread-safe counters track job lifecycle events.
"""

import threading
from dataclasses import dataclass
from typing import Dict


@dataclass
class FeaJobMetrics:
    """In-memory counters for FEA job lifecycle events."""

    submitted: int = 0
    completed: int = 0
    failed: int = 0

    def to_dict(self) -> Dict[str, int]:
        """
        Convert metrics to dictionary for JSON serialization.

        Returns:
            Dictionary with metric counts
        """
        return {
            "submitted": self.submitted,
            "completed": self.completed,
            "failed": self.failed,
        }


class MetricsStore:
    """Thread-safe metrics storage."""

    def __init__(self) -> None:
        """Initialize metrics store with lock for thread safety."""
        self._metrics = FeaJobMetrics()
        self._lock = threading.Lock()

    def increment_submitted(self) -> None:
        """Increment submitted job counter."""
        with self._lock:
            self._metrics.submitted += 1

    def increment_completed(self) -> None:
        """Increment completed job counter."""
        with self._lock:
            self._metrics.completed += 1

    def increment_failed(self) -> None:
        """Increment failed job counter."""
        with self._lock:
            self._metrics.failed += 1

    def get_snapshot(self) -> Dict[str, int]:
        """
        Get current metrics snapshot.

        Returns:
            Dictionary with current metric values
        """
        with self._lock:
            return self._metrics.to_dict()

    def reset(self) -> None:
        """
        Reset all metrics to zero.

        WARNING: This is for testing only. Do not use in production.
        """
        with self._lock:
            self._metrics = FeaJobMetrics()


# Global metrics instance
metrics_store = MetricsStore()
