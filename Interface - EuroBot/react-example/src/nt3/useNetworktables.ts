import { useEffect, useState, useCallback, useRef } from 'react';
import * as NetworkTables from './networktables';

/**
 * Hook to monitor the WebSocket connection status
 */
export function useNTConnection(immediateNotify: boolean = true): boolean {
    const [connected, setConnected] = useState<boolean>(NetworkTables.isWsConnected());

    useEffect(() => {
        return NetworkTables.addWsConnectionListener(setConnected, immediateNotify);
    }, [immediateNotify]);

    return connected;
}

/**
 * Hook to monitor the robot connection status
 */
export function useRobotConnection(immediateNotify: boolean = true): boolean {
    const [connected, setConnected] = useState<boolean>(NetworkTables.isRobotConnected());

    useEffect(() => {
        return NetworkTables.addRobotConnectionListener(setConnected, immediateNotify);
    }, [immediateNotify]);

    return connected;
}

/**
 * Hook to get and set a NetworkTables value
 */
export function useNTValue<T>(key: string, defaultValue?: T): [T | undefined, (value: T) => void] {
    const [value, setValue] = useState<T | undefined>(() => 
        NetworkTables.getValue<T>(key, defaultValue)
    );

    useEffect(() => {
        return NetworkTables.addKeyListener(key, (_, newValue) => {
            setValue(newValue);
        }, true);
    }, [key]);

    const putValue = useCallback((newValue: T) => {
        NetworkTables.putValue(key, newValue);
    }, [key]);

    return [value, putValue];
}

/**
 * Hook to listen to all NetworkTables changes
 */
export function useNTGlobalListener(
    callback: (key: string, value: any, isNew: boolean) => void,
    immediateNotify: boolean = true
): void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        return NetworkTables.addGlobalListener(
            (key, value, isNew) => callbackRef.current(key, value, isNew),
            immediateNotify
        );
    }, [immediateNotify]);
}

/**
 * Hook to get all current NetworkTables keys
 */
export function useNTKeys(): string[] {
    const [keys, setKeys] = useState<string[]>([]);

    useEffect(() => {
        const updateKeys = () => {
            setKeys(Array.from(NetworkTables.getKeys()));
        };

        // Initial keys
        updateKeys();

        // Update keys when values change
        return NetworkTables.addGlobalListener(() => {
            updateKeys();
        }, false);
    }, []);

    return keys;
}

/**
 * Hook to check if a key exists in NetworkTables
 */
export function useNTKeyExists(key: string): boolean {
    const [exists, setExists] = useState<boolean>(() => NetworkTables.containsKey(key));

    useEffect(() => {
        return NetworkTables.addGlobalListener((changedKey) => {
            if (changedKey === key) {
                setExists(NetworkTables.containsKey(key));
            }
        }, true);
    }, [key]);

    return exists;
}