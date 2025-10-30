import { describe, it, expect } from 'vitest';
import { toolingJsonToJoints } from '../../src/babylon/io/ToolingJsonAdapter';

const sample = [
	{
		UnitName: 'UNIT_114',
		Joints: [
			{
				Name: 'C1',
				ElectricalName: 'UNIT_114R',
				NodeId: '9X_110_GEO/UNIT_114/RH/MOVING',
				HideId: '',
				Type: 1,
				MaxValue: 90,
				MinValue: 0,
				ToVector: { X: 1, Y: 0, Z: 0 },
				FromVector: { X: 0, Y: 0, Z: 0 },
				TransformationMatrix: [
					'0.0000  -1.0000  0.0000  0.0000',
					'1.0000   0.0000  0.0000  0.0000',
					'0.0000   0.0000  1.0000  0.0000',
					'0.0000   0.0000  0.0000  1.0000'
				]
			},
			{
				Name: 'S1',
				ElectricalName: 'UNIT_114S',
				NodeId: '9X_110_GEO/UNIT_114/SLIDE/MOVING',
				HideId: '',
				Type: 0,
				MaxValue: 0.05,
				MinValue: 0,
				ToVector: { X: 0, Y: 0, Z: 0.05 },
				FromVector: { X: 0, Y: 0, Z: 0 },
				TransformationMatrix: [
					'1 0 0 0', '0 1 0 0', '0 0 1 0.05', '0 0 0 1'
				]
			}
		]
	}
] as any;

describe('toolingJsonToJoints', () => {
	it('maps hinge and prismatic correctly', () => {
		const joints = toolingJsonToJoints(sample, (p) => p.split('/').slice(0, -1).join('/'));
		expect(joints.length).toBe(2);
		const hinge = joints.find(j => j.type === 'hinge')!;
		const slide = joints.find(j => j.type === 'prismatic')!;
		expect(hinge.limits.upper).toBeCloseTo(Math.PI / 2, 4);
		expect(slide.limits.upper).toBeCloseTo(0.05, 6);
	});
});
