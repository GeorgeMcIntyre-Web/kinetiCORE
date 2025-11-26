/**
 * Button System Tests
 * Owner: George
 *
 * Comprehensive tests for the systematic button implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ButtonTemplate } from '../../ui/components/buttons/ButtonTemplate';
import { SnapTypeButton } from '../../ui/components/buttons/SnapTypeButton';
import { useEditorStore } from '../../ui/store/editorStore';

// Mock the store
vi.mock('../../ui/store/editorStore');

const mockUseEditorStore = useEditorStore as ReturnType<typeof vi.fn>;

describe('Button System Tests', () => {
  let mockStore: any;

  beforeEach(() => {
    // Reset store state
    mockStore = {
      buttonStates: {},
      buttonActions: {},
      setButtonState: vi.fn(),
      getButtonState: vi.fn(),
      registerButtonAction: vi.fn(),
      executeButtonAction: vi.fn(),
      setSnapEnabled: vi.fn(),
      setSnapToVertex: vi.fn(),
      setSnapToEdge: vi.fn(),
      setSnapToFace: vi.fn(),
      setSnapToCenter: vi.fn(),
      setSnapToObject: vi.fn(),
      setSnapToMidpoint: vi.fn(),
      setSnapToIntersection: vi.fn(),
      setSnapToPerpendicular: vi.fn(),
      setSnapToTangent: vi.fn(),
      setSnapAlong: vi.fn(),
      setSnapToNormal: vi.fn(),
      setSnapToPlane: vi.fn(),
      setSnapToGrid: vi.fn(),
      setSnapDistance: vi.fn()
    };

    mockUseEditorStore.mockReturnValue(mockStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ButtonTemplate', () => {
    it('should initialize with default state', () => {
      mockStore.getButtonState.mockReturnValue(undefined);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(button).toHaveAttribute('data-button-id', 'test-button');
      expect(button).toHaveAttribute('data-button-action', 'test action');
      
      // Should initialize state
      expect(mockStore.setButtonState).toHaveBeenCalledWith('test-button', false);
    });

    it('should toggle boolean state on click', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockStore.executeButtonAction).toHaveBeenCalledWith('test-button', false);
    });

    it('should register button action on mount', () => {
      mockStore.getButtonState.mockReturnValue(undefined);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      expect(mockStore.registerButtonAction).toHaveBeenCalledWith('test-button', expect.any(Function));
    });

    it('should handle keyboard shortcuts', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
          keyboardShortcut="t"
        />
      );
      
      // Simulate Ctrl+T
      fireEvent.keyDown(document, { key: 't', ctrlKey: true });
      
      expect(mockStore.executeButtonAction).toHaveBeenCalledWith('test-button', false);
    });

    it('should show loading state', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
          loading={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(''); // Should show loading spinner
    });

    it('should be disabled when disabled prop is true', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
          disabled={true}
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('SnapTypeButton', () => {
    it('should render with correct props', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <SnapTypeButton 
          snapType="vertex" 
          label="Vertex" 
          icon="circle" 
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Toggle Vertex snapping');
      expect(button).toHaveAttribute('data-button-id', 'snap_vertex');
    });

    it('should call correct store method', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <SnapTypeButton 
          snapType="vertex" 
          label="Vertex" 
          icon="circle" 
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockStore.executeButtonAction).toHaveBeenCalledWith('snap_vertex', false);
    });

    it('should handle keyboard shortcut', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      render(
        <SnapTypeButton 
          snapType="vertex" 
          label="Vertex" 
          icon="circle" 
        />
      );
      
      // Simulate Ctrl+V (first letter of "vertex")
      fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
      
      expect(mockStore.executeButtonAction).toHaveBeenCalledWith('snap_vertex', false);
    });
  });

  describe('Button State Management', () => {
    it('should persist state across re-renders', () => {
      mockStore.getButtonState.mockReturnValue(true);
      
      const { rerender } = render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      
      // Re-render
      rerender(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      // State should persist
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should handle multiple buttons independently', () => {
      mockStore.getButtonState.mockImplementation((id) => {
        if (id === 'button1') return true;
        if (id === 'button2') return false;
        return undefined;
      });
      
      render(
        <div>
          <ButtonTemplate
            id="button1"
            label="Button 1"
            action="action 1"
            stateKey="button1"
            initialState={false}
            stateType="boolean"
            variant="primary"
            size="md"
            ariaLabel="Button 1"
          />
          <ButtonTemplate
            id="button2"
            label="Button 2"
            action="action 2"
            stateKey="button2"
            initialState={false}
            stateType="boolean"
            variant="primary"
            size="md"
            ariaLabel="Button 2"
          />
        </div>
      );
      
      const button1 = screen.getByLabelText('Button 1');
      const button2 = screen.getByLabelText('Button 2');
      
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing store method gracefully', () => {
      mockStore.getButtonState.mockReturnValue(false);
      
      // Mock console.warn to avoid test noise
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
          storeMethod="nonExistentMethod"
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Store method not found: nonExistentMethod')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle action execution errors', () => {
      mockStore.getButtonState.mockReturnValue(false);
      mockStore.executeButtonAction.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <ButtonTemplate
          id="test-button"
          label="Test Button"
          action="test action"
          stateKey="test"
          initialState={false}
          stateType="boolean"
          variant="primary"
          size="md"
          ariaLabel="Test button"
        />
      );
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error executing button test-button:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});
