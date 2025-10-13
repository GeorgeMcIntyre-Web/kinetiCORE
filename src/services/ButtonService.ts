/**
 * Frontend Button Service
 * Owner: George
 * 
 * Client-side service for communicating with backend button API
 */

export interface ButtonStateUpdate {
  buttonId: string;
  value: any;
  timestamp: number;
}

export interface ButtonActionRequest {
  buttonId: string;
  action: string;
  value?: any;
  timestamp: number;
}

export class ButtonService {
  private baseUrl: string;
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  // HTTP API Methods
  async getButtonState(buttonId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buttons/${buttonId}/state`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[ButtonService] Failed to get state for ${buttonId}:`, error);
      throw error;
    }
  }

  async setButtonState(buttonId: string, value: any): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buttons/${buttonId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, timestamp: Date.now() })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error(`[ButtonService] Failed to set state for ${buttonId}:`, error);
      throw error;
    }
  }

  async executeButtonAction(buttonId: string, action: string, value?: any): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buttons/${buttonId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value, timestamp: Date.now() })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error(`[ButtonService] Failed to execute action for ${buttonId}:`, error);
      throw error;
    }
  }

  // WebSocket Methods
  connectWebSocket(): void {
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws');
      this.wsConnection = new WebSocket(`${wsUrl}/ws/buttons`);
      
      this.wsConnection.onopen = () => {
        console.log('[ButtonService] WebSocket connected');
        this.reconnectAttempts = 0;
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('[ButtonService] Failed to parse WebSocket message:', error);
        }
      };
      
      this.wsConnection.onclose = () => {
        console.log('[ButtonService] WebSocket disconnected');
        this.reconnect();
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('[ButtonService] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[ButtonService] Failed to connect WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: any): void {
    // Import useEditorStore dynamically to avoid circular dependencies
    import('../ui/store/editorStore').then(({ useEditorStore }) => {
      const store = useEditorStore.getState();
      
      switch (data.type) {
        case 'button_state_update':
          store.setButtonState(data.buttonId, data.value);
          console.log(`[ButtonService] Received state update: ${data.buttonId} = ${data.value}`);
          break;
          
        case 'button_action_request':
          store.executeButtonAction(data.buttonId, data.value);
          console.log(`[ButtonService] Received action request: ${data.buttonId}`);
          break;
          
        case 'initial_state':
          console.log('[ButtonService] Received initial state:', data.buttons);
          // Apply initial state to store
          if (data.buttons) {
            Object.entries(data.buttons).forEach(([buttonId, value]) => {
              store.setButtonState(buttonId, value);
            });
          }
          break;
          
        case 'pong':
          console.log('[ButtonService] Received pong from server');
          break;
          
        default:
          console.warn('[ButtonService] Unknown message type:', data.type);
      }
    }).catch(error => {
      console.error('[ButtonService] Failed to import editorStore:', error);
    });
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`[ButtonService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      console.error('[ButtonService] Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // Send ping to keep connection alive
  ping(): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.wsConnection !== null && this.wsConnection.readyState === WebSocket.OPEN;
  }

  // Get connection info
  getConnectionInfo(): { connected: boolean; attempts: number; maxAttempts: number } {
    return {
      connected: this.isConnected(),
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    };
  }
}
