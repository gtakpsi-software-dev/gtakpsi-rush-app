import { TAGS } from "./board";

type ReadOnlyDetailsPanelProps = {
    selectedRushee: {
        fullName: string;
        sortingStatus: string;
    };
    notesLoading: boolean;
    notesTags: string[];
    notes: string;
    onClose: () => void;
    onViewRushee: () => void;
};

export default function ReadOnlyDetailsPanel({
    selectedRushee,
    notesLoading,
    notesTags,
    notes,
    onClose,
    onViewRushee,
}: ReadOnlyDetailsPanelProps) {
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
                            {selectedRushee.fullName}
                        </div>
                        <div className="text-sm text-apple-gray-500 mt-1">
                            {selectedRushee.sortingStatus.replace("_", " ")}
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
                <div className="p-4 flex-1 overflow-auto" data-scrollable>
                    {notesLoading ? (
                        <div className="text-apple-body text-apple-gray-500 text-center py-4">
                            Loading notes...
                        </div>
                    ) : (
                        <>
                            {notesTags && notesTags.length > 0 && (
                                <div className="mb-4">
                                    <div className="text-sm font-medium text-apple-gray-700 mb-2">Tags</div>
                                    <div className="flex flex-wrap gap-2">
                                        {notesTags.map((tagKey) => {
                                            const tagInfo = TAGS.find((t) => t.key === tagKey);
                                            if (!tagInfo) return null;
                                            return (
                                                <span
                                                    key={tagKey}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border ${tagInfo.color}`}
                                                >
                                                    {tagInfo.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="mb-4">
                                <div className="text-sm font-medium text-apple-gray-700 mb-2">Notes</div>
                                {notes ? (
                                    <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 whitespace-pre-wrap text-apple-body text-black">
                                        {notes}
                                    </div>
                                ) : (
                                    <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 text-apple-body text-apple-gray-400 italic">
                                        No notes yet
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 rounded-apple-lg p-3 border border-amber-200">
                                <p className="text-apple-footnote text-amber-700 text-center">
                                    This is a view-only board. Contact an admin to make changes.
                                </p>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 border-t border-apple-gray-200 flex justify-end gap-2">
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
        </>
    );
}
