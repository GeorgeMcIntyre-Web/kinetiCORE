from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union

class ConversionOptions(BaseModel):
    enable_physics: bool = True
    enable_materials: bool = True
    enable_animations: bool = True
    texture_quality: str = "medium" # low, medium, high
    compute_collision_shapes: bool = True
    simplify_meshes: bool = False

class ConversionRequest(BaseModel):
    filename: str
    options: ConversionOptions = ConversionOptions()

class ConversionStatus(BaseModel):
    task_id: str
    status: str = "pending" # pending, processing, completed, failed
    progress: float = 0.0
    message: str = "Queued"
    result_url: Optional[str] = None
    metadata_url: Optional[str] = None
    error: Optional[str] = None

class PhysicsMetadata(BaseModel):
    mass: float
    center_of_mass: List[float]
    inertia_tensor: List[float]
    collision_shapes: List[Dict[str, Any]]

class ArticulationJoint(BaseModel):
    name: str
    type: str # revolute, prismatic, fixed
    parent: str
    child: str
    axis: List[float]
    limits: List[float]
    drive_target: float = 0.0
    stiffness: float = 0.0
    damping: float = 0.0

class Articulation(BaseModel):
    root: str
    joints: List[ArticulationJoint]

class KinetiCoreMetadata(BaseModel):
    articulations: List[Articulation] = []
    collision_shapes: Dict[str, PhysicsMetadata] = {}
    collision_primitives: Dict[str, Any] = {}
    animations: List[Dict[str, Any]] = []
