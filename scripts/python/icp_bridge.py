"""
ICP Bridge - High-quality ICP using Open3D (photogrammetry-grade)

This Python script accepts two point clouds as JSON and returns the ICP result.
Can be called from Node.js using child_process.
"""

import sys
import json
import numpy as np
import open3d as o3d


def icp_registration(source_points, target_points, config):
    """
    Run Open3D ICP registration on two point clouds.

    Args:
        source_points: Nx3 array of source points
        target_points: Mx3 array of target points
        config: dict with ICP parameters

    Returns:
        dict with transformation matrix, RMS error, fitness
    """
    # Convert to Open3D point clouds
    source_cloud = o3d.geometry.PointCloud()
    source_cloud.points = o3d.utility.Vector3dVector(source_points)

    target_cloud = o3d.geometry.PointCloud()
    target_cloud.points = o3d.utility.Vector3dVector(target_points)

    # ICP parameters
    max_correspondence_distance = config.get('max_correspondence_distance', 0.100)  # 100mm
    relative_fitness = config.get('relative_fitness', 1e-7)
    relative_rmse = config.get('relative_rmse', 1e-7)
    max_iteration = config.get('max_iteration', 200)

    # Convergence criteria
    criteria = o3d.pipelines.registration.ICPConvergenceCriteria(
        relative_fitness=relative_fitness,
        relative_rmse=relative_rmse,
        max_iteration=max_iteration
    )

    # Initial alignment: use provided transform if available, else align centroids
    initial_transform = np.identity(4)
    if 'initial_transform' in config and config['initial_transform'] is not None:
        initial_transform = np.array(config['initial_transform'], dtype=np.float64)
    else:
        source_center = source_cloud.get_center()
        target_center = target_cloud.get_center()
        translation = target_center - source_center
        initial_transform[0:3, 3] = translation
    
    # Also try point-to-plane ICP which is more robust
    # First try point-to-point with centroid alignment
    result = o3d.pipelines.registration.registration_icp(
        source_cloud,
        target_cloud,
        max_correspondence_distance,
        initial_transform,
        o3d.pipelines.registration.TransformationEstimationPointToPoint(),
        criteria
    )
    
    # If point-to-point didn't work well, try point-to-plane (more robust)
    if result.inlier_rmse > config.get('rmse_threshold', 0.001) * 2:  # If RMS is > 2x threshold
        # Estimate normals for point-to-plane ICP
        source_cloud.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
        )
        target_cloud.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
        )
        
        result_ptp = o3d.pipelines.registration.registration_icp(
            source_cloud,
            target_cloud,
            max_correspondence_distance,
            initial_transform,
            o3d.pipelines.registration.TransformationEstimationPointToPlane(),
            criteria
        )
        
        # Use point-to-plane if it's better
        if result_ptp.inlier_rmse < result.inlier_rmse:
            result = result_ptp

    # If forward ICP didn't converge well, try reverse
    if result.inlier_rmse > config.get('rmse_threshold', 0.001):
        # Try reverse ICP
        result_reverse = o3d.pipelines.registration.registration_icp(
            target_cloud,
            source_cloud,
            max_correspondence_distance,
            initial_transform,
            o3d.pipelines.registration.TransformationEstimationPointToPoint(),
            criteria
        )

        # Use reverse if it's better
        if result_reverse.inlier_rmse < result.inlier_rmse:
            # Invert the transformation
            result.transformation = np.linalg.inv(result_reverse.transformation)
            result.inlier_rmse = result_reverse.inlier_rmse
            result.fitness = result_reverse.fitness

    return {
        'transformation': result.transformation.tolist(),
        'inlier_rmse': float(result.inlier_rmse),
        'fitness': float(result.fitness),
        'correspondences': int(result.correspondence_set.__len__() if hasattr(result, 'correspondence_set') else 0)
    }


def main():
    """
    Read JSON input from stdin, run ICP, write JSON output to stdout.

    Expected input format:
    {
        "sourcePoints": [[x1, y1, z1], [x2, y2, z2], ...],
        "targetPoints": [[x1, y1, z1], [x2, y2, z2], ...],
        "config": {
            "max_correspondence_distance": 0.1,
            "relative_fitness": 1e-7,
            "relative_rmse": 1e-7,
            "max_iteration": 200,
            "rmse_threshold": 0.001
        }
    }
    """
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        source_points = np.array(input_data['sourcePoints'], dtype=np.float64)
        target_points = np.array(input_data['targetPoints'], dtype=np.float64)
        config = input_data.get('config', {})

        # Run ICP
        result = icp_registration(source_points, target_points, config)

        # Output result as JSON
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        # Output error as JSON
        error_result = {
            'error': str(e),
            'type': type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
