import logging
from typing import Dict, Any, List
import numpy as np
try:
    from pxr import Usd, UsdGeom, UsdPhysics, Gf, Sdf
except ImportError:
    pass # Handled at runtime

logger = logging.getLogger(__name__)

class PhysicsExtractor:
    def __init__(self, stage):
        self.stage = stage

    def extract(self) -> Dict[str, Any]:
        """Extract physics metadata from the stage."""
        collision_shapes = {}
        collision_primitives = {}

        for prim in self.stage.Traverse():
            if prim.HasAPI(UsdPhysics.RigidBodyAPI):
                path = str(prim.GetPath())
                collision_shapes[path] = self._extract_rigid_body(prim)
            
            if prim.HasAPI(UsdPhysics.CollisionAPI):
                # Extract collision primitives
                # This is a simplification; real extraction handles mesh approximations
                pass

        return {
            "collision_shapes": collision_shapes,
            "collision_primitives": collision_primitives
        }

    def _extract_rigid_body(self, prim) -> Dict[str, Any]:
        rb_api = UsdPhysics.RigidBodyAPI(prim)
        mass_api = UsdPhysics.MassAPI(prim)
        
        mass = mass_api.GetMassAttr().Get() if mass_api.GetMassAttr().HasValue() else 1.0
        com = mass_api.GetCenterOfMassAttr().Get() if mass_api.GetCenterOfMassAttr().HasValue() else Gf.Vec3f(0,0,0)
        inertia = mass_api.GetDiagonalInertiaAttr().Get() if mass_api.GetDiagonalInertiaAttr().HasValue() else Gf.Vec3f(1,1,1)

        # Convert Gf types to list
        return {
            "mass": float(mass),
            "com": [float(com[0]), float(com[1]), float(com[2])],
            "inertia": [float(inertia[0]), float(inertia[1]), float(inertia[2]), 0.0, 0.0, 0.0], # Diagonal
            "collision_shapes": self._find_colliders(prim)
        }

    def _find_colliders(self, prim) -> List[Dict[str, Any]]:
        shapes = []
        # Traverse children to find collision shapes
        for child in prim.GetChildren():
            if child.HasAPI(UsdPhysics.CollisionAPI):
                # Determine type
                shape_type = "convex" # Default
                if child.IsA(UsdGeom.Cube):
                    shape_type = "box"
                    # Extract size...
                elif child.IsA(UsdGeom.Sphere):
                    shape_type = "sphere"
                
                shapes.append({
                    "type": shape_type,
                    "path": str(child.GetPath())
                })
        return shapes
