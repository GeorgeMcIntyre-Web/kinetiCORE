"""
FEA service Pydantic models.

API Contract:
- These models match the TypeScript interfaces in src/services/fea/FeaServiceTypes.ts
- JSON field names use camelCase (via aliases) to match TypeScript conventions
- Frontend client: src/services/fea/FeaServiceClient.ts
- Backend endpoints: app/main.py (FastAPI routes)
"""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class FeaJobStatusType(str, Enum):
    """FEA job status enumeration."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"


class FeaModelType(str, Enum):
    """Model types supported by FEA service."""

    BEAM_DEMO = "beam-demo"
    SHELL_DEMO = "shell-demo"
    BIW_PROTO = "biw-proto"


class BCType(str, Enum):
    """Boundary condition types."""

    FIXED = "fixed"
    PINNED = "pinned"
    SYMMETRY = "symmetry"


class LoadType(str, Enum):
    """Load types."""

    CONCENTRATED = "concentrated"
    PRESSURE = "pressure"
    GRAVITY = "gravity"


class DOF(str, Enum):
    """Degrees of freedom."""

    UX = "ux"
    UY = "uy"
    UZ = "uz"
    RX = "rx"
    RY = "ry"
    RZ = "rz"


class FeaMaterial(BaseModel):
    """Material definition for FEA analysis."""

    id: str = Field(..., description="Material identifier")
    name: str = Field(..., description="Display name")
    youngs_modulus: float = Field(..., alias="youngsModulus", description="Young's modulus (Pa)")
    poissons_ratio: float = Field(
        ..., alias="poissonsRatio", description="Poisson's ratio (dimensionless)"
    )
    density: Optional[float] = Field(None, description="Density (kg/m³)")
    yield_strength: Optional[float] = Field(
        None, alias="yieldStrength", description="Yield strength (Pa)"
    )

    class Config:
        populate_by_name = True

    @field_validator("youngs_modulus")
    @classmethod
    def validate_youngs_modulus(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Young's modulus must be positive")
        return v

    @field_validator("poissons_ratio")
    @classmethod
    def validate_poissons_ratio(cls, v: float) -> float:
        if not (0 <= v < 0.5):
            raise ValueError("Poisson's ratio must be in [0, 0.5)")
        return v

    @field_validator("density")
    @classmethod
    def validate_density(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Density must be positive")
        return v

    @field_validator("yield_strength")
    @classmethod
    def validate_yield_strength(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Yield strength must be positive")
        return v


class FeaBoundaryCondition(BaseModel):
    """Boundary condition definition."""

    type: BCType = Field(..., description="Type of constraint")
    node_ids: list[int] = Field(..., alias="nodeIds", description="Node IDs to constrain")
    dofs: Optional[list[DOF]] = Field(None, description="Constrained degrees of freedom")

    class Config:
        populate_by_name = True


class ForceVector(BaseModel):
    """3D force vector."""

    x: float
    y: float
    z: float


class FeaLoad(BaseModel):
    """Load definition."""

    type: LoadType = Field(..., description="Load type")
    node_ids: Optional[list[int]] = Field(None, alias="nodeIds", description="Node IDs")
    element_ids: Optional[list[int]] = Field(None, alias="elementIds", description="Element IDs")
    force: Optional[ForceVector] = Field(None, description="Force vector (N)")
    pressure: Optional[float] = Field(None, description="Pressure magnitude (Pa)")

    class Config:
        populate_by_name = True


class FeaJobMeta(BaseModel):
    """FEA job request metadata."""

    name: str = Field(..., description="Job name")
    description: Optional[str] = Field(None, description="Optional description")
    estimated_dofs: Optional[int] = Field(
        None, alias="estimatedDofs", description="Estimated degrees of freedom"
    )
    model_type: FeaModelType = Field(..., alias="modelType", description="Model type")

    # Dev-only failure injection flags (optional)
    debug_slow_solver: Optional[bool] = Field(
        None, alias="debugSlowSolver", description="[DEV ONLY] Simulate slow solver (5-10s delay)"
    )
    debug_force_error: Optional[bool] = Field(
        None, alias="debugForceError", description="[DEV ONLY] Force solver to fail with error"
    )

    class Config:
        populate_by_name = True


class SolverOptions(BaseModel):
    """Solver configuration options."""

    max_iterations: Optional[int] = Field(None, alias="maxIterations")
    tolerance: Optional[float] = None

    class Config:
        populate_by_name = True


class FeaJobRequest(BaseModel):
    """Complete FEA job request."""

    meta: FeaJobMeta = Field(..., description="Job metadata")
    materials: list[FeaMaterial] = Field(..., min_length=1, description="Materials")
    boundary_conditions: list[FeaBoundaryCondition] = Field(
        ..., alias="boundaryConditions", min_length=1, description="Boundary conditions"
    )
    loads: list[FeaLoad] = Field(..., min_length=1, description="Applied loads")
    solver_options: Optional[SolverOptions] = Field(
        None, alias="solverOptions", description="Solver options"
    )

    class Config:
        populate_by_name = True


class FeaJobStatus(BaseModel):
    """FEA job status response."""

    job_id: str = Field(..., alias="jobId", description="Unique job identifier")
    status: FeaJobStatusType = Field(..., description="Current status")
    progress: Optional[float] = Field(None, description="Progress percentage (0-100)")
    message: Optional[str] = Field(None, description="Status message")
    updated_at: Optional[str] = Field(None, alias="updatedAt", description="Last update timestamp")

    class Config:
        populate_by_name = True


class DisplacementVector(BaseModel):
    """Displacement vector at a node."""

    x: float
    y: float
    z: float


class ResultFields(BaseModel):
    """Nodal displacement field data."""

    node_ids: Optional[list[int]] = Field(None, alias="nodeIds")
    displacements: Optional[list[DisplacementVector]] = None
    von_mises: Optional[list[float]] = Field(None, alias="vonMises")

    class Config:
        populate_by_name = True


class ResultMeta(BaseModel):
    """Result metadata."""

    solve_time: Optional[float] = Field(None, alias="solveTime", description="Solve time (seconds)")
    dofs: Optional[int] = Field(None, description="Actual DOFs")

    class Config:
        populate_by_name = True


class FeaJobResult(BaseModel):
    """FEA job result response."""

    job_id: str = Field(..., alias="jobId", description="Job identifier")
    status: Literal["completed", "error"] = Field(..., description="Final status")
    error: Optional[str] = Field(None, description="Error message if status is error")
    max_displacement: Optional[float] = Field(
        None, alias="maxDisplacement", description="Maximum displacement (m)"
    )
    max_von_mises: Optional[float] = Field(
        None, alias="maxVonMises", description="Maximum von Mises stress (Pa)"
    )
    factor_of_safety: Optional[float] = Field(
        None, alias="factorOfSafety", description="Factor of safety"
    )
    fields: Optional[ResultFields] = Field(None, description="Displacement field data")
    meta: Optional[ResultMeta] = Field(None, description="Result metadata")

    class Config:
        populate_by_name = True
