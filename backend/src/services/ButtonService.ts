/**
 * Backend Button Service
 * Owner: George
 * 
 * Core business logic for button state management and actions
 */

export interface ButtonState {
  id: string;
  value: any;
  timestamp: number;
  lastModified: number;
  userId?: string;
  sessionId?: string;
}

export interface ButtonAction {
  id: string;
  buttonId: string;
  action: string;
  value?: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

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
  private buttonStates = new Map<string, ButtonState>();
  private buttonActions = new Map<string, ButtonAction>();
  private wsService: any; // WebSocketService will be injected

  constructor(wsService?: any) {
    this.wsService = wsService;
    this.initializeDefaultStates();
  }

  private initializeDefaultStates(): void {
    // Initialize essential button states
    const essentialButtons = [
      { id: 'snap_master_toggle', value: false },
      { id: 'snap_vertex', value: false },
      { id: 'snap_edge', value: false },
      { id: 'snap_face', value: false },
      { id: 'snap_center', value: false },
      { id: 'snap_object', value: false },
      { id: 'snap_midpoint', value: false },
      { id: 'snap_intersection', value: false },
      { id: 'snap_perpendicular', value: false },
      { id: 'snap_tangent', value: false },
      { id: 'snap_along', value: false },
      { id: 'snap_normal', value: false },
      { id: 'snap_plane', value: false },
      { id: 'snap_grid_toggle', value: false },
      { id: 'transform_mode', value: 'move' },
      { id: 'file_save', value: false },
      { id: 'file_open', value: false },
      { id: 'file_new', value: false }
    ];

    essentialButtons.forEach(button => {
      this.setButtonState(button.id, button.value);
    });

    console.log('[ButtonService] Initialized essential button states');
  }

  getButtonState(buttonId: string): ButtonState | undefined {
    return this.buttonStates.get(buttonId);
  }

  setButtonState(buttonId: string, value: any, userId?: string, sessionId?: string): ButtonState {
    const now = Date.now();
    const state: ButtonState = {
      id: buttonId,
      value,
      timestamp: now,
      lastModified: now,
      userId,
      sessionId
    };

    this.buttonStates.set(buttonId, state);
    
    // Broadcast state update to all connected clients
    if (this.wsService) {
      this.wsService.broadcast({
        type: 'button_state_update',
        buttonId,
        value,
        timestamp: now
      });
    }

    console.log(`[ButtonService] Updated button state: ${buttonId} = ${value}`);
    return state;
  }

  executeButtonAction(buttonId: string, action: string, value?: any, userId?: string, sessionId?: string): ButtonAction {
    const now = Date.now();
    const actionRecord: ButtonAction = {
      id: `action_${now}_${Math.random().toString(36).substr(2, 9)}`,
      buttonId,
      action,
      value,
      timestamp: now,
      userId,
      sessionId
    };

    this.buttonActions.set(actionRecord.id, actionRecord);
    
    // Broadcast action request to all connected clients
    if (this.wsService) {
      this.wsService.broadcast({
        type: 'button_action_request',
        buttonId,
        action,
        value,
        timestamp: now
      });
    }

    console.log(`[ButtonService] Executed button action: ${buttonId} -> ${action}`);
    return actionRecord;
  }

  getAllButtonStates(): ButtonState[] {
    return Array.from(this.buttonStates.values());
  }

  getAllButtonActions(): ButtonAction[] {
    return Array.from(this.buttonActions.values());
  }

  getButtonStatesByUser(userId: string): ButtonState[] {
    return Array.from(this.buttonStates.values()).filter(state => state.userId === userId);
  }

  getButtonActionsByUser(userId: string): ButtonAction[] {
    return Array.from(this.buttonActions.values()).filter(action => action.userId === userId);
  }

  // Cleanup old data
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // 24 hours default
    const cutoff = Date.now() - maxAge;
    
    // Clean up old button states
    for (const [id, state] of this.buttonStates) {
      if (state.lastModified < cutoff) {
        this.buttonStates.delete(id);
      }
    }
    
    // Clean up old button actions
    for (const [id, action] of this.buttonActions) {
      if (action.timestamp < cutoff) {
        this.buttonActions.delete(id);
      }
    }
    
    console.log('[ButtonService] Cleaned up old button data');
  }

  // Set WebSocket service
  setWebSocketService(wsService: any): void {
    this.wsService = wsService;
  }
}
