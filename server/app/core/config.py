"""
Application configuration using Pydantic settings.
Environment variables can override defaults.
"""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    # Application
    app_name: str = "kinetiCORE FEA Service"
    app_version: str = "0.1.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8050

    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Redis (Celery broker and backend)
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    celery_task_track_started: bool = True
    celery_task_time_limit: int = 3600  # 1 hour max per task

    # Solver paths (future use)
    gmsh_binary_path: str = "gmsh"  # TODO: Set when Gmsh installed
    calculix_binary_path: str = "ccx"  # TODO: Set when CalculiX installed

    # Working directory for solver runs
    work_dir: str = "./solver_workspace"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Global settings instance
settings = Settings()
