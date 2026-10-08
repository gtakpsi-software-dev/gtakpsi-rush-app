import { TAGS } from "./board";

type Card = {
    id: string;
    fullName: string;
    rushNumber: number | string;
    sortingTags?: string[];
};

type Props = {
    col: { key: string; label: string };
    columns: Record<string, Card[]>;
    showRusheeNames: boolean;
    onOpen: (card: Card) => void;
};

// Render a read-only sorting column with optional names and clickable detail cards.
export default function ViewerSortingColumn({ col, columns, showRusheeNames, onOpen }: Props) {
    const items = columns[col.key] || [];

    return (
        <div
            className="bg-white/90 backdrop-blur-sm border-2 rounded-apple-xl shadow-sm p-4 w-64 border-apple-gray-200"
        >
            <div className="flex justify-between items-center mb-3">
                <div className="text-apple-headline text-black font-medium">{col.label}</div>
                <div className="text-apple-caption2 text-apple-gray-600 bg-apple-gray-100 px-2 py-0.5 rounded-full">{items.length}</div>
            </div>
            <div className="space-y-1 min-h-[60px]">
                {items.map(/* Render one rushee’s read-only card. */ (r) => (
                    <div
                        key={r.id}
                        data-card
                        onClick={/* Open this card’s detail panel. */ () => onOpen(r)}
                        className="p-3 rounded-apple-lg border-2 bg-white hover:shadow-md cursor-pointer select-none transition-all border-apple-gray-200 hover:border-apple-gray-300"
                    >
                        {/* The bid committee board keeps names hidden while retaining the same card layout. */}
                        {showRusheeNames ? (
                            <div className="text-apple-body text-black font-medium">
                                {r.fullName}
                            </div>
                        ) : (
                            <div className="text-apple-body text-black font-semibold">
                                Rushee #{r.rushNumber}
                            </div>
                        )}
                        {r.sortingTags && r.sortingTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {r.sortingTags.map((tagKey) => {
                                    // Render a recognized sorting tag badge.
                                    const tagInfo = TAGS.find(/* Find the display metadata for this tag key. */ (t) => t.key === tagKey);
                                    if (!tagInfo) return null;
                                    return (
                                        <span
                                            key={tagKey}
                                            className={`text-xs px-2 py-0.5 rounded-full border ${tagInfo.color}`}
                                        >
                                            {tagInfo.label}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="text-apple-caption2 text-center py-6 border-2 border-dashed rounded-apple-lg border-apple-gray-200 text-apple-gray-500">
                        Empty
                    </div>
                )}
            </div>
        </div>
    );
}
