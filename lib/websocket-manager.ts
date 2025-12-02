/**
 * WebSocket Manager for SDC Messenger
 * Handles Socket.IO connection and event management
 */

type EventCallback = (data: any) => void;
type EventMap = Map<string, Set<EventCallback>>;

class WebSocketManager {
    private ws: WebSocket | null = null;
    private eventListeners: EventMap = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private isConnecting = false;
    private isConnected = false;
    private connectionParams: {
        dbId: string;
        connId: string;
        id1: string;
        clientToken: string;
        messengerHash: string;
        messengerVersion: number;
    } | null = null;

    /**
     * Initialize WebSocket connection with required parameters
     */
    async connect(): Promise<void> {
        if (this.isConnecting || this.isConnected) {
            console.log('[WebSocket] Already connecting or connected');
            return;
        }

        this.isConnecting = true;

        try {
            // Fetch connection parameters from API
            const { getMessengerIOV2 } = await import('./sdc-api/messenger');
            const response = await getMessengerIOV2();

            if (response.info.code !== 200) {
                throw new Error(`Messenger IO API returned code: ${response.info.code}`);
            }

            const { db_id, messenger_conn_id, messenger_id1, messenger_version, messenger_hh } = response.info;

            this.connectionParams = {
                dbId: String(db_id),
                connId: String(messenger_conn_id),
                id1: messenger_id1,
                clientToken: '0', // Default value
                messengerHash: messenger_hh,
                messengerVersion: messenger_version,
            };

            console.log('[WebSocket] Fetched connection parameters from API');
            await this.establishConnection();
        } catch (error) {
            console.error('[WebSocket] Connection failed:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
            throw error;
        }
    }

    /**
     * Establish WebSocket connection
     */
    private async establishConnection(): Promise<void> {
        if (!this.connectionParams) {
            throw new Error('Connection parameters not set');
        }

        const { dbId, connId, id1, clientToken, messengerHash } = this.connectionParams;

        // Build Socket.IO URL with query parameters
        const url = new URL('wss://ws-messengerv2.sdc.com/socket.io/');
        url.searchParams.set('DB_ID', dbId);
        url.searchParams.set('ConnID', connId);
        url.searchParams.set('ID1', id1);
        url.searchParams.set('v', String(this.connectionParams.messengerVersion));
        url.searchParams.set('client_token', clientToken);
        url.searchParams.set('device', 'web');
        url.searchParams.set('messenger_hh', messengerHash);
        url.searchParams.set('EIO', '4');
        url.searchParams.set('transport', 'websocket');

        console.log('[WebSocket] Connecting to:', url.toString().replace(/messenger_hh=[^&]+/, 'messenger_hh=***'));

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url.toString());

                this.ws.onopen = () => {
                    console.log('[WebSocket] Connected');
                    this.isConnecting = false;
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocket] Error:', error);
                    this.isConnecting = false;
                    this.isConnected = false;
                    reject(error);
                };

                this.ws.onclose = (event) => {
                    console.log('[WebSocket] Closed:', event.code, event.reason);
                    this.isConnecting = false;
                    this.isConnected = false;
                    this.ws = null;

                    // Schedule reconnect if not a clean close
                    if (event.code !== 1000) {
                        this.scheduleReconnect();
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle incoming WebSocket messages
     * Socket.IO Engine.IO protocol:
     * - 0 = open (handshake)
     * - 1 = close
     * - 2 = ping (respond with 3 = pong)
     * - 3 = pong
     * - 4 = message (Socket.IO layer)
     *   - 40 = socket.io connect
     *   - 41 = socket.io disconnect
     *   - 42 = socket.io event
     *   - 43 = socket.io ack
     *   - 44 = socket.io error
     * 
     * Format: [type][...data]
     * Example: 42["eventName", {...data}] = EVENT with eventName and data
     */
    private handleMessage(data: string | Blob): void {
        if (data instanceof Blob) {
            data.text().then(text => this.handleMessage(text));
            return;
        }

        if (!data || data.length === 0) {
            return;
        }

        // Handle Engine.IO protocol messages
        if (data.startsWith('0')) {
            // Open handshake (can be just '0' or '0{...json...}')
            if (data.length > 1) {
                try {
                    const handshakeData = JSON.parse(data.substring(1));
                    console.log('[WebSocket] Engine.IO handshake:', handshakeData);
                    // Store session ID if needed
                    if (handshakeData.sid) {
                        // Session ID available for future use
                    }
                    // After handshake, connect to Socket.IO namespace by sending '40'
                    if (this.ws && this.isConnected) {
                        console.log('[WebSocket] Sending Socket.IO connect (40)');
                        this.ws.send('40');
                    }
                } catch (error) {
                    console.log('[WebSocket] Engine.IO handshake (parse error):', data);
                    // Still try to connect even if parsing fails
                    if (this.ws && this.isConnected) {
                        console.log('[WebSocket] Sending Socket.IO connect (40)');
                        this.ws.send('40');
                    }
                }
            } else {
                console.log('[WebSocket] Engine.IO handshake');
                // Still try to connect even if no handshake data
                if (this.ws && this.isConnected) {
                    console.log('[WebSocket] Sending Socket.IO connect (40)');
                    this.ws.send('40');
                }
            }
            return;
        }

        if (data === '1') {
            // Close
            console.log('[WebSocket] Engine.IO close');
            return;
        }

        if (data === '2') {
            // Ping - respond with pong
            if (this.ws && this.isConnected) {
                this.ws.send('3');
            }
            return;
        }

        if (data === '3') {
            // Pong response
            return;
        }

        // Handle Socket.IO messages (starting with '4')
        if (data.startsWith('40')) {
            // Socket.IO connect
            console.log('[WebSocket] Socket.IO connected');
            return;
        }

        if (data.startsWith('41')) {
            // Socket.IO disconnect
            console.log('[WebSocket] Socket.IO disconnected');
            return;
        }

        if (data.startsWith('42')) {
            // Socket.IO event
            try {
                const jsonStr = data.substring(2); // Remove '42' prefix
                if (!jsonStr || jsonStr.length === 0) {
                    return;
                }
                const parsed = JSON.parse(jsonStr);
                const [eventName, eventData] = Array.isArray(parsed) ? parsed : [parsed, null];
                
                console.log('[WebSocket] Received event:', eventName, eventData);
                this.emit(eventName, eventData);
            } catch (error) {
                console.error('[WebSocket] Failed to parse event message:', data, error);
            }
            return;
        }

        if (data.startsWith('43')) {
            // Socket.IO ACK
            return;
        }

        if (data.startsWith('44')) {
            // Socket.IO error
            try {
                const errorData = JSON.parse(data.substring(2));
                console.error('[WebSocket] Socket.IO error:', errorData);
            } catch (error) {
                console.error('[WebSocket] Error message:', data);
            }
            return;
        }

        // Handle Engine.IO error (starts with '4' but not Socket.IO)
        if (data.startsWith('4') && data.length === 1) {
            console.error('[WebSocket] Engine.IO error');
            return;
        }

        // Unknown message
        console.log('[WebSocket] Unknown message:', data.substring(0, 50));
    }

    /**
     * Start heartbeat/ping interval
     * Note: Engine.IO handles ping/pong automatically, but we can send pings if needed
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();
        
        // Engine.IO handles ping/pong automatically, but we can monitor connection
        // The server will send '2' (ping) and we respond with '3' (pong)
        // We don't need to actively send pings, but we can monitor the connection
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Send event to server
     */
    send(eventName: string, data: any): void {
        if (!this.isConnected || !this.ws) {
            console.warn('[WebSocket] Cannot send - not connected');
            return;
        }

        try {
            // Socket.IO protocol: '42' = EVENT (Socket.IO layer)
            // Format: 42["eventName", {...data}]
            const message = `42${JSON.stringify([eventName, data])}`;
            this.ws.send(message);
            console.log('[WebSocket] Sent event:', eventName, data);
        } catch (error) {
            console.error('[WebSocket] Failed to send message:', error);
        }
    }

    /**
     * Subscribe to an event
     */
    on(eventName: string, callback: EventCallback): () => void {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set());
        }
        this.eventListeners.get(eventName)!.add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(eventName);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.eventListeners.delete(eventName);
                }
            }
        };
    }

    /**
     * Unsubscribe from an event
     */
    off(eventName: string, callback: EventCallback): void {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.eventListeners.delete(eventName);
            }
        }
    }

    /**
     * Emit event to all listeners
     */
    private emit(eventName: string, data: any): void {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[WebSocket] Error in event listener:', error);
                }
            });
        }

        // Also emit to wildcard listeners
        const wildcardListeners = this.eventListeners.get('*');
        if (wildcardListeners) {
            wildcardListeners.forEach(callback => {
                try {
                    callback({ event: eventName, data });
                } catch (error) {
                    console.error('[WebSocket] Error in wildcard listener:', error);
                }
            });
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(console.error);
        }, delay);
    }

    /**
     * Disconnect WebSocket
     */
    disconnect(): void {
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }

        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }

    /**
     * Get connection status
     */
    get connected(): boolean {
        return this.isConnected;
    }
}

// Create singleton instance
export const websocketManager = new WebSocketManager();

