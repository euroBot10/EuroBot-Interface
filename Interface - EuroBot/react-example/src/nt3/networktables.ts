import * as CBOR from "./cbor";

// Type definitions
type ConnectionListener = (connected: boolean) => void;
type RobotConnectionListener = (connected: boolean) => void;
type GlobalListener = (key: string, value: any, isNew: boolean) => void;
type KeyListener = (key: string, value: any, isNew: boolean) => void;

// Internal state
let robotAddress: string | null = null;
let robotConnected: boolean = false;
let socketOpen: boolean = false;
let socket: WebSocket | null = null;

// Internal collections
const connectionListeners = new Set<ConnectionListener>();
const robotConnectionListeners = new Set<RobotConnectionListener>();
const globalListeners = new Set<GlobalListener>();
const keyListeners = new Map<string, Set<KeyListener>>();
let ntCache = new Map<string, any>();

if (!("WebSocket" in window)) {
    alert("Your browser does not support websockets, this will fail!");
    throw new Error("WebSocket not supported");
}

export function create_map(): Map<any, any> {
    return new Map();
}

export const keyToId = encodeURIComponent;

export function keySelector(str: string): string {
    return encodeURIComponent(str).replace(/([;&,.+*~':"!^#$%@\[\]()=>|])/g, '\\$1');
}

export function addWsConnectionListener(f: ConnectionListener, immediateNotify?: boolean): () => void {
    connectionListeners.add(f);
    
    if (immediateNotify === true) {
        f(socketOpen);
    }

    return () => connectionListeners.delete(f);
}

export function addRobotConnectionListener(f: RobotConnectionListener, immediateNotify?: boolean): () => void {
    robotConnectionListeners.add(f);
    
    if (immediateNotify === true) {
        f(robotConnected);
    }

    return () => robotConnectionListeners.delete(f);
}

export function addGlobalListener(f: GlobalListener, immediateNotify?: boolean): () => void {
    globalListeners.add(f);
    
    if (immediateNotify === true) {
        ntCache.forEach((v, k) => {
            f(k, v, true);
        });
    }

    return () => globalListeners.delete(f);
}

export function addKeyListener(key: string, f: KeyListener, immediateNotify?: boolean): () => void {
    const listeners = keyListeners.get(key);
    if (listeners === undefined) {
        keyListeners.set(key, new Set([f]));
    } else {
        listeners.add(f);
    }
    
    if (immediateNotify === true) {
        const v = ntCache.get(key);
        if (v !== undefined) {
            f(key, v, true);
        }
    }

    return () => {
        const listeners = keyListeners.get(key);
        if (listeners) {
            listeners.delete(f);
        }
    };
}

export function containsKey(key: string): boolean {
    return ntCache.has(key);
}

export function getKeys(): IterableIterator<string> {
    return ntCache.keys();
}

export function getValue<T>(key: string, defaultValue?: T): T | undefined {
    const val = ntCache.get(key);
    return val === undefined ? defaultValue : val;
}

export function getRobotAddress(): string | null {
    return robotAddress;
}

export function isRobotConnected(): boolean {
    return robotConnected;
}

export function isWsConnected(): boolean {
    return socketOpen;
}

export function closeSocket(): void {
    if (socket) {
        socket.close();
    }
}

export function putValue(key: string, value: any): boolean {
    if (!socketOpen) {
        return false;
    }
    
    if (value === undefined) {
        throw new Error(`${key}: 'undefined' passed to putValue`);
    }

    socket?.send(CBOR.encode({'k': key, 'v': value}));
    return true;
}

export function connect(address: string): boolean {
    if (!socketOpen) {
        return false;
    }

    ntCache = new Map();
    socket?.send(CBOR.encode({'a': address}));
    return true;
}

// Internal helper to create and manage WebSocket connection
function createSocket() {
    const loc = window.location;
    const ntHostElement = document.querySelector('[data-nt-host]');
    const host = ntHostElement ? ntHostElement.getAttribute('data-nt-host') : loc.host;
    const address = `ws://${host}/networktables/ws`;

    socket = new WebSocket(address);
    if (socket) {
        socket.binaryType = "arraybuffer";
        
        socket.onopen = () => {
            console.info("Socket opened");
            socketOpen = true;
            connectionListeners.forEach(f => f(true));
        };
        
        socket.onmessage = (msg: MessageEvent) => {
            const data = CBOR.decode(msg.data);

            if (data.r !== undefined) {
                robotConnected = data.r;
                robotAddress = data.a;
                robotConnectionListeners.forEach(f => f(robotConnected));
            } else {
                const key = data['k'];
                const value = data['v'];
                const isNew = data['n'];

                ntCache.set(key, value);
                
                globalListeners.forEach(f => f(key, value, isNew));
                
                const listeners = keyListeners.get(key);
                if (listeners !== undefined) {
                    listeners.forEach(f => f(key, value, isNew));
                }
            }
        };
        
        socket.onclose = () => {
            if (socketOpen) {
                connectionListeners.forEach(f => f(false));
                robotConnectionListeners.forEach(f => f(false));
                ntCache = new Map();
                socketOpen = false;
                robotConnected = false;
                robotAddress = null;
                console.info("Socket closed");
            }
            
            setTimeout(createSocket, 300);
        };
    }
}

// Initialize the WebSocket connection
createSocket();

// For backwards compatibility
export const setValue = putValue;
