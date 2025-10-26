/**
 * MJCF Integration Tests
 * Owner: George & Edwin
 * 
 * Comprehensive tests for the MJCF kinematic system integration
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MJCFIntegration } from '../../ui/components/MJCFIntegration';
import { DeviceLibrary } from '../../ui/components/DeviceLibrary';
import { ActuatorControlPanel } from '../../ui/components/ActuatorControlPanel';
import { PhysicsSettings } from '../../ui/components/PhysicsSettings';
import { CollisionVisualizer } from '../../ui/components/CollisionVisualizer';

import { vi } from 'vitest';

// Mock the editor store
vi.mock('../../ui/store/editorStore');

describe('MJCF Integration Tests', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('MJCFIntegration', () => {
    it('should render without crashing', () => {
      render(<MJCFIntegration />);
      expect(screen.getByText('📚 Device Library')).toBeInTheDocument();
    });

    it('should open device library panel when clicked', () => {
      render(<MJCFIntegration />);
      
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      fireEvent.click(deviceLibraryButton);
      
      expect(screen.getByText('Device Library')).toBeInTheDocument();
    });

    it('should open actuator control panel when clicked', () => {
      render(<MJCFIntegration />);
      
      const actuatorButton = screen.getByText('🎮 Actuator Control');
      fireEvent.click(actuatorButton);
      
      expect(screen.getByText('Actuator Control')).toBeInTheDocument();
    });

    it('should open physics settings panel when clicked', () => {
      render(<MJCFIntegration />);
      
      const physicsButton = screen.getByText('⚙️ Physics Settings');
      fireEvent.click(physicsButton);
      
      expect(screen.getByText('Physics Settings')).toBeInTheDocument();
    });

    it('should toggle collision visualizer when clicked', () => {
      render(<MJCFIntegration />);
      
      const collisionButton = screen.getByText('💥 Collision Visualizer');
      fireEvent.click(collisionButton);
      
      // Should show collision visualizer
      expect(screen.getByText('Collision Visualizer')).toBeInTheDocument();
      
      // Click again to toggle off
      fireEvent.click(collisionButton);
      
      // Should hide collision visualizer
      expect(screen.queryByText('Collision Visualizer')).not.toBeInTheDocument();
    });

    it('should close panel when close button is clicked', () => {
      render(<MJCFIntegration />);
      
      // Open device library
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      fireEvent.click(deviceLibraryButton);
      
      expect(screen.getByText('Device Library')).toBeInTheDocument();
      
      // Close panel
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);
      
      // Panel should be closed
      expect(screen.queryByText('Device Library')).not.toBeInTheDocument();
    });

    it('should only show one panel at a time', () => {
      render(<MJCFIntegration />);
      
      // Open device library
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      fireEvent.click(deviceLibraryButton);
      
      expect(screen.getByText('Device Library')).toBeInTheDocument();
      
      // Open actuator control
      const actuatorButton = screen.getByText('🎮 Actuator Control');
      fireEvent.click(actuatorButton);
      
      // Device library should be closed, actuator control should be open
      expect(screen.queryByText('Device Library')).not.toBeInTheDocument();
      expect(screen.getByText('Actuator Control')).toBeInTheDocument();
    });
  });

  describe('DeviceLibrary', () => {
    it('should render device library with search functionality', () => {
      render(<DeviceLibrary />);
      
      expect(screen.getByText('Device Library')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search devices...')).toBeInTheDocument();
    });

    it('should filter devices based on search query', () => {
      render(<DeviceLibrary />);
      
      const searchInput = screen.getByPlaceholderText('Search devices...');
      fireEvent.change(searchInput, { target: { value: 'Schunk' } });
      
      expect(screen.getByText('Schunk PGN-Plus 125')).toBeInTheDocument();
      expect(screen.queryByText('Robotiq 2F-85')).not.toBeInTheDocument();
    });

    it('should filter devices by category', () => {
      render(<DeviceLibrary />);
      
      const grippersButton = screen.getByText('Grippers');
      fireEvent.click(grippersButton);
      
      expect(screen.getByText('Schunk PGN-Plus 125')).toBeInTheDocument();
      expect(screen.queryByText('Pneumatic Ball Valve')).not.toBeInTheDocument();
    });

    it('should select device when clicked', () => {
      render(<DeviceLibrary />);
      
      const deviceItem = screen.getByText('Schunk PGN-Plus 125');
      fireEvent.click(deviceItem);
      
      expect(screen.getByText('Add to Scene')).toBeInTheDocument();
    });

    it('should show device details when selected', () => {
      render(<DeviceLibrary />);
      
      const deviceItem = screen.getByText('Schunk PGN-Plus 125');
      fireEvent.click(deviceItem);
      
      expect(screen.getByText('2 joints, 1 actuators')).toBeInTheDocument();
    });
  });

  describe('ActuatorControlPanel', () => {
    it('should render actuator control panel with device info', () => {
      render(<ActuatorControlPanel />);
      
      expect(screen.getByText('Actuator Control')).toBeInTheDocument();
      expect(screen.getByText('Schunk PGN-Plus 125')).toBeInTheDocument();
    });

    it('should show device status', () => {
      render(<ActuatorControlPanel />);
      
      expect(screen.getByText('Device Status')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should have quick action buttons', () => {
      render(<ActuatorControlPanel />);
      
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should have manual control sliders', () => {
      render(<ActuatorControlPanel />);
      
      expect(screen.getByText('Position')).toBeInTheDocument();
      expect(screen.getByText('Force')).toBeInTheDocument();
      expect(screen.getByText('Speed')).toBeInTheDocument();
    });

    it('should show joint states', () => {
      render(<ActuatorControlPanel />);
      
      expect(screen.getByText('Joint States')).toBeInTheDocument();
      expect(screen.getByText('Finger 1 Joint')).toBeInTheDocument();
      expect(screen.getByText('Finger 2 Joint')).toBeInTheDocument();
    });

    it('should execute quick actions', () => {
      render(<ActuatorControlPanel />);
      
      const openButton = screen.getByText('Open');
      fireEvent.click(openButton);
      
      // Should show moving state
      expect(screen.getByText('Moving')).toBeInTheDocument();
    });
  });

  describe('PhysicsSettings', () => {
    it('should render physics settings panel', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Physics Settings')).toBeInTheDocument();
    });

    it('should show current engine status', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Current Engine: Rapier')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should show engine comparison', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Engine Comparison')).toBeInTheDocument();
      expect(screen.getByText('Rapier')).toBeInTheDocument();
      expect(screen.getByText('Havok')).toBeInTheDocument();
    });

    it('should have engine switch button', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Switch to Havok')).toBeInTheDocument();
    });

    it('should show advanced settings', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(screen.getByText('Gravity (m/s²)')).toBeInTheDocument();
      expect(screen.getByText('Solver Iterations')).toBeInTheDocument();
    });

    it('should handle engine switching', async () => {
      render(<PhysicsSettings />);
      
      const switchButton = screen.getByText('Switch to Havok');
      fireEvent.click(switchButton);
      
      // Should show switching progress
      expect(screen.getByText('Switching engine...')).toBeInTheDocument();
      
      // Wait for switching to complete
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Havok')).toBeInTheDocument();
      });
    });
  });

  describe('CollisionVisualizer', () => {
    it('should render collision visualizer', () => {
      render(<CollisionVisualizer />);
      
      expect(screen.getByText('Collision Visualizer')).toBeInTheDocument();
    });

    it('should show collision status overview', () => {
      render(<CollisionVisualizer />);
      
      expect(screen.getByText('Collision Status')).toBeInTheDocument();
      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Collision')).toBeInTheDocument();
    });

    it('should list collision pairs', () => {
      render(<CollisionVisualizer />);
      
      expect(screen.getByText('Collision Pairs')).toBeInTheDocument();
      expect(screen.getByText('finger_1_joint ↔ finger_2_joint')).toBeInTheDocument();
    });

    it('should show visualization settings', () => {
      render(<CollisionVisualizer />);
      
      expect(screen.getByText('Visualization Settings')).toBeInTheDocument();
      expect(screen.getByText('Show Distance Labels')).toBeInTheDocument();
      expect(screen.getByText('Show Contact Points')).toBeInTheDocument();
    });

    it('should toggle visualization settings', () => {
      render(<CollisionVisualizer />);
      
      const toggleButton = screen.getByText('On');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Off')).toBeInTheDocument();
    });

    it('should select collision pair when clicked', () => {
      render(<CollisionVisualizer />);
      
      const collisionPair = screen.getByText('finger_1_joint ↔ finger_2_joint');
      fireEvent.click(collisionPair);
      
      expect(screen.getByText('Clearance:')).toBeInTheDocument();
    });
  });

  describe('Integration Workflow', () => {
    it('should complete full device workflow', async () => {
      render(<MJCFIntegration />);
      
      // 1. Open device library
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      fireEvent.click(deviceLibraryButton);
      
      // 2. Select a device
      const deviceItem = screen.getByText('Schunk PGN-Plus 125');
      fireEvent.click(deviceItem);
      
      // 3. Add device to scene
      const addButton = screen.getByText('Add to Scene');
      fireEvent.click(addButton);
      
      // 4. Close device library
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);
      
      // 5. Open actuator control
      const actuatorButton = screen.getByText('🎮 Actuator Control');
      fireEvent.click(actuatorButton);
      
      // 6. Control the device
      const openButton = screen.getByText('Open');
      fireEvent.click(openButton);
      
      // 7. Enable collision visualization
      const collisionButton = screen.getByText('💥 Collision Visualizer');
      fireEvent.click(collisionButton);
      
      // All components should be working together
      expect(screen.getByText('Actuator Control')).toBeInTheDocument();
      expect(screen.getByText('Collision Visualizer')).toBeInTheDocument();
    });

    it('should handle physics engine switching', async () => {
      render(<MJCFIntegration />);
      
      // Open physics settings
      const physicsButton = screen.getByText('⚙️ Physics Settings');
      fireEvent.click(physicsButton);
      
      // Switch to Havok
      const switchButton = screen.getByText('Switch to Havok');
      fireEvent.click(switchButton);
      
      // Wait for switch to complete
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Havok')).toBeInTheDocument();
      });
      
      // Switch back to Rapier
      const switchBackButton = screen.getByText('Switch to Rapier');
      fireEvent.click(switchBackButton);
      
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Rapier')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing props gracefully', () => {
      render(<MJCFIntegration />);
      
      // Should render without crashing
      expect(screen.getByText('📚 Device Library')).toBeInTheDocument();
    });

    it('should handle rapid panel switching', () => {
      render(<MJCFIntegration />);
      
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      const actuatorButton = screen.getByText('🎮 Actuator Control');
      
      // Rapidly switch between panels
      fireEvent.click(deviceLibraryButton);
      fireEvent.click(actuatorButton);
      fireEvent.click(deviceLibraryButton);
      fireEvent.click(actuatorButton);
      
      // Should end up with actuator control open
      expect(screen.getByText('Actuator Control')).toBeInTheDocument();
      expect(screen.queryByText('Device Library')).not.toBeInTheDocument();
    });
  });
});
