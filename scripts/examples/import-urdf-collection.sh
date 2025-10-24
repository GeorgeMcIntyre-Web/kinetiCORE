#!/bin/bash
# Example: Import URDF Robot Collection
#
# This example imports a collection of URDF robots (e.g., from ROS Industrial)

SOURCE_DIR="/path/to/urdf_robots"
NAMESPACE="ros-industrial"
FORMAT="urdf"

echo "📦 Importing URDF collection..."
echo "Source: $SOURCE_DIR"
echo "Namespace: $NAMESPACE"
echo ""

# Dry run first
npm run import-assets -- \
  --source "$SOURCE_DIR" \
  --format "$FORMAT" \
  --namespace "$NAMESPACE" \
  --dry-run

# If looks good, run with --upload flag
# npm run import-assets -- \
#   --source "$SOURCE_DIR" \
#   --format "$FORMAT" \
#   --namespace "$NAMESPACE" \
#   --upload \
#   --api-url "https://api.kineticore.io/v1" \
#   --api-key "your-api-key"
