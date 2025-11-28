"""
Mock FEA solver for development and testing.
Simulates computation delay and returns analytical beam solution.
"""

import logging
import time
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def solve_mock_beam(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mock solver that simulates FEA computation and returns analytical results.

    Uses Euler-Bernoulli beam theory for a cantilever with tip load:
    - Deflection: v(x) = (P/6EI)(3Lx² - x³)
    - Moment: M(x) = P(L - x)
    - Stress: σ = Mc/I

    Args:
        request_data: FEA job request dictionary

    Returns:
        Result dictionary matching FeaJobResult schema
    """
    # Extract request parameters
    meta = request_data.get("meta", {})
    job_id = meta.get("jobId", "unknown")
    model_type = meta.get("modelType", "beam-demo")

    # Dev-only failure injection flags
    debug_slow_solver = meta.get("debugSlowSolver", False)
    debug_force_error = meta.get("debugForceError", False)

    logger.info(
        f"Mock solver started for job {job_id} "
        f"(model_type={model_type}, slow={debug_slow_solver}, force_error={debug_force_error})"
    )

    # [DEV ONLY] Force error if requested
    if debug_force_error:
        logger.error(f"Job {job_id}: Forced error via debugForceError flag")
        return {
            "jobId": job_id,
            "status": "error",
            "error": "Forced error for testing (debugForceError=true)",
        }

    # Simulate computation delay (normal: 2s, slow: 5-10s)
    if debug_slow_solver:
        delay = 7.0  # 7 seconds for slow mode
        logger.info(f"Job {job_id}: Using slow solver mode (delay={delay}s)")
    else:
        delay = 2.0

    time.sleep(delay)

    materials = request_data.get("materials", [])
    loads = request_data.get("loads", [])

    # Validate we have required data
    if not materials:
        logger.warning(f"Job {job_id} has no materials")
        return {
            "jobId": job_id,
            "status": "error",
            "error": "No materials provided",
        }

    if not loads:
        logger.warning(f"Job {job_id} has no loads")
        return {
            "jobId": job_id,
            "status": "error",
            "error": "No loads provided",
        }

    # Extract material properties (use first material)
    material = materials[0]
    E = material.get("youngsModulus", 200e9)  # Pa
    yield_strength = material.get("yieldStrength") or material.get("yield_strength") or 250e6  # Pa
    logger.debug(f"Job {job_id}: Material E={E}, yield_strength={yield_strength}")

    # Extract load (use first concentrated load)
    load = next((ld for ld in loads if ld.get("type") == "concentrated"), None)

    if not load:
        logger.warning(f"Job {job_id} has no concentrated load")
        return {
            "jobId": job_id,
            "status": "error",
            "error": "No concentrated load found",
        }

    force = load.get("force", {})
    P = abs(force.get("y", -1000))  # Assume vertical load

    # Beam geometry assumptions (1m cantilever, 50mm x 100mm section)
    L = 1.0  # meters
    width = 0.05  # meters
    height = 0.1  # meters
    I = (width * height**3) / 12  # Second moment of area
    c = height / 2  # Distance to outer fiber

    # Calculate analytical results
    # Max displacement at tip: v(L) = PL³/3EI
    max_displacement = (P * L**3) / (3 * E * I)

    # Max moment at fixed end: M(0) = PL
    max_moment = P * L

    # Max stress at fixed end: σ = Mc/I
    max_stress = (max_moment * c) / I

    # Factor of safety
    factor_of_safety = yield_strength / max_stress if max_stress > 0 else None

    # Generate nodal field data (20 nodes along beam)
    num_nodes = 20
    node_ids: List[int] = []
    displacements: List[Dict[str, float]] = []
    von_mises: List[float] = []

    for i in range(num_nodes + 1):
        x = (i / num_nodes) * L

        # Displacement: v(x) = (P/6EI)(3Lx² - x³)
        v = (P / (6 * E * I)) * (3 * L * x * x - x * x * x)

        # Moment: M(x) = P(L - x)
        M = P * (L - x)

        # Stress: σ = Mc/I
        sigma = (M * c) / I if I > 0 else 0

        node_ids.append(i)
        displacements.append({"x": 0.0, "y": v, "z": 0.0})
        von_mises.append(abs(sigma))

    # Estimated DOFs (3 DOFs per node for beam)
    dofs = (num_nodes + 1) * 3

    # Build result
    result = {
        "jobId": job_id,
        "status": "completed",
        "maxDisplacement": max_displacement,
        "maxVonMises": max_stress,
        "factorOfSafety": factor_of_safety,
        "fields": {
            "nodeIds": node_ids,
            "displacements": displacements,
            "vonMises": von_mises,
        },
        "meta": {
            "solveTime": delay,
            "dofs": dofs,
        },
    }

    logger.info(
        f"Mock solver completed for job {job_id}: "
        f"max_disp={max_displacement*1000:.2f}mm, max_stress={max_stress/1e6:.1f}MPa, FoS={factor_of_safety:.2f}"
    )

    return result
