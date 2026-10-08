import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useVotingSocket } from '../useVotingSocket';
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

// Connect the voting socket with the administrator role and vote-list updates.
export function useAdminVotingSocket(options: AdminVotingSocketOptions) {
    useVotingSocket({ ...options, role: 'admin' });
}
