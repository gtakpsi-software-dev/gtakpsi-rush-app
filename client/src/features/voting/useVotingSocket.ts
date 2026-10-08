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

// Manage the role-specific voting socket, live updates, and exponential reconnect retries.
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
        // Connect an authorized user and replace any pending reconnect timer.
        if (!authorized || !user) return;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('connecting');
        const ws = new WebSocket(`${votingWebSocketUrl}/${role}/${user._id}`);
        socketRef.current = ws;

        ws.onopen = () => {
            // Mark the socket connected and reset the retry counter.
            console.log('WebSocket connected');
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
            // Apply vote, rushee, and question messages, logging invalid payloads.
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
            // Mark disconnection and schedule the next reconnect with capped exponential backoff.
            console.log('WebSocket closed');
            setConnectionStatus('disconnected');

            // Preserve the existing 1s, 2s, 4s progression and 30s ceiling.
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;

            console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`);
            reconnectTimeoutRef.current = setTimeout(() => {
                // Retry the voting connection after the backoff delay.
                connectWebSocket();
            }, backoffMs);
        };

        ws.onerror = (error) => {
            // Log a socket error and close the failed connection.
            console.error('WebSocket error', error);
            ws.close();
        };
    }, [
        authorized, user, role, votingWebSocketUrl, setVotes, setRushee, setQuestion,
        socketRef, reconnectTimeoutRef, reconnectAttemptsRef, setConnectionStatus,
    ]);

    useEffect(() => {
        // Connect the current authorized user and register socket cleanup.
        if (!authorized || !user) return;

        connectWebSocket();

        return () => {
            // Cancel the current reconnect timer and close the active socket.
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connectWebSocket, authorized, user, reconnectTimeoutRef, socketRef]);
}
