/**
 * ROS Bridge WebSocket Client
 * Implements rosbridge protocol for browser-to-ROS 2 communication
 * Protocol spec: https://github.com/RobotWebTools/rosbridge_suite/blob/ros2/ROSBRIDGE_PROTOCOL.md
 */

export type ROSBridgeMessageType =
  | 'advertise'
  | 'unadvertise'
  | 'publish'
  | 'subscribe'
  | 'unsubscribe'
  | 'call_service'
  | 'advertise_service'
  | 'unadvertise_service'
  | 'service_response';

export interface ROSBridgeMessage {
  op: ROSBridgeMessageType;
  id?: string;
  topic?: string;
  type?: string;
  msg?: unknown;
  service?: string;
  args?: unknown;
  values?: unknown;
  result?: boolean;
  [key: string]: unknown;
}

export interface SubscriptionCallback<T = unknown> {
  (message: T): void;
}

export interface ROSBridgeOptions {
  /** Reconnect automatically on connection loss (default: true) */
  autoReconnect?: boolean;

  /** Reconnect delay in milliseconds (default: 3000) */
  reconnectDelay?: number;

  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;

  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeout?: number;

  /** Enable message compression (default: false) */
  compression?: boolean;

  /** Service call timeout in milliseconds (default: 30000) */
  serviceCallTimeout?: number;

  /** Queue messages when offline (default: true) */
  queueOfflineMessages?: boolean;
}

/**
 * WebSocket client for rosbridge protocol
 */
export class ROSBridgeClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private connected: boolean = false;
  private subscribers: Map<string, SubscriptionCallback> = new Map();
  private serviceCallbacks: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = new Map();
  private options: Required<ROSBridgeOptions>;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private messageQueue: ROSBridgeMessage[] = [];
  private metrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0
  };

  constructor(options: ROSBridgeOptions = {}) {
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 3000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      connectionTimeout: options.connectionTimeout ?? 5000,
      compression: options.compression ?? false,
      serviceCallTimeout: options.serviceCallTimeout ?? 30000,
      queueOfflineMessages: options.queueOfflineMessages ?? true
    };
  }

  /**
   * Connect to rosbridge server
   * @param url - WebSocket URL (e.g., 'ws://localhost:9090')
   */
  async connect(url: string = 'ws://localhost:9090'): Promise<void> {
    this.url = url;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error(`Connection timeout after ${this.options.connectionTimeout}ms`));
      }, this.options.connectionTimeout);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log('[ROSBridge] Connected to', url);

          // Flush queued messages
          this.flushMessageQueue();

          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[ROSBridge] Connection error:', error);
          if (!this.connected) {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.connected = false;
          console.log('[ROSBridge] Disconnected:', event.reason);

          if (this.options.autoReconnect &&
              this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            this.metrics.messagesReceived++;
            this.metrics.bytesReceived += event.data.length;

            const msg = JSON.parse(event.data) as ROSBridgeMessage;
            this.handleMessage(msg);
          } catch (error) {
            this.metrics.errors++;
            console.error('[ROSBridge] Failed to parse message:', error);
          }
        };
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    console.log(
      `[ROSBridge] Reconnecting in ${this.options.reconnectDelay}ms ` +
      `(attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url).catch((error) => {
        console.error('[ROSBridge] Reconnection failed:', error);
      });
    }, this.options.reconnectDelay);
  }

  /**
   * Disconnect from rosbridge server
   */
  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.subscribers.clear();
    this.serviceCallbacks.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a message to rosbridge
   */
  private send(message: ROSBridgeMessage): void {
    if (!this.isConnected()) {
      if (this.options.queueOfflineMessages) {
        this.messageQueue.push(message);
        return;
      }
      throw new Error('Not connected to rosbridge server');
    }

    try {
      const jsonStr = JSON.stringify(message);

      // Add compression header if enabled
      if (this.options.compression) {
        message['compression'] = 'none'; // Placeholder for future compression
      }

      this.ws!.send(jsonStr);
      this.metrics.messagesSent++;
      this.metrics.bytesSent += jsonStr.length;
    } catch (error) {
      this.metrics.errors++;
      console.error('[ROSBridge] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[ROSBridge] Flushing ${this.messageQueue.length} queued messages`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach((message) => {
      try {
        this.send(message);
      } catch (error) {
        console.error('[ROSBridge] Failed to flush message:', error);
      }
    });
  }

  /**
   * Advertise a topic for publishing
   * @param topic - Topic name
   * @param messageType - ROS message type (e.g., 'std_msgs/String')
   */
  advertise(topic: string, messageType: string): void {
    this.send({
      op: 'advertise',
      topic,
      type: messageType
    });
  }

  /**
   * Unadvertise a topic
   * @param topic - Topic name
   */
  unadvertise(topic: string): void {
    this.send({
      op: 'unadvertise',
      topic
    });
  }

  /**
   * Publish a message to a ROS topic
   * @param topic - Topic name
   * @param messageType - ROS message type
   * @param message - Message payload
   */
  publish<T>(topic: string, messageType: string, message: T): void {
    this.send({
      op: 'publish',
      topic,
      type: messageType,
      msg: message
    });
  }

  /**
   * Subscribe to a ROS topic
   * @param topic - Topic name
   * @param messageType - ROS message type
   * @param callback - Callback function for received messages
   */
  subscribe<T>(
    topic: string,
    messageType: string,
    callback: SubscriptionCallback<T>
  ): void {
    this.send({
      op: 'subscribe',
      topic,
      type: messageType
    });

    this.subscribers.set(topic, callback as SubscriptionCallback);
  }

  /**
   * Unsubscribe from a ROS topic
   * @param topic - Topic name
   */
  unsubscribe(topic: string): void {
    this.send({
      op: 'unsubscribe',
      topic
    });

    this.subscribers.delete(topic);
  }

  /**
   * Call a ROS service
   * @param service - Service name
   * @param serviceType - Service type
   * @param args - Service arguments
   * @returns Promise that resolves with service response
   */
  async callService<TReq, TRes>(
    service: string,
    serviceType: string,
    args: TReq
  ): Promise<TRes> {
    const id = `call_service:${service}:${Date.now()}`;

    return new Promise((resolve, reject) => {
      this.serviceCallbacks.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      });

      this.send({
        op: 'call_service',
        id,
        service,
        type: serviceType,
        args
      });

      // Configurable timeout
      setTimeout(() => {
        if (this.serviceCallbacks.has(id)) {
          this.serviceCallbacks.delete(id);
          this.metrics.errors++;
          reject(new Error(`Service call timeout: ${service}`));
        }
      }, this.options.serviceCallTimeout);
    });
  }

  /**
   * Advertise a ROS service
   * @param service - Service name
   * @param serviceType - Service type
   */
  advertiseService(service: string, serviceType: string): void {
    this.send({
      op: 'advertise_service',
      service,
      type: serviceType
    });
  }

  /**
   * Unadvertise a ROS service
   * @param service - Service name
   */
  unadvertiseService(service: string): void {
    this.send({
      op: 'unadvertise_service',
      service
    });
  }

  /**
   * Handle incoming messages from rosbridge
   */
  private handleMessage(msg: ROSBridgeMessage): void {
    // Handle topic messages
    if (msg.op === 'publish' && msg.topic) {
      const callback = this.subscribers.get(msg.topic);
      if (callback) {
        callback(msg.msg);
      }
      return;
    }

    // Handle service responses
    if (msg.op === 'service_response' && msg.id) {
      const callback = this.serviceCallbacks.get(msg.id);
      if (callback) {
        if (msg.result) {
          callback.resolve(msg.values);
        } else {
          callback.reject(new Error('Service call failed'));
        }
        this.serviceCallbacks.delete(msg.id);
      }
      return;
    }

    // Log unhandled messages
    console.log('[ROSBridge] Unhandled message:', msg);
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connected: boolean;
    url: string;
    reconnectAttempts: number;
    activeSubscriptions: number;
    pendingServiceCalls: number;
    queuedMessages: number;
    messagesSent: number;
    messagesReceived: number;
    bytesSent: number;
    bytesReceived: number;
    errors: number;
  } {
    return {
      connected: this.connected,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
      activeSubscriptions: this.subscribers.size,
      pendingServiceCalls: this.serviceCallbacks.size,
      queuedMessages: this.messageQueue.length,
      ...this.metrics
    };
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0
    };
  }
}
