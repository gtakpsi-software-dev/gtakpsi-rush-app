import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useVotingSocket } from '../useVotingSocket';
import type { Brother, BrotherVotingContextType, ConnectionStatus } from './types';

type BrotherVotingSocketOptions = Pick<BrotherVotingContextType, 'setRushee' | 'setQuestion'> & {
    user: Brother | null;
    votingWebSocketUrl: string;
    socketRef: MutableRefObject<WebSocket | null>;
    reconnectTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    reconnectAttemptsRef: MutableRefObject<number>;
    setConnectionStatus: Dispatch<SetStateAction<ConnectionStatus>>;
};

// Connect the voting socket with the voter role.
export function useBrotherVotingSocket(options: BrotherVotingSocketOptions) {
    useVotingSocket({ ...options, role: 'voter', authorized: true });
}
