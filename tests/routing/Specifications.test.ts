// Specifications Tests - Unit tests for specification tables and constraint rules
// Owner: Agent 3 (Specifications & Technical Spec Lead)

import { describe, it, expect } from 'vitest';
import {
  // Pipe specifications
  getPipeConstraintRules,
  getPipeOuterDiameter,
  getPipeMaterialSpec,
  PIPE_SIZES,
  isValidPipeSize,
  isValidPipeMaterial,
  
  // Cable tray specifications
  getCableTrayConstraintRules,
  getCableTrayDimensions,
  getCableTrayMaterialSpec,
  CABLE_TRAY_SIZES,
  isValidCableTraySize,
  isValidCableTrayMaterial,
  
  // Wiring specifications
  getCableConstraintRules,
  getWireSpec,
  calculateCableDiameter,
  getColorForVoltage,
  AWG_TO_METRIC,
  recommendWireGauge,
  isValidWireGauge,
  
  // Conduit specifications
  getConduitConstraintRules,
  getConduitDimensions,
  getConduitTypeSpec,
  CONDUIT_SIZES,
  recommendConduitSize,
  isValidConduitSize,
  isValidConduitType,
  
  // Unified API
  getConstraintRules,
  
  // BOM schema
  getBOMCSVHeader,
  bomEntryToCSVRow,
  generateBOMCSV,
} from '../../src/routing/specifications';

describe('Agent 3 - Specifications', () => {
  describe('TC-SPECS1: Pipe sizes match specification table', () => {
    it('should have all standard pipe sizes defined', () => {
      const expectedSizes = ['1/4"', '3/8"', '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"'];
      
      expectedSizes.forEach(size => {
        expect(PIPE_SIZES[size]).toBeDefined();
        expect(PIPE_SIZES[size].od).toBeGreaterThan(0);
        expect(PIPE_SIZES[size].id).toBeGreaterThan(0);
        expect(PIPE_SIZES[size].od).toBeGreaterThan(PIPE_SIZES[size].id);
      });
    });

    it('should return correct outer diameter for 3/4" pipe', () => {
      const od = getPipeOuterDiameter('3/4"');
      expect(od).toBe(0.027); // 27mm
    });

    it('should return correct constraint rules for 3/4" steel pipe', () => {
      const rules = getPipeConstraintRules('3/4"', 'steel');
      
      expect(rules.minBendRadius).toBeCloseTo(0.108, 3); // 4x diameter for steel
      expect(rules.supportSpacing).toBe(3.05); // 10 feet for 3/4" pipe
      expect(rules.clearance.walls).toBe(0.05); // 2 inches
      expect(rules.clearance.floor).toBe(0.15); // 6 inches
    });

    it('should validate pipe sizes correctly', () => {
      expect(isValidPipeSize('3/4"')).toBe(true);
      expect(isValidPipeSize('invalid')).toBe(false);
    });

    it('should validate pipe materials correctly', () => {
      expect(isValidPipeMaterial('steel')).toBe(true);
      expect(isValidPipeMaterial('copper')).toBe(true);
      expect(isValidPipeMaterial('invalid')).toBe(false);
    });
  });

  describe('TC-SPECS2: Rules returned without code duplication', () => {
    it('should use unified getConstraintRules API for pipes', () => {
      const rules = getConstraintRules('pipe', { size: '3/4"', material: 'steel' });
      
      expect(rules.minBendRadius).toBeGreaterThan(0);
      expect(rules.supportSpacing).toBeGreaterThan(0);
      expect(rules.clearance).toBeDefined();
    });

    it('should use unified getConstraintRules API for cable trays', () => {
      const rules = getConstraintRules('cable_tray', { 
        size: '12"x4"', 
        material: 'aluminum',
        trayType: 'ladder'
      });
      
      expect(rules.minBendRadius).toBeGreaterThan(0);
      expect(rules.supportSpacing).toBeGreaterThan(0);
      expect(rules.clearance).toBeDefined();
    });

    it('should use unified getConstraintRules API for electrical cables', () => {
      const rules = getConstraintRules('electrical', { 
        gauge: '14 AWG',
        coreCount: 3,
        voltage: 120,
        insulationType: 'PVC'
      });
      
      expect(rules.minBendRadius).toBeGreaterThan(0);
      expect(rules.supportSpacing).toBeGreaterThan(0);
      expect(rules.clearance).toBeDefined();
    });

    it('should use unified getConstraintRules API for conduits', () => {
      const rules = getConstraintRules('conduit', { 
        size: '3/4"',
        conduitType: 'EMT',
        material: 'steel'
      });
      
      expect(rules.minBendRadius).toBeGreaterThan(0);
      expect(rules.supportSpacing).toBeGreaterThan(0);
      expect(rules.clearance).toBeDefined();
      expect(rules.maxRunLength).toBeDefined();
    });
  });

  describe('Cable Tray Specifications', () => {
    it('should have all standard cable tray sizes defined', () => {
      expect(CABLE_TRAY_SIZES['12"x4"']).toBeDefined();
      expect(CABLE_TRAY_SIZES['12"x4"'].width).toBe(0.3); // 300mm
      expect(CABLE_TRAY_SIZES['12"x4"'].height).toBe(0.1); // 100mm
    });

    it('should return correct dimensions for 12"x4" tray', () => {
      const dims = getCableTrayDimensions('12"x4"');
      expect(dims.width).toBe(0.3);
      expect(dims.height).toBe(0.1);
      expect(dims.loadRating).toBeGreaterThan(0);
    });

    it('should return correct constraint rules for aluminum ladder tray', () => {
      const rules = getCableTrayConstraintRules('12"x4"', 'aluminum', 'ladder');
      
      expect(rules.minBendRadius).toBeCloseTo(0.6, 3); // 2x width for aluminum
      expect(rules.supportSpacing).toBe(3.66); // 12 feet
    });

    it('should validate cable tray sizes correctly', () => {
      expect(isValidCableTraySize('12"x4"')).toBe(true);
      expect(isValidCableTraySize('invalid')).toBe(false);
    });
  });

  describe('Wiring Specifications', () => {
    it('should have AWG to metric conversion table', () => {
      expect(AWG_TO_METRIC['14 AWG']).toBeDefined();
      expect(AWG_TO_METRIC['14 AWG'].mm2).toBe(2.5);
      expect(AWG_TO_METRIC['14 AWG'].diameter).toBe(0.0025);
      expect(AWG_TO_METRIC['14 AWG'].maxCurrent).toBe(15);
    });

    it('should calculate cable diameter correctly', () => {
      const diameter = calculateCableDiameter('14 AWG', 3, 'PVC');
      expect(diameter).toBeGreaterThan(0);
      expect(diameter).toBeGreaterThan(0.0025); // Should be larger than single wire
    });

    it('should return correct color for voltage', () => {
      expect(getColorForVoltage(120)).toBe('#FFFF00'); // Yellow for 120V
      expect(getColorForVoltage(480)).toBe('#FF0000'); // Red for 480V
    });

    it('should recommend correct wire gauge for current', () => {
      expect(recommendWireGauge(15)).toBe('14 AWG');
      expect(recommendWireGauge(20)).toBe('12 AWG');
      expect(recommendWireGauge(30)).toBe('10 AWG');
    });

    it('should validate wire gauges correctly', () => {
      expect(isValidWireGauge('14 AWG')).toBe(true);
      expect(isValidWireGauge('invalid')).toBe(false);
    });

    it('should return correct constraint rules for 14 AWG cable', () => {
      const rules = getCableConstraintRules('14 AWG', 3, 120, 'PVC');
      
      expect(rules.minBendRadius).toBeGreaterThan(0);
      expect(rules.supportSpacing).toBe(1.37); // 4.5 feet for cables
      expect(rules.clearance.floor).toBe(0.2); // 8 inches for cables
    });
  });

  describe('Conduit Specifications', () => {
    it('should have all standard conduit sizes defined', () => {
      expect(CONDUIT_SIZES['3/4"']).toBeDefined();
      expect(CONDUIT_SIZES['3/4"'].od).toBe(0.023);
      expect(CONDUIT_SIZES['3/4"'].id).toBe(0.020);
      expect(CONDUIT_SIZES['3/4"'].maxWires14AWG).toBeGreaterThan(0);
    });

    it('should return correct dimensions for 3/4" conduit', () => {
      const dims = getConduitDimensions('3/4"');
      expect(dims.od).toBe(0.023);
      expect(dims.id).toBe(0.020);
      expect(dims.maxWires14AWG).toBe(16);
    });

    it('should return correct constraint rules for EMT conduit', () => {
      const rules = getConduitConstraintRules('3/4"', 'EMT', 'steel');
      
      expect(rules.minBendRadius).toBeCloseTo(0.138, 3); // 6x diameter for EMT
      expect(rules.supportSpacing).toBe(3.05); // 10 feet for 3/4" conduit
      expect(rules.maxRunLength).toBe(30.48); // 100 feet before junction box
    });

    it('should recommend correct conduit size for wire count', () => {
      expect(recommendConduitSize(9, '14 AWG')).toBe('1/2"');
      expect(recommendConduitSize(16, '14 AWG')).toBe('3/4"');
      expect(recommendConduitSize(26, '14 AWG')).toBe('1"');
    });

    it('should validate conduit sizes and types correctly', () => {
      expect(isValidConduitSize('3/4"')).toBe(true);
      expect(isValidConduitSize('invalid')).toBe(false);
      expect(isValidConduitType('EMT')).toBe(true);
      expect(isValidConduitType('invalid')).toBe(false);
    });
  });

  describe('Material Specifications', () => {
    it('should return steel pipe material with correct color', () => {
      const material = getPipeMaterialSpec('steel');
      expect(material.color).toBe('#808080'); // Gray
      expect(material.bendRadiusMultiplier).toBe(4.0);
    });

    it('should return copper pipe material with correct color', () => {
      const material = getPipeMaterialSpec('copper');
      expect(material.color).toBe('#B87333'); // Copper
      expect(material.bendRadiusMultiplier).toBe(2.5);
    });

    it('should return aluminum tray material with correct color', () => {
      const material = getCableTrayMaterialSpec('aluminum');
      expect(material.color).toBe('#C0C0C0'); // Silver
      expect(material.bendRadiusMultiplier).toBe(2.0);
    });
  });

  describe('BOM Export Schema', () => {
    it('should generate correct CSV header', () => {
      const header = getBOMCSVHeader();
      expect(header).toContain('Route Type');
      expect(header).toContain('Size');
      expect(header).toContain('Material');
      expect(header).toContain('Length (ft)');
      expect(header).toContain('Estimated Cost');
    });

    it('should convert BOM entry to CSV row', () => {
      const entry = {
        routeType: 'pipe' as const,
        routeId: 'route-1',
        size: '3/4"',
        material: 'steel',
        totalLength: 10,
        totalLengthFeet: 32.81,
        fittings: [
          { type: 'elbow' as const, angle: 90, count: 2, specification: '90° Elbow 3/4"' }
        ],
        supports: [
          { type: 'hanger' as const, specification: 'Pipe Hanger 3/4"', count: 3, spacing: 3.05 }
        ],
        estimatedCost: 245.50
      };

      const row = bomEntryToCSVRow(entry);
      expect(row).toContain('pipe');
      expect(row).toContain('route-1');
      expect(row).toContain('3/4"');
      expect(row).toContain('steel');
      expect(row).toContain('32.81');
      expect(row).toContain('2'); // Elbows
      expect(row).toContain('3'); // Supports
      expect(row).toContain('$245.50');
    });

    it('should generate complete BOM CSV', () => {
      const summary = {
        entries: [
          {
            routeType: 'pipe' as const,
            routeId: 'route-1',
            size: '3/4"',
            material: 'steel',
            totalLength: 10,
            totalLengthFeet: 32.81,
            fittings: [],
            supports: [{ type: 'hanger' as const, specification: 'Hanger', count: 3, spacing: 3.05 }],
            estimatedCost: 245.50
          }
        ],
        totals: {
          totalLength: 10,
          totalLengthFeet: 32.81,
          totalFittings: 0,
          totalSupports: 3,
          totalEstimatedCost: 245.50
        },
        metadata: {
          generatedAt: '2025-01-03T10:00:00Z',
          projectName: 'Test Project',
          version: '1.0'
        }
      };

      const csv = generateBOMCSV(summary);
      expect(csv).toContain(getBOMCSVHeader());
      expect(csv).toContain('route-1');
      expect(csv).toContain('TOTALS');
      expect(csv).toContain('Generated: 2025-01-03T10:00:00Z');
      expect(csv).toContain('Project: Test Project');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown pipe size', () => {
      expect(() => getPipeOuterDiameter('invalid')).toThrow('Unknown pipe size');
    });

    it('should throw error for unknown pipe material', () => {
      expect(() => getPipeConstraintRules('3/4"', 'invalid' as any)).toThrow('Unknown pipe material');
    });

    it('should throw error for unknown cable tray size', () => {
      expect(() => getCableTrayDimensions('invalid')).toThrow('Unknown cable tray size');
    });

    it('should throw error for unknown wire gauge', () => {
      expect(() => getWireSpec('invalid')).toThrow('Unknown wire gauge');
    });

    it('should throw error for unknown conduit size', () => {
      expect(() => getConduitDimensions('invalid')).toThrow('Unknown conduit size');
    });

    it('should throw error for unknown route type', () => {
      expect(() => getConstraintRules('invalid' as any, {})).toThrow('Unknown route type');
    });
  });
});
