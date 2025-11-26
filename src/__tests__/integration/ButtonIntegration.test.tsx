/**
 * Frontend-Backend Integration Tests
 * Owner: George
 *
 * Tests for the complete button system integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ButtonTemplate } from '../../ui/components/buttons/ButtonTemplate';
import { ButtonService } from '../../services/ButtonService';
import { useEditorStore } from '../../ui/store/editorStore';

// Mock the store
vi.mock('../../ui/store/editorStore');

// Mock fetch for HTTP requests
global.fetch = vi.fn();

// Mock WebSocket
class MockWebSocket {
  public readyState = WebSocket.OPEN;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 100);
  }

  send(_data: string) {
    // Mock send
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

(global as any).WebSocket = MockWebSocket;

describe('Frontend-Backend Button Integration', () => {
  let mockStore: any;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    // Reset store state
    mockStore = {
      buttonStates: {},
      buttonActions: {},
      buttonService: null,
      setButtonState: vi.fn(),
      getButtonState: vi.fn(),
      registerButtonAction: vi.fn(),
      executeButtonAction: vi.fn(),
      syncButtonState: vi.fn(),
      syncAllButtonStates: vi.fn()
    };

    (useEditorStore as jest.MockedFunction<typeof useEditorStore>).mockReturnValue(mockStore);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ButtonService HTTP API', () => {
    it('should get button state from backend', async () => {
      const mockResponse = { value: true, timestamp: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const service = new ButtonService();
      const result = await service.getButtonState('test-button');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/buttons/test-button/state');
      expect(result).toEqual(mockResponse);
    });

    it('should set button state on backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response);

      const service = new ButtonService();
      await service.setButtonState('test-button', true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/buttons/test-button/state',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: true, timestamp: expect.any(Number) })
        }
      );
    });

    it('should execute button action on backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response);

      const service = new ButtonService();
      await service.executeButtonAction('test-button', 'toggle');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/buttons/test-button/action',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle', value: undefined, timestamp: expect.any(Number) })
        }
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const service = new ButtonService();
      
      await expect(service.getButtonState('test-button')).rejects.toThrow('Network error');
    });
  });

  describe('ButtonService WebSocket', () => {
    it('should connect to WebSocket', () => {
      const service = new ButtonService();
      service.connectWebSocket();

      // WebSocket connection is mocked to open automatically
      expect(service.isConnected()).toBe(true);
    });

    it('should handle WebSocket messages', async () => {
      const service = new ButtonService();
      service.connectWebSocket();

      // Simulate receiving a state update message
      const mockMessage = {
        type: 'button_state_update',
        buttonId: 'test-button',
        value: true,
        timestamp: Date.now()
      };

      // Mock the WebSocket message event
      const mockEvent = new MessageEvent('message', {
        data: JSON.stringify(mockMessage)
      });

      // Trigger the message handler
      if (service['wsConnection']) {
        service['wsConnection'].onmessage(mockEvent);
      }

      // Wait for the store to be updated
      await waitFor(() => {
        expect(mockStore.setButtonState).toHaveBeenCalledWith('test-button', true);
      });
    });

    it('should handle WebSocket disconnection and reconnect', () => {
      const service = new ButtonService();
      service.connectWebSocket();

      // Simulate disconnection
      if (service['wsConnection']) {
        service['wsConnection'].close();
      }

      // Should attempt to reconnect
      expect(service['reconnectAttempts']).toBeGreaterThan(0);
    });

    it('should send ping messages', () => {
      const service = new ButtonService();
      service.connectWebSocket();

      const sendSpy = jest.spyOn(service['wsConnection'], 'send');
      service.ping();

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ping', timestamp: expect.any(Number) })
      );
    });
  });

  describe('Store Integration', () => {
    it('should sync button state from backend', async () => {
      const mockBackendState = { value: true, timestamp: Date.now() };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendState
      } as Response);

      const service = new ButtonService();
      mockStore.buttonService = service;

      // Mock the syncButtonState method
      mockStore.syncButtonState.mockImplementation(async (buttonId: string) => {
        const backendState = await service.getButtonState(buttonId);
        if (backendState) {
          mockStore.setButtonState(buttonId, backendState.value);
        }
      });

      await mockStore.syncButtonState('test-button');

      expect(mockStore.syncButtonState).toHaveBeenCalledWith('test-button');
      expect(mockStore.setButtonState).toHaveBeenCalledWith('test-button', true);
    });

    it('should sync all button states from backend', async () => {
      const mockBackendStates = [
        { id: 'button1', value: true },
        { id: 'button2', value: false }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBackendStates
      } as Response);

      const service = new ButtonService();
      mockStore.buttonService = service;

      // Mock the syncAllButtonStates method
      mockStore.syncAllButtonStates.mockImplementation(async () => {
        const backendStates = await service.getAllButtonStates();
        backendStates.forEach((state: any) => {
          mockStore.setButtonState(state.id, state.value);
        });
      });

      await mockStore.syncAllButtonStates();

      expect(mockStore.syncAllButtonStates).toHaveBeenCalled();
      expect(mockStore.setButtonState).toHaveBeenCalledWith('button1', true);
      expect(mockStore.setButtonState).toHaveBeenCalledWith('button2', false);
    });
  });

  describe('ButtonTemplate Integration', () => {
    it('should work with backend service', async () => {
      mockStore.getButtonState.mockReturnValue(false);
      mockStore.buttonService = new ButtonService();

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

    it('should handle backend communication errors gracefully', async () => {
      mockStore.getButtonState.mockReturnValue(false);
      mockStore.buttonService = new ButtonService();
      
      // Mock a failed backend call
      mockFetch.mockRejectedValueOnce(new Error('Backend error'));

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

      // Should still work locally even if backend fails
      expect(mockStore.executeButtonAction).toHaveBeenCalledWith('test-button', false);

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const service = new ButtonService();
      
      await expect(service.getButtonState('test-button')).rejects.toThrow('Network error');
    });

    it('should handle WebSocket connection failures', () => {
      // Mock WebSocket constructor to throw error
      const originalWebSocket = global.WebSocket;
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      });

      const service = new ButtonService();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.connectWebSocket();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect WebSocket:'),
        expect.any(Error)
      );

      // Restore original WebSocket
      global.WebSocket = originalWebSocket;
      consoleSpy.mockRestore();
    });

    it('should handle malformed WebSocket messages', () => {
      const service = new ButtonService();
      service.connectWebSocket();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simulate malformed message
      const mockEvent = new MessageEvent('message', {
        data: 'invalid json'
      });

      if (service['wsConnection']) {
        service['wsConnection'].onmessage(mockEvent);
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse WebSocket message:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
