import { useCallback, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AdminVotingContextType, Brother, ConnectionStatus } from './types';

type AdminVotingSocketOptions = Pick<
    AdminVotingContextType,
    'setVotes' | 'setRushee' | 'setQuestion'
> & {
    authorized: boolean;
    user: Brother | null;
    votingWebSocketUrl: string;
    socketRef: MutableRefObject<WebSocket | null>;
    reconnectTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    reconnectAttemptsRef: MutableRefObject<number>;
    setConnectionStatus: Dispatch<SetStateAction<ConnectionStatus>>;
};

export function useAdminVotingSocket({
    authorized,
    user,
    votingWebSocketUrl,
    socketRef,
    reconnectTimeoutRef,
    reconnectAttemptsRef,
    setConnectionStatus,
    setVotes,
    setRushee,
    setQuestion,
}: AdminVotingSocketOptions) {
    const connectWebSocket = useCallback(() => {
        if (!authorized || !user) return;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('connecting');
        const ws = new WebSocket(`${votingWebSocketUrl}/admin/${user._id}`);
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

                if (msg.type === 'vote_update') {
                    setVotes(msg.votes);
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

            // Keep the original 1s, 2s, 4s progression and 30s ceiling.
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;

            console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current})`);
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, backoffMs);
        };

        ws.onerror = (e) => {
            console.error('WebSocket error', e);
            ws.close();
        };
    }, [authorized, user, votingWebSocketUrl, setVotes, setRushee, setQuestion]);

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
    }, [connectWebSocket, authorized, user]);
}
