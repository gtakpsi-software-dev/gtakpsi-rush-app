type GhostCard = {
    rusheeId: string;
    rusheeName: string;
    draggerName: string;
    x: number | string;
    y: number | string;
};

type SortingGhostCardsProps = {
    ghostCards: Record<string, GhostCard>;
    wide: boolean;
};

// Render floating previews for active remote card drags.
export default function SortingGhostCards({ ghostCards, wide }: SortingGhostCardsProps) {
    return Object.values(ghostCards).map(/* Position and label one remote drag preview. */ (ghost) => (
        <div
            key={ghost.rusheeId}
            className="fixed z-50 pointer-events-none"
            style={{
                left: ghost.x,
                top: ghost.y,
                transform: "translate(-50%, -50%)",
            }}
        >
            <div className={`p-3 rounded-apple-lg border-2 border-blue-400 bg-blue-50/90 shadow-xl backdrop-blur-sm animate-pulse ${wide ? "w-56" : "w-48"}`}>
                <div className="text-apple-body text-blue-700 font-semibold">
                    {ghost.rusheeName}
                </div>
                <div className="text-apple-caption2 text-blue-500 mt-1">
                    Being moved by {ghost.draggerName}
                </div>
            </div>
        </div>
    ));
}
