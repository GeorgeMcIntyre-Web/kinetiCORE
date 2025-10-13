/**
 * Button System Initializer
 * Owner: George
 * 
 * Initializes the complete button system with frontend and backend integration
 */

import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { ButtonService } from '../../services/ButtonService';

export function ButtonSystemInitializer() {
  const { buttonService } = useEditorStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  useEffect(() => {
    initializeButtonSystem();
  }, []);

  const initializeButtonSystem = async () => {
    try {
      console.log('[ButtonSystemInitializer] Initializing button system...');
      
      // Create ButtonService instance
      const service = new ButtonService();
      
      // Set service in store
      useEditorStore.setState({ buttonService: service });
      
      // Connect WebSocket
      setConnectionStatus('connecting');
      service.connectWebSocket();
      
      // Wait for connection
      const checkConnection = () => {
        if (service.isConnected()) {
          setConnectionStatus('connected');
          setIsInitialized(true);
          console.log('[ButtonSystemInitializer] Button system initialized successfully');
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
      
      // Set up periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (service.isConnected()) {
          service.ping();
        }
      }, 30000); // Ping every 30 seconds
      
      // Cleanup on unmount
      return () => {
        clearInterval(pingInterval);
        service.disconnect();
      };
      
    } catch (error) {
      console.error('[ButtonSystemInitializer] Failed to initialize button system:', error);
      setConnectionStatus('error');
    }
  };

  // Sync button states on initialization
  useEffect(() => {
    if (isInitialized) {
      const { syncAllButtonStates } = useEditorStore.getState();
      syncAllButtonStates();
    }
  }, [isInitialized]);

  // Connection status indicator (development only)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded-lg text-xs z-50">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500' :
            connectionStatus === 'error' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          <span>
            Button System: {connectionStatus}
          </span>
        </div>
        {isInitialized && (
          <div className="mt-1 text-xs text-gray-300">
            WebSocket: Connected
          </div>
        )}
      </div>
    );
  }

  return null; // No UI in production
}
