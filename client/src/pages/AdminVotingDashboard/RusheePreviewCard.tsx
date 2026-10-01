import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

import { adminPost } from "../../features/admin/api";
import { useAdminVotingContext } from "./AdminVotingContext";
import CurrentRusheePreview from "./CurrentRusheePreview";
import RusheePreviewSearch from "./RusheePreviewSearch";
import { filterPreviewRushees } from "./previewRusheeSearch";
import type { Rushee } from "./types";

export default function RusheePreviewCard() {
    const { rushee } = useAdminVotingContext();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allRushees, setAllRushees] = useState<Rushee[] | null>(null);
    const [loading, setLoading] = useState(false);

    const api = import.meta.env.VITE_API_PREFIX;

    const filteredRushees = useMemo(
        () => filterPreviewRushees(allRushees, searchQuery),
        [allRushees, searchQuery],
    );

    const handleSearchClick = async () => {
        setSearchOpen(true);
        if (!allRushees) {
            setLoading(true);
            try {
                const response = await axios.get(`${api}/rushee/get-rushees`);
                if (response.data.status === "success") {
                    console.log("Rushees data structure:", response.data.payload[0]);
                    setAllRushees(response.data.payload);
                } else {
                    console.error("Failed to fetch rushees");
                }
            } catch {
                console.error("Network error while fetching rushees");
            }
            setLoading(false);
        }
    };

    const handleCloseSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };

    const handleSelect = async (selected: Rushee) => {
        const payload = { gtid: selected.gtid };

        await toast.promise(
            adminPost(`${api}/admin/voting/change-rushee`, payload),
            {
                pending: "Updating rushee...",
                success: "Rushee updated successfully!",
                error: "Failed to update rushee",
            },
            {
                position: "top-center",
                theme: "light",
            }
        );

        handleCloseSearch();
    };

    return (
        <div className="relative w-full">
            <RusheePreviewSearch
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchOpen={searchOpen}
                loading={loading}
                filteredRushees={filteredRushees}
                handleSearchClick={handleSearchClick}
                handleCloseSearch={handleCloseSearch}
                handleSelect={handleSelect}
            />
            <CurrentRusheePreview rushee={rushee} />
        </div>
    );
}
