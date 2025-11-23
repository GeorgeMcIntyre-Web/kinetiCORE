import logging
from typing import Dict, Any, List
try:
    from pxr import Usd, UsdPhysics, UsdGeom, Gf
except ImportError:
    pass

logger = logging.getLogger(__name__)

class ArticulationExtractor:
    def __init__(self, stage):
        self.stage = stage

    def extract(self) -> List[Dict[str, Any]]:
        articulations = []
        
        # Find Articulation Roots
        for prim in self.stage.Traverse():
            if prim.HasAPI(UsdPhysics.ArticulationRootAPI):
                articulations.append(self._process_articulation(prim))
                
        return articulations

    def _process_articulation(self, root_prim) -> Dict[str, Any]:
        joints = []
        
        # Traverse hierarchy to find joints
        # This is a simplified traversal; robust one follows relationships
        def traverse_joints(prim):
            if prim.IsA(UsdPhysics.Joint):
                joints.append(self._extract_joint(prim))
            for child in prim.GetChildren():
                traverse_joints(child)
                
        traverse_joints(root_prim)
        
        return {
            "root": str(root_prim.GetPath()),
            "joints": joints,
            "drives": [] # TODO: Extract drives
        }

    def _extract_joint(self, prim) -> Dict[str, Any]:
        joint = UsdPhysics.Joint(prim)
        
        # Determine type (Revolute, Prismatic, etc.)
        # UsdPhysics doesn't have a simple "type" enum on the base Joint, 
        # we check specific schemas like RevoluteJoint
        
        joint_type = "fixed"
        if prim.IsA(UsdPhysics.RevoluteJoint):
            joint_type = "revolute"
        elif prim.IsA(UsdPhysics.PrismaticJoint):
            joint_type = "prismatic"
            
        # Get relationships
        body0 = joint.GetBody0Rel().GetTargets()
        body1 = joint.GetBody1Rel().GetTargets()
        
        parent = str(body0[0]) if body0 else ""
        child = str(body1[0]) if body1 else ""
        
        # Limits
        lower = -1e9
        upper = 1e9
        
        if joint_type == "revolute":
            rev = UsdPhysics.RevoluteJoint(prim)
            lower = rev.GetLowerLimitAttr().Get()
            upper = rev.GetUpperLimitAttr().Get()
            
        return {
            "name": prim.GetName(),
            "type": joint_type,
            "parent": parent,
            "child": child,
            "axis": [0, 0, 1], # TODO: Extract actual axis
            "limits": [float(lower), float(upper)],
            "damping": 0.0,
            "stiffness": 0.0
        }
