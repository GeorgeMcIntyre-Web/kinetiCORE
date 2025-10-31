import { describe, it, expect } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ToolGraphAnalyzer } from '../../src/babylon/sceneAnalysis/ToolGraphAnalyzer';

function makeTree(scene: Scene) {
	const root = new TransformNode('9X_110_GEO', scene);
	const unit = new TransformNode('9X_110_GEO/UNIT_114', scene); unit.parent = root;
	const rh = new TransformNode('9X_110_GEO/UNIT_114/RH', scene); rh.parent = unit;
	const moving = new TransformNode('9X_110_GEO/UNIT_114/RH/MOVING', scene); moving.parent = rh;
	return { root };
}

describe('ToolGraphAnalyzer', () => {
	it('classifies moving vs fixed from MOVING suffix', () => {
		const engine = new NullEngine();
		const scene = new Scene(engine);
		makeTree(scene);
		const analyzer = new ToolGraphAnalyzer();
		const graph = analyzer.analyze(scene);
		expect(graph.units.length).toBeGreaterThan(0);
		const anyMoving = graph.units.some(u => !u.isFixed);
		expect(anyMoving).toBe(true);
	});
});


