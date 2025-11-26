/**
 * ARCHIVED – behaviour now covered by Playwright E2E tests.
 * See: tests/e2e/auto-kinematics/u112/*.spec.ts
 *
 * This suite is excluded in vitest.config.ts because it depends on WebGL/Babylon.js.
 * The Motion Panel UI interactions with tooling joints are now validated in a real browser
 * environment with full WebGL support via Playwright tests.
 *
 * Original purpose: Tests for Motion Panel UI interactions with tooling joints.
 * Part of U112 MOTION PANEL GOLD standard validation.
 *
 * See: docs/auto-kinematics/U112_MOTION_PANEL_GOLD.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { KinematicsManager, type KinematicChain } from '../../src/kinematics/KinematicsManager';

// Mock Motion Panel section (simplified for testing)
const MockToolingMotionSection: React.FC<{
  toolingChains: KinematicChain[];
  onJointChange: (jointId: string, value: number) => void;
}> = ({ toolingChains, onJointChange }) => {
  // Guard: No tooling chains
  if (toolingChains.length === 0) {
    return null;
  }

  return (
    <div data-testid="tooling-motion-section">
      <h3>Tooling Motion</h3>
      {toolingChains.map((chain) => (
        <div key={chain.id} data-testid={`tooling-chain-${chain.id}`}>
          <div data-testid="chain-name">{chain.name}</div>
          {chain.joints
            .filter((j) => j.type === 'revolute' || j.type === 'prismatic')
            .map((joint) => (
              <div key={joint.id} data-testid={`joint-${joint.id}`}>
                <label data-testid={`joint-label-${joint.id}`}>
                  {joint.name || joint.id}
                </label>
                <input
                  type="range"
                  data-testid={`joint-slider-${joint.id}`}
                  min={joint.limits.lower}
                  max={joint.limits.upper}
                  step={joint.type === 'revolute' ? Math.PI / 180 : 0.001}
                  value={joint.position}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    onJointChange(joint.id, value);
                  }}
                  aria-label={`Jog ${joint.name || joint.id}`}
                />
                <div data-testid={`joint-value-${joint.id}`}>
                  {joint.type === 'revolute'
                    ? `${((joint.position * 180) / Math.PI).toFixed(1)}°`
                    : `${(joint.position * 1000).toFixed(1)}mm`}
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
};

// Mock component to show hint when no joints
const MockNoJointsHint: React.FC = () => {
  return (
    <div data-testid="no-joints-hint">
      No tooling joints registered. Run Auto-Fit in Tooling Fixture Animator.
    </div>
  );
};

// Mock component to show hint when no fixture selected
const MockNoFixtureHint: React.FC = () => {
  return (
    <div data-testid="no-fixture-hint">
      Select a fixture root in the scene tree to control its motion.
    </div>
  );
};

describe('Motion Panel UI - U112 Tests', () => {
  let kinematicsManager: KinematicsManager;
  let mockOnJointChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    kinematicsManager = KinematicsManager.getInstance();
    kinematicsManager.reset();
    mockOnJointChange = vi.fn();
  });

  describe('Tooling Motion Section Rendering', () => {
    it('should render tooling motion section when tooling joints exist', () => {
      // Arrange
      const u112Chain: KinematicChain = {
        id: 'tooling_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101',
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(u112Chain);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert
      expect(screen.getByTestId('tooling-motion-section')).toBeInTheDocument();
      expect(screen.getByText('Tooling Motion')).toBeInTheDocument();
      expect(screen.getByTestId('tooling-chain-tooling_chain_u112')).toBeInTheDocument();
      expect(screen.getByTestId('chain-name')).toHaveTextContent('Tooling Animator Chain');
    });

    it('should render slider for revolute joint with correct attributes', () => {
      // Arrange
      const u112Chain: KinematicChain = {
        id: 'tooling_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101',
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: Math.PI / 4, // 45°
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(u112Chain);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert
      const slider = screen.getByTestId('joint-slider-joint_u112_hinge') as HTMLInputElement;
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', String(Math.PI / 2));
      expect(slider).toHaveValue(String(Math.PI / 4));

      const label = screen.getByTestId('joint-label-joint_u112_hinge');
      expect(label).toHaveTextContent('UNIT_112');

      const valueDisplay = screen.getByTestId('joint-value-joint_u112_hinge');
      expect(valueDisplay).toHaveTextContent('45.0°');
    });

    it('should call onJointChange when slider is moved', () => {
      // Arrange
      const u112Chain: KinematicChain = {
        id: 'tooling_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101',
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(u112Chain);
      const toolingChains = kinematicsManager.getToolingChains();

      const { rerender } = render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Act
      const slider = screen.getByTestId('joint-slider-joint_u112_hinge') as HTMLInputElement;
      slider.value = String(Math.PI / 4); // 45°
      slider.dispatchEvent(new Event('change', { bubbles: true }));

      // Assert
      expect(mockOnJointChange).toHaveBeenCalledWith('joint_u112_hinge', Math.PI / 4);
    });

    it('should render multiple joints in the same chain', () => {
      // Arrange
      const multiJointChain: KinematicChain = {
        id: 'multi_joint_chain',
        name: 'Multi-Joint Fixture',
        type: 'serial',
        rootNodeId: 'BASE',
        joints: [
          {
            id: 'joint_1',
            name: 'Clamp Jaw 1',
            type: 'revolute',
            parentNodeId: 'BASE',
            childNodeId: 'JAW_1',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 4, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
          {
            id: 'joint_2',
            name: 'Clamp Jaw 2',
            type: 'revolute',
            parentNodeId: 'BASE',
            childNodeId: 'JAW_2',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 4, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 2,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(multiJointChain);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert
      expect(screen.getByTestId('joint-joint_1')).toBeInTheDocument();
      expect(screen.getByTestId('joint-joint_2')).toBeInTheDocument();
      expect(screen.getByTestId('joint-label-joint_1')).toHaveTextContent('Clamp Jaw 1');
      expect(screen.getByTestId('joint-label-joint_2')).toHaveTextContent('Clamp Jaw 2');
    });

    it('should not render fixed joints (only revolute and prismatic)', () => {
      // Arrange
      const chainWithFixedJoint: KinematicChain = {
        id: 'chain_with_fixed',
        name: 'Chain With Fixed Joint',
        type: 'serial',
        rootNodeId: 'BASE',
        joints: [
          {
            id: 'joint_revolute',
            name: 'Revolute Joint',
            type: 'revolute',
            parentNodeId: 'BASE',
            childNodeId: 'LINK_1',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
          {
            id: 'joint_fixed',
            name: 'Fixed Joint',
            type: 'fixed',
            parentNodeId: 'LINK_1',
            childNodeId: 'LINK_2',
            axis: { x: 0, y: 0, z: 1 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: 0, velocity: 0, effort: 0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: false,
            showLimits: false,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(chainWithFixedJoint);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert
      expect(screen.getByTestId('joint-joint_revolute')).toBeInTheDocument();
      expect(screen.queryByTestId('joint-joint_fixed')).not.toBeInTheDocument();
    });
  });

  describe('No Joints Scenario', () => {
    it('should show hint when no tooling joints are registered', () => {
      // Arrange - No chains registered
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(<MockNoJointsHint />);

      // Assert
      expect(screen.getByTestId('no-joints-hint')).toBeInTheDocument();
      expect(screen.getByText(/No tooling joints registered/i)).toBeInTheDocument();
      expect(screen.getByText(/Run Auto-Fit in Tooling Fixture Animator/i)).toBeInTheDocument();
    });

    it('should not render tooling motion section when no chains exist', () => {
      // Arrange - No chains registered
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      const { container } = render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert
      expect(screen.queryByTestId('tooling-motion-section')).not.toBeInTheDocument();
    });
  });

  describe('No Fixture Selected Scenario', () => {
    it('should show hint when no fixture is selected', () => {
      // Act
      render(<MockNoFixtureHint />);

      // Assert
      expect(screen.getByTestId('no-fixture-hint')).toBeInTheDocument();
      expect(screen.getByText(/Select a fixture root in the scene tree/i)).toBeInTheDocument();
    });
  });

  describe('Guard Clause Behavior', () => {
    it('should handle empty joints array gracefully', () => {
      // Arrange - Chain with no joints
      const emptyChain: KinematicChain = {
        id: 'empty_chain',
        name: 'Empty Chain',
        type: 'serial',
        rootNodeId: 'BASE',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(emptyChain);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert - Section renders but no joint controls
      expect(screen.getByTestId('tooling-motion-section')).toBeInTheDocument();
      expect(screen.getByTestId('chain-name')).toHaveTextContent('Empty Chain');
      expect(screen.queryByTestId(/^joint-/)).not.toBeInTheDocument();
    });

    it('should handle invalid joint value without crashing', () => {
      // Arrange
      const u112Chain: KinematicChain = {
        id: 'tooling_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101',
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(u112Chain);
      const toolingChains = kinematicsManager.getToolingChains();

      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Act - Set invalid value
      const slider = screen.getByTestId('joint-slider-joint_u112_hinge') as HTMLInputElement;
      slider.value = 'invalid_number';
      slider.dispatchEvent(new Event('change', { bubbles: true }));

      // Assert - Should call with NaN (parseFloat returns NaN for invalid input)
      expect(mockOnJointChange).toHaveBeenCalledWith('joint_u112_hinge', NaN);
    });
  });

  describe('U112 GOLD Scenario', () => {
    it('should match U112 Gold Standard UI expectations', () => {
      // Arrange - U112 fixture with 1 hinge joint
      const u112Chain: KinematicChain = {
        id: 'tooling_animator_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101',
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 }, // 0° to 90°
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      kinematicsManager.registerToolingChain(u112Chain);
      const toolingChains = kinematicsManager.getToolingChains();

      // Act
      render(
        <MockToolingMotionSection
          toolingChains={toolingChains}
          onJointChange={mockOnJointChange}
        />
      );

      // Assert - Invariant 2: Motion Panel Discovery
      expect(screen.getByTestId('tooling-motion-section')).toBeInTheDocument();
      expect(screen.getByText('Tooling Motion')).toBeInTheDocument();

      // Assert - Exactly 1 slider
      const sliders = screen.getAllByRole('slider');
      expect(sliders).toHaveLength(1);

      // Assert - Slider range matches joint limits (0° to 90°)
      const slider = screen.getByTestId('joint-slider-joint_u112_hinge') as HTMLInputElement;
      expect(slider.min).toBe('0');
      expect(slider.max).toBe(String(Math.PI / 2));

      // Assert - Initial value is 0
      expect(slider.value).toBe('0');

      // Assert - Label shows joint/unit name
      const label = screen.getByTestId('joint-label-joint_u112_hinge');
      expect(label).toHaveTextContent('UNIT_112');

      // Assert - Value display shows degrees
      const valueDisplay = screen.getByTestId('joint-value-joint_u112_hinge');
      expect(valueDisplay).toHaveTextContent('0.0°');
    });
  });
});
