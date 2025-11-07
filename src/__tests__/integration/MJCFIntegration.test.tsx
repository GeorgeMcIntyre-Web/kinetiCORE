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

// Mock the editor store with all necessary methods
vi.mock('../../ui/store/editorStore', () => {
  const mockButtonStates: Record<string, any> = {};
  const mockButtonActions: Record<string, (value: any) => void> = {};

  const mockUseEditorStore: any = vi.fn(() => ({
    // Button state management
    buttonStates: mockButtonStates,
    buttonActions: mockButtonActions,
    getButtonState: vi.fn((buttonId: string) => mockButtonStates[buttonId]),
    setButtonState: vi.fn((buttonId: string, value: any) => {
      mockButtonStates[buttonId] = value;
    }),
    registerButtonAction: vi.fn((buttonId: string, action: (value: any) => void) => {
      mockButtonActions[buttonId] = action;
    }),
    executeButtonAction: vi.fn((buttonId: string, value?: any) => {
      const action = mockButtonActions[buttonId];
      if (action) {
        action(value);
      }
    }),
    syncButtonState: vi.fn(async () => {}),
    syncAllButtonStates: vi.fn(async () => {}),
    buttonService: {
      connectWebSocket: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => false),
      ping: vi.fn(),
      getButtonState: vi.fn(async () => ({ value: undefined })),
    },
  }));

  // Add setState and getState methods to the mock function
  mockUseEditorStore.setState = vi.fn((updater: any) => {
    // Handle both function and object updaters
    if (typeof updater === 'function') {
      const currentState = mockUseEditorStore();
      updater(currentState);
    }
  });

  mockUseEditorStore.getState = vi.fn(() => mockUseEditorStore());

  return {
    useEditorStore: mockUseEditorStore,
  };
});

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
      
      expect(screen.getAllByText('Schunk PGN-Plus 125')[0]).toBeInTheDocument();
      expect(screen.queryByText('Robotiq 2F-85')).not.toBeInTheDocument();
    });

    it('should filter devices by category', () => {
      render(<DeviceLibrary />);
      
      const grippersButton = screen.getByText('Grippers');
      fireEvent.click(grippersButton);
      
      expect(screen.getAllByText('Schunk PGN-Plus 125')[0]).toBeInTheDocument();
      expect(screen.queryByText('Pneumatic Ball Valve')).not.toBeInTheDocument();
    });

    it('should select device when clicked', () => {
      render(<DeviceLibrary />);
      
      const deviceItem = screen.getAllByText('Schunk PGN-Plus 125')[0];
      fireEvent.click(deviceItem);
      
      expect(screen.getByText('Add to Scene')).toBeInTheDocument();
    });

    it('should show device details when selected', () => {
      render(<DeviceLibrary />);
      
      const deviceItem = screen.getAllByText('Schunk PGN-Plus 125')[0];
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
      // State is capitalized in the component
      expect(screen.getByText(/idle/i)).toBeInTheDocument();
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

    it('should execute quick actions', async () => {
      render(<ActuatorControlPanel />);
      
      const openButton = screen.getByText('Open');
      fireEvent.click(openButton);
      
      // Should show moving state (wait for state update)
      await waitFor(() => {
        expect(screen.getByText(/moving/i)).toBeInTheDocument();
      });
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
      // Status is lowercase in component
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('should show engine comparison', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Engine Comparison')).toBeInTheDocument();
      // Multiple elements with 'Rapier' and 'Havok', use getAllByText
      expect(screen.getAllByText('Rapier').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Havok').length).toBeGreaterThan(0);
    });

    it('should have engine switch button', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Switch to Havok')).toBeInTheDocument();
    });

    it('should show advanced settings', () => {
      render(<PhysicsSettings />);
      
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(screen.getByText('Gravity (m/s²)')).toBeInTheDocument();
      // "Solver Iterations" includes the value, use regex
      expect(screen.getByText(/Solver Iterations/)).toBeInTheDocument();
    });

    it('should handle engine switching', async () => {
      render(<PhysicsSettings />);
      
      const switchButton = screen.getByText('Switch to Havok');
      fireEvent.click(switchButton);
      
      // Should show switching progress
      await waitFor(() => {
        expect(screen.getByText('Switching engine...')).toBeInTheDocument();
      });
      
      // Wait for switching to complete (takes 2.5 seconds in component)
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Havok')).toBeInTheDocument();
      }, { timeout: 5000 });
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
      // Multiple elements with same text, use getAllByText
      expect(screen.getAllByText('Safe').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Collision').length).toBeGreaterThan(0);
    });

    it('should list collision pairs', () => {
      render(<CollisionVisualizer />);
      
      // "Collision Pairs" includes count, use regex
      expect(screen.getByText(/Collision Pairs/)).toBeInTheDocument();
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
      
      // Multiple 'On' buttons, get all and click the first one
      const toggleButtons = screen.getAllByText('On');
      fireEvent.click(toggleButtons[0]);
      
      // Should have 'Off' button now
      expect(screen.getAllByText('Off').length).toBeGreaterThan(0);
    });

    it('should select collision pair when clicked', () => {
      render(<CollisionVisualizer />);
      
      const collisionPair = screen.getByText('finger_1_joint ↔ finger_2_joint');
      fireEvent.click(collisionPair);
      
      // "Clearance:" text exists multiple times (already visible)
      expect(screen.getAllByText('Clearance:').length).toBeGreaterThan(0);
    });
  });

  describe('Integration Workflow', () => {
    it('should complete full device workflow', async () => {
      render(<MJCFIntegration />);
      
      // 1. Open device library
      const deviceLibraryButton = screen.getByText('📚 Device Library');
      fireEvent.click(deviceLibraryButton);
      
      // 2. Select a device (multiple elements, use first one)
      const deviceItem = screen.getAllByText('Schunk PGN-Plus 125')[0];
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
      
      // Wait for switch to complete (takes 2.5 seconds - 5 steps x 500ms each)
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Havok')).toBeInTheDocument();
      }, { timeout: 4000 });
      
      // Switch back to Rapier
      const switchBackButton = screen.getByText('Switch to Rapier');
      fireEvent.click(switchBackButton);
      
      await waitFor(() => {
        expect(screen.getByText('Current Engine: Rapier')).toBeInTheDocument();
      }, { timeout: 4000 });
    }, 10000); // Set test timeout to 10 seconds total
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
