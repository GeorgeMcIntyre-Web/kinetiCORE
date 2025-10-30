import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ICP } from '../../src/babylon/pointCloud/ICP';

function makeCloudCube(count = 200): BABYLON.Vector3[] {
	const pts: BABYLON.Vector3[] = [];
	for (let i = 0; i < count; i++) {
		pts.push(new BABYLON.Vector3(
			Math.random() - 0.5,
			Math.random() - 0.5,
			Math.random() - 0.5
		));
	}
	return pts;
}

describe('ICP.align', () => {
	it('recovers a known rigid transform', () => {
		const src = makeCloudCube(500);
		const axis = new BABYLON.Vector3(0, 1, 0);
		const angle = Math.PI / 6; // 30 deg
		const q = BABYLON.Quaternion.RotationAxis(axis, angle);
		const R = BABYLON.Matrix.Identity();
		BABYLON.Matrix.FromQuaternionToRef(q, R);
		const t = new BABYLON.Vector3(0.2, -0.1, 0.05);
		const T = R.clone();
		T.setRowFromFloats(0, T.m[0], T.m[1], T.m[2], t.x);
		T.setRowFromFloats(1, T.m[4], T.m[5], T.m[6], t.y);
		T.setRowFromFloats(2, T.m[8], T.m[9], T.m[10], t.z);

		const dst = src.map(p => BABYLON.Vector3.TransformCoordinates(p, T));
		const res = ICP.align(src, dst, { maxIterations: 60, tolerance: 1e-6, trimFraction: 0.9, rejectThreshold: 10 });
		expect(res.success).toBe(true);
		expect(res.rmsError).toBeLessThan(1e-3);
	});
});
