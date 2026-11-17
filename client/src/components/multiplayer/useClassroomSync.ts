import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useSocket } from '../../context/SocketContext';
import type { ClassroomRoomState } from '../../types';

interface UseClassroomSyncOptions {
    pin: string | null;
    enabled?: boolean;
    onRoomUpdate?: (next: ClassroomRoomState, prev: ClassroomRoomState | null) => void;
    onRoomClosed?: () => void;
    onTimerExpired?: (room: ClassroomRoomState) => void;
}

export function useClassroomSync({
    pin,
    enabled = true,
    onRoomUpdate,
    onRoomClosed,
    onTimerExpired
}: UseClassroomSyncOptions) {
    const { socket, connected } = useSocket();
    const [room, setRoom] = useState<ClassroomRoomState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(25);

    const versionRef = useRef<number>(0);
    const prevRoomRef = useRef<ClassroomRoomState | null>(null);
    const serverOffsetMsRef = useRef<number>(0);
    const timeoutFiredKeyRef = useRef<string>('');

    const onRoomUpdateRef = useRef(onRoomUpdate);
    const onRoomClosedRef = useRef(onRoomClosed);
    const onTimerExpiredRef = useRef(onTimerExpired);

    useEffect(() => {
        onRoomUpdateRef.current = onRoomUpdate;
        onRoomClosedRef.current = onRoomClosed;
        onTimerExpiredRef.current = onTimerExpired;
    }, [onRoomUpdate, onRoomClosed, onTimerExpired]);

    const applyRoom = useCallback((nextRoom: ClassroomRoomState | null) => {
        if (!nextRoom) return;
        if (nextRoom.serverNow) {
            const parsedServer = Date.parse(nextRoom.serverNow);
            if (!Number.isNaN(parsedServer)) {
                serverOffsetMsRef.current = parsedServer - Date.now();
            }
        }
        if (nextRoom.version && nextRoom.version < versionRef.current) {
            return;
        }
        const previous = prevRoomRef.current;
        versionRef.current = nextRoom.version || versionRef.current + 1;
        prevRoomRef.current = nextRoom;
        setRoom(nextRoom);
        setError(null);
        onRoomUpdateRef.current?.(nextRoom, previous);
    }, []);

    // Socket push listener
    useEffect(() => {
        if (!enabled || !pin || !socket) return;

        const cleanPin = pin.trim();
        socket.emit('subscribe_classroom', { pin: cleanPin });

        const handleUpdate = (incoming: ClassroomRoomState) => {
            if (incoming?.pin === cleanPin) {
                applyRoom(incoming);
            }
        };
        const handleClosed = (payload: { pin?: string }) => {
            if (!payload?.pin || payload.pin === cleanPin) {
                onRoomClosedRef.current?.();
            }
        };

        socket.on('classroom_room_update', handleUpdate);
        socket.on('classroom_room_closed', handleClosed);

        return () => {
            socket.off('classroom_room_update', handleUpdate);
            socket.off('classroom_room_closed', handleClosed);
        };
    }, [enabled, pin, socket, applyRoom]);

    // Resilient HTTP polling fallback (works on Vercel serverless and when WebSockets drop)
    useEffect(() => {
        if (!enabled || !pin) return;
        let cancelled = false;
        const cleanPin = pin.trim();
        const intervalMs = connected ? 2200 : 1000;

        const poll = async () => {
            try {
                const res = await api.getClassroomRoomState(cleanPin, versionRef.current);
                if (cancelled) return;
                if (res.serverNow) {
                    const parsed = Date.parse(res.serverNow);
                    if (!Number.isNaN(parsed)) {
                        serverOffsetMsRef.current = parsed - Date.now();
                    }
                }
                if (res.room) {
                    applyRoom(res.room);
                }
            } catch (err) {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : 'Room connection lost';
                if (/closed|expired|not found/i.test(msg)) {
                    setError(msg);
                    onRoomClosedRef.current?.();
                }
            }
        };

        poll();
        const timer = setInterval(poll, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [enabled, pin, connected, applyRoom]);

    // Synchronized server-anchored countdown timer during active question
    useEffect(() => {
        if (!room || room.gameState !== 'question' || !room.questionStartedAt) {
            return;
        }

        const startedMs = Date.parse(room.questionStartedAt);
        const totalSec = room.questionTimeSec || 25;
        const turnKey = `${room.pin}:${room.currentQuestionIndex}:${room.currentTurnUserId}:${room.questionStartedAt}`;

        const tick = () => {
            const estimatedServerNow = Date.now() + serverOffsetMsRef.current;
            const elapsedSec = Math.max(0, (estimatedServerNow - startedMs) / 1000);
            const remaining = Math.max(0, Math.ceil(totalSec - elapsedSec));
            setTimeLeft(remaining);

            if (remaining <= 0 && timeoutFiredKeyRef.current !== turnKey) {
                timeoutFiredKeyRef.current = turnKey;
                onTimerExpiredRef.current?.(room);
            }
        };

        const kickoff = setTimeout(tick, 0);
        const timer = setInterval(tick, 250);
        return () => {
            clearTimeout(kickoff);
            clearInterval(timer);
        };
    }, [room]);

    const resetSync = useCallback(() => {
        versionRef.current = 0;
        prevRoomRef.current = null;
        timeoutFiredKeyRef.current = '';
        setRoom(null);
        setError(null);
    }, []);

    return {
        room,
        setRoom: applyRoom,
        resetSync,
        error,
        timeLeft: room?.gameState === 'question' ? timeLeft : (room?.questionTimeSec ?? 25),
        socketConnected: connected
    };
}
