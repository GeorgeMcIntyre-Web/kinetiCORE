import logging
import json
from typing import Dict, Any
from .physics_extractor import PhysicsExtractor
from .articulation_extractor import ArticulationExtractor

logger = logging.getLogger(__name__)

class MetadataGenerator:
    def __init__(self, stage):
        self.stage = stage
        self.physics = PhysicsExtractor(stage)
        self.articulation = ArticulationExtractor(stage)

    def generate(self) -> Dict[str, Any]:
        """Generate full KinetiCore metadata."""
        try:
            physics_data = self.physics.extract()
            articulation_data = self.articulation.extract()
            
            return {
                "articulations": articulation_data,
                "collision_shapes": physics_data.get("collision_shapes", {}),
                "collision_primitives": physics_data.get("collision_primitives", {}),
                "animations": [] # TODO: Animation extraction
            }
        except Exception as e:
            logger.error(f"Metadata generation failed: {e}")
            return {}

    def save(self, output_path: str):
        data = self.generate()
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
