import { describe, it, expect } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import * as BABYLON from '@babylonjs/core';
import { JointMath, JointState } from '../../src/babylon/kinematics/JointMath';

describe('JointMath.applyJointTransform', () => {
	it('rotates child around world anchor for hinge', () => {
		const engine = new NullEngine();
		const scene = new Scene(engine);
		const parent = new TransformNode('parent', scene);
		parent.position = new BABYLON.Vector3(0, 0, 0);
		const child = new TransformNode('child', scene);
		child.parent = parent;
		child.position = new BABYLON.Vector3(1, 0, 0);

		const def = {
			id: 'j1',
			kind: 'hinge' as const,
			parentNodeId: 'parent',
			childNodeId: 'child',
			axisWorld: new BABYLON.Vector3(0, 0, 1),
			anchorWorld: new BABYLON.Vector3(0, 0, 0),
			limits: { lower: -Math.PI, upper: Math.PI },
		};
		const state = new JointState();
		state.value = Math.PI / 2; // 90 deg

		JointMath.applyJointTransform(scene, def, state);
		scene.onBeforeRenderObservable.notifyObservers(scene);
		const w = child.getWorldMatrix();
		const pos = new BABYLON.Vector3(w.m[12], w.m[13], w.m[14]);
		// point (1,0,0) rotated 90 deg about Z around origin becomes (0,1,0)
		expect(pos.x).toBeCloseTo(0, 3);
		expect(pos.y).toBeCloseTo(1, 3);
	});
});


