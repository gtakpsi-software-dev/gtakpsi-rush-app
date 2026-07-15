import React from "react";

export default function RatingSlider({ label, value, notSeen, onValueChange, onNotSeenChange }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="text-apple-body font-normal text-apple-gray-700">
                    {label}
                </label>
                <label className="flex items-center gap-2 text-apple-footnote text-apple-gray-600 font-light cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={notSeen}
                        onChange={(e) => onNotSeenChange(e.target.checked)}
                        className="rounded border-apple-gray-300"
                    />
                    Not seen
                </label>
            </div>
            <div className={`flex items-center gap-3 ${notSeen ? "opacity-40" : ""}`}>
                <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={value}
                    disabled={notSeen}
                    onChange={(e) => onValueChange(Number(e.target.value))}
                    className="flex-1 h-2 accent-black cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-apple-footnote font-medium text-black w-8 text-right tabular-nums">
                    {value}/5
                </span>
            </div>
        </div>
    );
}
