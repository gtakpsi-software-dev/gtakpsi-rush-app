/**
 * Voting Socket Summary:
 * - Shares connection and retry handling across admin and voter pages.
 * - Keeps role-specific paths and vote handling; existing retry delays are retained.
 * - Relies on the page-owned refs and React setters staying stable across renders.
 */
import { useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type SocketUser = { _id: string };

type VotingSocketOptions<TRushee, TVote> = {
    authorized: boolean;
    user: SocketUser | null;
    votingWebSocketUrl: string;
    socketRef: MutableRefObject<WebSocket | null>;
    reconnectTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    reconnectAttemptsRef: MutableRefObject<number>;
    setConnectionStatus: Dispatch<SetStateAction<ConnectionStatus>>;
    setRushee: Dispatch<SetStateAction<TRushee | null>>;
    setQuestion: Dispatch<SetStateAction<string | null>>;
} & (
    | { role: 'admin'; setVotes: Dispatch<SetStateAction<TVote[]>> }
    | { role: 'voter'; setVotes?: never }
);

export function useVotingSocket<TRushee, TVote>({
    authorized,
    user,
    role,
    votingWebSocketUrl,
    socketRef,
    reconnectTimeoutRef,
    reconnectAttemptsRef,
    setConnectionStatus,
    setVotes,
    setRushee,
    setQuestion,
}: VotingSocketOptions<TRushee, TVote>) {
    const connectWebSocket = useCallback(() => {
        if (!authorized || !user) return;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('connecting');
        const ws = new WebSocket(`${votingWebSocketUrl}/${role}/${user._id}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log(msg);

                if (role === 'admin' && msg.type === 'vote_update') {
                    setVotes?.(msg.votes);
                }

                if (msg.type === 'rushee_update') {
                    const parsedRushee =
                        typeof msg.rushee === 'string'
                            ? JSON.parse(msg.rushee)
                            : msg.rushee;
                    setRushee(parsedRushee);
                }

                if (msg.type === 'question_update') {
                    setQuestion(msg.question);
                }
            } catch (err) {
                console.error('Error parsing WebSocket message', err);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            setConnectionStatus('disconnected');

            // Preserve the existing 1s, 2s, 4s progression and 30s ceiling.
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;

            console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`);
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, backoffMs);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error', error);
            ws.close();
        };
    }, [
        authorized, user, role, votingWebSocketUrl, setVotes, setRushee, setQuestion,
        socketRef, reconnectTimeoutRef, reconnectAttemptsRef, setConnectionStatus,
    ]);

    useEffect(() => {
        if (!authorized || !user) return;

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connectWebSocket, authorized, user, reconnectTimeoutRef, socketRef]);
}
