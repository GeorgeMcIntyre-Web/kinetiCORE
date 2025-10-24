# Asset Import Examples

This directory contains example scripts showing various asset import workflows.

## Examples

### 1. [import-company-library.sh](./import-company-library.sh)
Import your company's robot library with custom namespace.

**Use Case:** Bulk import of proprietary company models

```bash
./scripts/examples/import-company-library.sh
```

### 2. [import-urdf-collection.sh](./import-urdf-collection.sh)
Import a collection of URDF robots (e.g., ROS Industrial).

**Use Case:** Import open-source URDF collections

```bash
./scripts/examples/import-urdf-collection.sh
```

### 3. [import-with-metadata.sh](./import-with-metadata.sh)
Import assets with external metadata file for rich information.

**Use Case:** Assets without README files, need to add metadata

```bash
./scripts/examples/import-with-metadata.sh
```

## Quick Start

All examples use the generic import script:

```bash
npm run import-assets -- [options]
```

### Common Options

```
--source <path>       Source directory with assets
--format <format>     urdf | mjcf | step | auto
--namespace <name>    Namespace for grouping (e.g., "my-company")
--metadata <file>     External metadata JSON/YAML
--dry-run             Preview without uploading (default)
--upload              Actually upload to cloud
--api-url <url>       Cloud API endpoint
--api-key <key>       Authentication key
--filter <regex>      Only import matching assets
--verbose, -v         Detailed output
```

## Real-World Scenarios

### Scenario 1: Company Internal Library

```bash
# Your company has 50+ robot models
npm run import-assets -- \
  --source ~/company_robots \
  --namespace "acme-robotics" \
  --format auto \
  --upload
```

### Scenario 2: Customer-Specific Assets

```bash
# Customer uploads their factory equipment
npm run import-assets -- \
  --source ~/customer_abc/equipment \
  --namespace "customer-abc" \
  --format step \
  --upload
```

### Scenario 3: Community Collection (MuJoCo)

```bash
# Optional: Import MuJoCo Menagerie
npm run import-assets -- \
  --source ~/mujoco_menagerie \
  --namespace "mujoco-menagerie" \
  --format mjcf \
  --filter "franka|ur5" \
  --upload
```

### Scenario 4: Selective Import

```bash
# Only import Fanuc robots
npm run import-assets -- \
  --source ~/all_robots \
  --filter "fanuc" \
  --namespace "fanuc" \
  --upload
```

## Directory Structure Examples

### URDF Collection
```
urdf_robots/
├── robot_a/
│   ├── robot.urdf
│   ├── meshes/
│   │   ├── base.stl
│   │   └── link1.stl
│   └── README.md
├── robot_b/
│   └── ...
```

### MJCF Collection
```
mjcf_robots/
├── robot_a/
│   ├── robot_a.xml
│   ├── scene.xml
│   ├── assets/
│   │   ├── link0.obj
│   │   └── ...
│   └── README.md
```

### STEP CAD Models
```
cad_models/
├── machine_a/
│   ├── machine_a.step
│   ├── thumbnail.png
│   └── datasheet.pdf
```

## Metadata File Format

External metadata file (JSON):

```json
{
  "robot_name": {
    "name": "Display Name",
    "manufacturer": "Company Name",
    "domain": "manufacturing",
    "assetClass": "robots",
    "assetType": "industrial_arm",
    "version": "1.0.0",
    "capabilities": {
      "dof": 6,
      "payload": 10,
      "reach": 1200
    },
    "tags": ["welding", "assembly"],
    "description": "Short description"
  }
}
```

## Tips

1. **Always run dry-run first** to preview what will be imported
2. **Use namespaces** to organize assets by owner/source
3. **Provide metadata** for better searchability
4. **Use filters** for selective import from large collections
5. **Check logs** for any import errors or warnings

## Support

For issues or questions:
- Documentation: `docs/GENERIC_ASSET_ARCHITECTURE.md`
- Import script: `scripts/import-asset-collection.ts`
- Full plan: `docs/CLOUD_ASSET_STORAGE_PLAN.md`
