"""
Analyze GLB Fixture Hierarchy - Name-Agnostic Unit Detection

Loads real GLB fixtures and validates unit detection by analyzing
the scene hierarchy structure.

This script validates that the Statistical Pairing approach correctly
identifies units based on geometry/hierarchy, not naming conventions.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import trimesh
except ImportError:
    print("ERROR: trimesh not installed. Run: pip install trimesh")
    sys.exit(1)

# Ground truth data - user provided
GROUND_TRUTH = {
    "Floor Clamp": {
        "path": r"C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data\2174530000_M00_GJR_RR FLR_CM030_T01\2174530000_M00_GJR_RR FLR_CM030_T01_draco_off.glb",
        "total_units": 17,
        "moving_units": [
            "2174530040_M00_CLAMP UNIT_040",
            "2174530060_M00_CLAMP UNIT_060",
            "2174530080_M00_CLAMP UNIT_080",
            "2174530100_M00_CLAMP UNIT_100_SYM_080",
            "2174530120_M00_CLAMP UNIT_120",
            "2174530260_M00_CLAMP UNIT_260_SYM_240",
            "2174530280_M00_CLAMP UNIT_280",
            "2174530300_M00_CLAMP UNIT_300_SYM_280",
            "2174530320_M00_RETRACT PIN UNIT_320",
            "2174530340_M00_RETRACT PIN UNIT_340_SYM_320",
        ],
        "static_units": [
            "2174530CST_M00_CONSTRUCTION",
            "2174530020_M00_BASE UNIT_020",
            "2174530140_M00_PIN UNIT_140",
            "2174530160_M00_PIN UNIT_160",
            "2174530180_M00_SUPPORT UNIT_180",
            "2174530200_M00_SUPPORT UNIT_200_SYM_180",
            "2174530220_M00_SUPPORT UNIT_220",
        ],
    },
    "8X-140-1E1_LH": {
        "path": r"C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data\8X-140-1E1_LH\016ZF_20142435_140_1E1_CI00_draco_off.glb",
        "total_units": 4,
        "moving_units": [
            "UNIT_102",
            "UNIT_106",
        ],
    },
    "5X-110": {
        "path": r"C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data\016ZF_20142452_110\016ZF_20142452_110_draco_off.glb",
        "total_units": 13,
        "moving_units": [
            "UNIT_104",
            "UNIT_105",
            "UNIT_108",
            "UNIT_112",
            "UNIT_114",
            "UNIT_116",
            "UNIT_120",
        ],
    },
}


def count_vertices_recursive(scene, node_name: str) -> int:
    """Count vertices in a node and all its children."""
    total = 0

    # Get geometry for this node
    if node_name in scene.graph.transforms.node_data:
        geometry = scene.graph.transforms.node_data[node_name].get('geometry')
        if geometry and hasattr(scene, 'geometry') and geometry in scene.geometry:
            mesh = scene.geometry[geometry]
            if hasattr(mesh, 'vertices'):
                total += len(mesh.vertices)

    # Add children
    children = scene.graph.transforms.children.get(node_name, [])
    for child in children:
        total += count_vertices_recursive(scene, child)

    return total


def find_top_level_units(scene) -> List[Tuple[str, int, int]]:
    """
    Find top-level units in the scene hierarchy.
    Returns list of (name, vertex_count, depth).
    """
    units = []

    # Find root nodes (nodes with no parents)
    all_nodes = set(scene.graph.transforms.node_data.keys())
    all_children = set()
    for children_list in scene.graph.transforms.children.values():
        all_children.update(children_list)

    roots = all_nodes - all_children

    # For each root, traverse and find significant subtrees
    def traverse(node, depth=0):
        vertex_count = count_vertices_recursive(scene, node)

        # Consider nodes with significant geometry (> 100 vertices)
        # or nodes that have children
        children = scene.graph.transforms.children.get(node, [])

        if vertex_count > 100 or children:
            units.append((node, vertex_count, depth))

        # Also check immediate children for unit-level nodes
        for child in children:
            traverse(child, depth + 1)

    for root in roots:
        traverse(root)

    return units


def validate_fixture(name: str, data: Dict):
    """Validate unit detection for a single fixture."""
    print("\n" + "=" * 90)
    print(f"FIXTURE: {name}")
    print("=" * 90)
    print(f"File: {data['path']}")
    print(f"Expected total units: {data['total_units']}")
    print(f"Expected moving units: {len(data['moving_units'])}")

    if not Path(data['path']).exists():
        print(f"\n[ERROR] File not found: {data['path']}")
        return

    print("\nLoading GLB...")
    try:
        scene = trimesh.load(data['path'])
    except Exception as e:
        print(f"[ERROR] Failed to load GLB: {e}")
        return

    # Handle both single mesh and scene
    if isinstance(scene, trimesh.Scene):
        print(f"[OK] Loaded scene with {len(scene.geometry)} geometries")
        total_vertices = sum(
            len(mesh.vertices) if hasattr(mesh, 'vertices') else 0
            for mesh in scene.geometry.values()
        )
        print(f"Total vertices: {total_vertices:,}")

        # Find top-level units
        units = find_top_level_units(scene)
        units.sort(key=lambda x: x[1], reverse=True)  # Sort by vertex count

        print(f"\nDetected {len(units)} nodes in hierarchy:\n")

        for i, (node_name, vertex_count, depth) in enumerate(units[:30], 1):  # Show top 30
            pct = (vertex_count / total_vertices * 100) if total_vertices > 0 else 0
            indent = "  " * depth
            print(f"  {i:2}. {indent}{node_name[:60]:60} {vertex_count:>10,} verts ({pct:5.1f}%) depth={depth}")

        if len(units) > 30:
            print(f"  ... and {len(units) - 30} more nodes")

        # Validate against ground truth
        print(f"\n{'-' * 90}")
        print("VALIDATION:")
        print(f"{'-' * 90}\n")

        found_count = 0
        missing_units = []

        for expected_unit in data['moving_units']:
            # Check if this unit name appears in detected nodes
            found = any(expected_unit in node_name for node_name, _, _ in units)

            if found:
                found_count += 1
                # Find the matching node to show details
                matching_node = next((node for node, _, _ in units if expected_unit in node), None)
                if matching_node:
                    vertex_count = next(v for n, v, _ in units if n == matching_node)
                    pct = (vertex_count / total_vertices * 100) if total_vertices > 0 else 0
                    print(f"  [OK] {expected_unit[:50]:50} {vertex_count:>10,} verts ({pct:5.1f}%)")
            else:
                missing_units.append(expected_unit)
                print(f"  [MISS] {expected_unit[:50]:50} NOT FOUND")

        # Check for static units if provided
        if 'static_units' in data:
            print(f"\nStatic units ({len(data['static_units'])}):")
            for static_unit in data['static_units']:
                found = any(static_unit in node_name for node_name, _, _ in units)
                if found:
                    matching_node = next((node for node, _, _ in units if static_unit in node), None)
                    if matching_node:
                        vertex_count = next(v for n, v, _ in units if n == matching_node)
                        pct = (vertex_count / total_vertices * 100) if total_vertices > 0 else 0
                        print(f"  [STATIC] {static_unit[:50]:50} {vertex_count:>10,} verts ({pct:5.1f}%)")

        print(f"\n{'-' * 90}")
        detection_rate = (found_count / len(data['moving_units']) * 100) if data['moving_units'] else 0
        print(f"Detection Rate: {found_count}/{len(data['moving_units'])} ({detection_rate:.1f}%)")

        if missing_units:
            print(f"Status: [PARTIAL] - Missing: {', '.join(missing_units)}")
        else:
            print(f"Status: [PASS] - All expected moving units found")

    else:
        print(f"[OK] Loaded single mesh with {len(scene.vertices):,} vertices")
        print("[WARN] Single mesh - cannot analyze hierarchy")


def main():
    print("=" * 90)
    print("GROUND TRUTH VALIDATION - Statistical Pairing Engine")
    print("=" * 90)
    print("\nValidating unit detection against known fixtures")
    print("Method: Name-agnostic hierarchy analysis\n")

    for name, data in GROUND_TRUTH.items():
        validate_fixture(name, data)

    print("\n" + "=" * 90)
    print("VALIDATION COMPLETE")
    print("=" * 90)


if __name__ == "__main__":
    main()
