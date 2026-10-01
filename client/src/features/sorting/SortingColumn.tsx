import React from "react";

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
    hoverIndex: { column: string | null; index: number | null };
    dragging: { id: string } | null;
    draggingRef: { current: { id: string } | null };
    lockedCards: Record<string, string>;
    setHoverIndex: (hover: { column: string | null; index: number | null }) => void;
    handleDragOver: (event: React.DragEvent, column: string, index: number) => void;
    handleDrop: (column: string, index: number | null) => void;
    handleDragStart: (card: Card, column: string, index: number, event: React.DragEvent) => void;
    handleDragEnd: (event: React.DragEvent) => void;
    openNotes: (card: Card) => void;
};

export default function SortingColumn({
    col, columns, hoverIndex, dragging, draggingRef, lockedCards,
    setHoverIndex, handleDragOver, handleDrop, handleDragStart,
    handleDragEnd, openNotes,
}: Props) {
    const DropIndicator = () => (
        <div className="h-1 bg-blue-500 rounded-full my-1 shadow-lg shadow-blue-500/50 animate-pulse" />
    );

    const items = columns[col.key] || [];
    const isHoveringThisColumn = hoverIndex.column === col.key;
    const isHoveringEmptyArea = isHoveringThisColumn && hoverIndex.index >= items.length;

    return (
        <div
            key={col.key}
            className={`bg-white/90 backdrop-blur-sm border-2 rounded-apple-xl shadow-sm p-4 w-64 transition-colors ${
                isHoveringThisColumn && dragging ? "border-blue-400 bg-blue-50/50" : "border-apple-gray-200"
            }`}
            onDragOver={(e) => handleDragOver(e, col.key, items.length)}
            onDrop={() => handleDrop(col.key, hoverIndex.column === col.key ? hoverIndex.index : items.length)}
            onDragLeave={() => {
                if (hoverIndex.column === col.key) {
                    setHoverIndex({ column: null, index: null });
                }
            }}
        >
            <div className="flex justify-between items-center mb-3">
                <div className="text-apple-headline text-black font-medium">{col.label}</div>
                <div className="text-apple-caption2 text-apple-gray-600 bg-apple-gray-100 px-2 py-0.5 rounded-full">{items.length}</div>
            </div>
            <div className="space-y-1 min-h-[60px]">
                {items.map((r, idx) => (
                    <React.Fragment key={r.id}>
                        {(() => {
                            const lockedBy = lockedCards[r.id];
                            const isLockedByOther = Boolean(lockedBy) && draggingRef.current?.id !== r.id;
                            return (
                                <React.Fragment>
                                    {isHoveringThisColumn && hoverIndex.index === idx && dragging && dragging.id !== r.id && (
                                        <DropIndicator />
                                    )}
                                    <div
                                        data-card
                                        draggable={!isLockedByOther}
                                        onDragStart={(e) => handleDragStart(r, col.key, idx, e)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Use the midpoint to select an insertion position above or below the card.
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const midY = rect.top + rect.height / 2;
                                            const insertIndex = e.clientY < midY ? idx : idx + 1;
                                            setHoverIndex({ column: col.key, index: insertIndex });
                                        }}
                                        onDrop={(e) => {
                                            e.stopPropagation();
                                            handleDrop(col.key, hoverIndex.index);
                                        }}
                                        onClick={() => openNotes(r)}
                                        className={`p-3 rounded-apple-lg border-2 bg-white hover:shadow-md select-none transition-all ${
                                            dragging?.id === r.id
                                                ? "opacity-50 border-dashed border-apple-gray-300 bg-apple-gray-50"
                                                : isLockedByOther
                                                    ? "border-apple-gray-200 bg-apple-gray-50 cursor-not-allowed"
                                                    : "border-apple-gray-200 hover:border-apple-gray-300 cursor-grab"
                                        }`}
                                    >
                                        <div className="text-apple-body text-black font-medium">{r.fullName}</div>
                                        <div className="text-apple-caption2 text-apple-gray-600">Rushee #{r.rushNumber}</div>
                                        {isLockedByOther && (
                                            <div className="text-apple-caption2 text-orange-600 mt-1">
                                                Moving by {lockedBy}
                                            </div>
                                        )}

                                        {r.sortingTags && r.sortingTags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {r.sortingTags.map((tagKey) => {
                                                    const tagInfo = TAGS.find((t) => t.key === tagKey);
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
                                    {isHoveringThisColumn && hoverIndex.index === idx + 1 && idx === items.length - 1 && dragging && dragging.id !== r.id && (
                                        <DropIndicator />
                                    )}
                                </React.Fragment>
                            );
                        })()}
                    </React.Fragment>
                ))}

                {items.length === 0 ? (
                    <div
                        className={`text-apple-caption2 text-center py-6 border-2 border-dashed rounded-apple-lg transition-colors ${
                            isHoveringThisColumn && dragging
                                ? "border-blue-400 bg-blue-50 text-blue-600"
                                : "border-apple-gray-200 text-apple-gray-500"
                        }`}
                    >
                        {isHoveringThisColumn && dragging ? "Drop here" : "Empty"}
            </div>
        ) : (
            isHoveringEmptyArea && dragging && (
                        <DropIndicator />
                    )
                )}
            </div>
        </div>
    );
}
