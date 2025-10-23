/**
 * Unit Tests for ROS Time Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  toROSTime,
  fromROSTime,
  addROSTime,
  subtractROSTime,
  compareROSTime
} from './time';

describe('ROS Time Utilities', () => {
  describe('toROSTime', () => {
    it('should convert whole seconds correctly', () => {
      const result = toROSTime(5);
      expect(result.sec).toBe(5);
      expect(result.nanosec).toBe(0);
    });

    it('should convert fractional seconds correctly', () => {
      const result = toROSTime(1.5);
      expect(result.sec).toBe(1);
      expect(result.nanosec).toBe(500000000); // 0.5 * 1e9
    });

    it('should handle zero', () => {
      const result = toROSTime(0);
      expect(result.sec).toBe(0);
      expect(result.nanosec).toBe(0);
    });

    it('should handle very small fractions', () => {
      const result = toROSTime(0.000000001); // 1 nanosecond
      expect(result.sec).toBe(0);
      expect(result.nanosec).toBe(1);
    });
  });

  describe('fromROSTime', () => {
    it('should convert ROS time to seconds', () => {
      const result = fromROSTime({ sec: 5, nanosec: 0 });
      expect(result).toBe(5);
    });

    it('should handle fractional seconds', () => {
      const result = fromROSTime({ sec: 1, nanosec: 500000000 });
      expect(result).toBe(1.5);
    });

    it('should be inverse of toROSTime', () => {
      const original = 3.14159;
      const rosTime = toROSTime(original);
      const converted = fromROSTime(rosTime);
      expect(converted).toBeCloseTo(original, 6);
    });
  });

  describe('addROSTime', () => {
    it('should add simple times', () => {
      const a = { sec: 1, nanosec: 0 };
      const b = { sec: 2, nanosec: 0 };
      const result = addROSTime(a, b);
      expect(result.sec).toBe(3);
      expect(result.nanosec).toBe(0);
    });

    it('should handle nanosecond overflow', () => {
      const a = { sec: 1, nanosec: 700000000 };
      const b = { sec: 0, nanosec: 400000000 };
      const result = addROSTime(a, b);
      expect(result.sec).toBe(2);
      expect(result.nanosec).toBe(100000000);
    });

    it('should handle zero addition', () => {
      const a = { sec: 5, nanosec: 123456789 };
      const b = { sec: 0, nanosec: 0 };
      const result = addROSTime(a, b);
      expect(result).toEqual(a);
    });
  });

  describe('subtractROSTime', () => {
    it('should subtract simple times', () => {
      const a = { sec: 5, nanosec: 0 };
      const b = { sec: 2, nanosec: 0 };
      const result = subtractROSTime(a, b);
      expect(result.sec).toBe(3);
      expect(result.nanosec).toBe(0);
    });

    it('should handle nanosecond borrowing', () => {
      const a = { sec: 2, nanosec: 100000000 };
      const b = { sec: 0, nanosec: 200000000 };
      const result = subtractROSTime(a, b);
      expect(result.sec).toBe(1);
      expect(result.nanosec).toBe(900000000);
    });

    it('should return zero when subtracting same time', () => {
      const a = { sec: 5, nanosec: 123456789 };
      const result = subtractROSTime(a, a);
      expect(result.sec).toBe(0);
      expect(result.nanosec).toBe(0);
    });
  });

  describe('compareROSTime', () => {
    it('should return 0 for equal times', () => {
      const a = { sec: 5, nanosec: 123 };
      const b = { sec: 5, nanosec: 123 };
      expect(compareROSTime(a, b)).toBe(0);
    });

    it('should return -1 when a < b (seconds)', () => {
      const a = { sec: 3, nanosec: 999999999 };
      const b = { sec: 4, nanosec: 0 };
      expect(compareROSTime(a, b)).toBe(-1);
    });

    it('should return 1 when a > b (seconds)', () => {
      const a = { sec: 5, nanosec: 0 };
      const b = { sec: 4, nanosec: 999999999 };
      expect(compareROSTime(a, b)).toBe(1);
    });

    it('should return -1 when a < b (nanoseconds)', () => {
      const a = { sec: 5, nanosec: 100 };
      const b = { sec: 5, nanosec: 200 };
      expect(compareROSTime(a, b)).toBe(-1);
    });

    it('should return 1 when a > b (nanoseconds)', () => {
      const a = { sec: 5, nanosec: 200 };
      const b = { sec: 5, nanosec: 100 };
      expect(compareROSTime(a, b)).toBe(1);
    });
  });
});
