#!/bin/bash
# Example: Import Company Robot Library to kinetiCORE Cloud
#
# This example shows how to import your company's custom robot models
# to kinetiCORE cloud storage with proper namespacing and metadata.

# Configuration
SOURCE_DIR="/path/to/your_company/robot_library"
NAMESPACE="acme-robotics"
API_URL="https://api.kineticore.io/v1"
API_KEY="your-api-key-here"

# Step 1: Dry run to preview what will be imported
echo "🔍 Preview import (dry run)..."
npm run import-assets -- \
  --source "$SOURCE_DIR" \
  --format auto \
  --namespace "$NAMESPACE" \
  --dry-run \
  --verbose

# Step 2: Review output, then run actual import
read -p "Continue with upload? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "⬆️  Uploading assets to cloud..."
    npm run import-assets -- \
      --source "$SOURCE_DIR" \
      --format auto \
      --namespace "$NAMESPACE" \
      --api-url "$API_URL" \
      --api-key "$API_KEY" \
      --upload \
      --verbose

    echo "✅ Import complete!"
else
    echo "❌ Import cancelled"
fi
