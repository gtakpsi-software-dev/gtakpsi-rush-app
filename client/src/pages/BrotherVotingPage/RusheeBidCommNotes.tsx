import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

const TAGS: { [key: string]: { label: string; color: string } } = {
    night_1: { label: "Night 1", color: "bg-blue-100 text-blue-700 border-blue-200" },
    night_2: { label: "Night 2", color: "bg-purple-100 text-purple-700 border-purple-200" },
    closed_night: { label: "Closed Night", color: "bg-amber-100 text-amber-700 border-amber-200" },
    closed_night_invite: { label: "Closed Night Invite", color: "bg-orange-100 text-orange-700 border-orange-200" },
    pis: { label: "PIS", color: "bg-green-100 text-green-700 border-green-200" },
    hard_no: { label: "Hard No", color: "bg-red-100 text-red-600 border-red-200" },
};

export default function RusheeBidCommNotes() {
    const { rushee } = useBrotherVotingContext();

    if (!rushee) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No rushee selected
            </p>
        );
    }

    const hasNotes = rushee.sorting_notes && rushee.sorting_notes.trim().length > 0;
    const hasTags = rushee.sorting_tags && rushee.sorting_tags.length > 0;

    if (!hasNotes && !hasTags) {
        return (
            <p className="text-lg text-apple-gray-500 font-light italic">
                No bid committee notes available
            </p>
        );
    }

    return (
        <div className="space-y-5">
            {/* Tags */}
            {hasTags && (
                <div className="space-y-3">
                    <p className="text-base text-apple-gray-600 font-semibold uppercase tracking-wide">
                        Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {rushee.sorting_tags!.map((tagKey) => {
                            const tagInfo = TAGS[tagKey];
                            if (!tagInfo) return null;
                            return (
                                <span
                                    key={tagKey}
                                    className={`px-4 py-2 rounded-full text-base font-medium border ${tagInfo.color}`}
                                >
                                    {tagInfo.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Notes */}
            {hasNotes && (
                <div className="space-y-3">
                    <p className="text-base text-apple-gray-600 font-semibold uppercase tracking-wide">
                        Notes
                    </p>
                    <div className="bg-apple-gray-50 border border-apple-gray-200 rounded-apple p-4">
                        <p className="text-lg text-black font-light whitespace-pre-wrap leading-relaxed">
                            {rushee.sorting_notes}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
