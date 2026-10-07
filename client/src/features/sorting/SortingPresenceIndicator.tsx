type SortingPresenceIndicatorProps = {
    connected: boolean;
    viewerCount: number;
    ghostCards: Record<string, { draggerName: string }>;
    hideWhenAlone: boolean;
};

export default function SortingPresenceIndicator({
    connected,
    viewerCount,
    ghostCards,
    hideWhenAlone,
}: SortingPresenceIndicatorProps) {
    const ghostList = Object.values(ghostCards);
    const ghostCount = ghostList.length;

    // The admin board hides its own idle connection until another viewer joins.
    if (!connected || (hideWhenAlone && viewerCount <= 1 && ghostCount === 0)) return null;

    const label =
        ghostCount === 0
            ? `${viewerCount} viewing`
            : ghostCount === 1
                ? `${ghostList[0].draggerName} is editing`
                : `${ghostCount} admins editing`;

    return (
        <div className="fixed top-20 right-6 z-30 flex items-center gap-2 bg-white border border-apple-gray-200 rounded-full px-3 py-1.5 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${ghostCount > 0 ? "bg-orange-500 animate-pulse" : "bg-green-500"}`}></div>
            <span className="text-sm text-apple-gray-600">
                {label}
            </span>
        </div>
    );
}
