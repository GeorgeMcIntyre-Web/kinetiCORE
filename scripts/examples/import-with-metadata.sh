#!/bin/bash
# Example: Import Assets with External Metadata File
#
# This example shows how to provide rich metadata via JSON file
# when the asset directories don't have README files

SOURCE_DIR="/path/to/robots"
METADATA_FILE="./robot_metadata.json"
NAMESPACE="custom-robots"

# Create example metadata file
cat > "$METADATA_FILE" << 'EOF'
{
  "robot_arm_6dof": {
    "name": "6-Axis Robot Arm",
    "manufacturer": "ACME Robotics",
    "domain": "manufacturing",
    "assetClass": "robots",
    "assetType": "industrial_arm",
    "capabilities": {
      "dof": 6,
      "payload": 10,
      "reach": 1200,
      "hasKinematics": true
    },
    "tags": ["welding", "assembly", "pick-place"],
    "description": "General purpose 6-axis industrial robot arm"
  },
  "gripper_parallel": {
    "name": "Parallel Gripper",
    "manufacturer": "ACME Robotics",
    "domain": "manufacturing",
    "assetClass": "endEffectors",
    "assetType": "gripper",
    "capabilities": {
      "dof": 1,
      "payload": 5,
      "hasKinematics": false
    },
    "tags": ["parallel", "electric", "end-effector"],
    "description": "Electric parallel jaw gripper"
  }
}
EOF

echo "📋 Importing with metadata file..."

# Import with metadata
npm run import-assets -- \
  --source "$SOURCE_DIR" \
  --namespace "$NAMESPACE" \
  --metadata "$METADATA_FILE" \
  --dry-run \
  --verbose

# Cleanup
rm "$METADATA_FILE"
