import type { ChangeEvent } from "react";
import { TAGS } from "./board";

type EditableNotesPanelProps = {
    selectedRushee: {
        fullName: string;
        rushNumber: number;
        sortingStatus: string;
    };
    audience: "admin" | "bidcom";
    notesStatus: "idle" | "loading" | "saving" | "saved" | "error";
    tags: string[];
    notes: string;
    onClose: () => void;
    onToggleTag: (tagKey: string) => void;
    onNotesChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    onViewRushee: () => void;
};

// Render editable sorting notes and tags with audience-specific identity labels.
export default function EditableNotesPanel({
    selectedRushee,
    audience,
    notesStatus,
    tags,
    notes,
    onClose,
    onToggleTag,
    onNotesChange,
    onViewRushee,
}: EditableNotesPanelProps) {
    return (
        <>
            <div
                className="fixed inset-0 bg-black/20 z-10"
                onClick={onClose}
            />
            <div className="fixed top-16 bottom-16 right-0 w-full max-w-md bg-white shadow-2xl border-l border-apple-gray-200 z-20 flex flex-col rounded-l-2xl">
                <div className="p-5 border-b border-apple-gray-200 flex items-start justify-between">
                    <div>
                        <div className="text-xl text-black font-semibold">
                            {/* Bid committee members see the rushee number here, not the name. */}
                            {audience === "admin" ? selectedRushee.fullName : `Rushee #${selectedRushee.rushNumber}`}
                        </div>
                        <div className="text-sm text-apple-gray-500 mt-1">
                            {audience === "admin"
                                ? `Rushee #${selectedRushee.rushNumber} • ${selectedRushee.sortingStatus.replace("_", " ")}`
                                : selectedRushee.sortingStatus.replace("_", " ")}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-apple-gray-400 hover:text-black hover:bg-apple-gray-100 rounded-full text-2xl leading-none transition-colors"
                        title="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="p-4 flex-1 overflow-auto flex flex-col gap-4" data-scrollable>
                    {notesStatus === "loading" ? (
                        <div className="text-apple-body text-apple-gray-600">Loading...</div>
                    ) : (
                        <>
                            <div>
                                <div className="text-sm font-medium text-apple-gray-700 mb-2">Tags</div>
                                <div className="flex flex-wrap gap-2">
                                    {TAGS.map((tag) => {
                                        // Render a tag toggle with its current selection state.
                                        const isSelected = tags.includes(tag.key);
                                        return (
                                            <button
                                                key={tag.key}
                                                onClick={/* Toggle this sorting tag. */ () => onToggleTag(tag.key)}
                                                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                                                    isSelected
                                                        ? tag.color + " border-current"
                                                        : "bg-apple-gray-50 text-apple-gray-500 border-apple-gray-200 hover:border-apple-gray-300"
                                                }`}
                                            >
                                                {isSelected && <span className="mr-1">✓</span>}
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <div className="text-sm font-medium text-apple-gray-700 mb-2">Notes</div>
                                <textarea
                                    className="w-full flex-1 min-h-[150px] border border-apple-gray-200 rounded-apple-lg p-3 text-apple-body text-black outline-none focus:border-black resize-none"
                                    value={notes}
                                    onChange={onNotesChange}
                                    placeholder="Add notes about this rushee..."
                                />
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-apple-gray-200 flex justify-between items-center">
                    <span className="text-apple-caption2 text-apple-gray-600">
                        {notesStatus === "saving" && "Saving..."}
                        {notesStatus === "saved" && "✓ Saved"}
                        {notesStatus === "error" && "Error saving notes"}
                        {notesStatus === "idle" && "Autosave enabled"}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={onViewRushee}
                            className="px-4 py-2 bg-black text-white text-apple-body rounded-apple hover:bg-apple-gray-800 transition-colors"
                        >
                            View Rushee Page
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-apple-gray-100 text-apple-body text-black rounded-apple hover:bg-apple-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
