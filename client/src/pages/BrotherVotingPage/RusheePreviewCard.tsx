import React from "react";
import { useBrotherVotingContext } from "./BrotherVotingContext";

interface Props {
    midtermMode?: boolean;
}

export default function RusheePreviewCard({ midtermMode = false }: Props) {
    const { rushee } = useBrotherVotingContext();

    if (!rushee) {
        return (
            <div className="card-apple p-6 text-center">
                <p className="text-apple-body text-apple-gray-500 font-light italic">
                    Waiting for rushee selection...
                </p>
            </div>
        );
    }

    if (midtermMode) {
        return (
            <div className="card-apple flex flex-col overflow-hidden h-full">
                {/* Photo fills top portion */}
                <img
                    src={rushee.image_url}
                    alt={`${rushee.first_name} ${rushee.last_name}`}
                    className="w-full aspect-square object-cover"
                />
                {/* Info below the photo */}
                <div className="p-6 flex flex-col gap-2">
                    <h2 className="text-3xl font-semibold text-black leading-tight">
                        {rushee.first_name} {rushee.last_name}
                    </h2>
                    <p className="text-lg text-apple-gray-500 font-light">
                        GTID: {rushee.gtid}
                    </p>
                    <p className="text-lg text-apple-gray-500 font-light">
                        {rushee.major}
                    </p>
                    <p className="text-lg text-apple-gray-500 font-light">
                        {rushee.pronouns}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card-apple flex flex-row items-center gap-6 p-6">
            <img
                src={rushee.image_url}
                alt={`${rushee.first_name} ${rushee.last_name}`}
                className="w-32 h-32 object-cover rounded-apple-xl border border-apple-gray-200 flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold text-black">
                    {rushee.first_name} {rushee.last_name}
                </h2>
                <p className="text-lg text-apple-gray-600 mt-1">
                    GTID: {rushee.gtid}
                </p>
                <div className="flex flex-wrap gap-3 text-lg text-apple-gray-600 mt-2">
                    <span>{rushee.major}</span>
                    <span>•</span>
                    <span>{rushee.pronouns}</span>
                </div>
            </div>
        </div>
    );
}
