export type CollaborationEditorSession = {
    isConnected: boolean;
    connectedUsers: Array<{ field?: string; cursor?: number }>;
    remoteUpdates: unknown[];
    typingUsers: Array<{ field?: string }>;
    getActiveCursorsForField?: (field: string) => Array<{
        id: string;
        name?: string;
        firstName?: string;
        cursor: number;
    }>;
    sendTextUpdate: (field: string, value: string) => void;
    sendCursorPosition: (field: string, position: number) => void;
    clearCursorPosition?: (field: string) => void;
    sendTypingIndicator: (field: string, active: boolean) => void;
};
