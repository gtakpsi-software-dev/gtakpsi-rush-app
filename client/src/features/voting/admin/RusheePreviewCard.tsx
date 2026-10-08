import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

import { adminPost } from "../../admin/api";
import { useAdminVotingContext } from "./AdminVotingContext";
import CurrentRusheePreview from "./CurrentRusheePreview";
import RusheePreviewSearch from "./RusheePreviewSearch";
import { filterPreviewRushees } from "./previewRusheeSearch";
import type { Rushee } from "./types";

// Manage rushee search and selection for the current voting subject.
export default function RusheePreviewCard() {
    const { rushee } = useAdminVotingContext();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allRushees, setAllRushees] = useState<Rushee[] | null>(null);
    const [loading, setLoading] = useState(false);

    const api = import.meta.env.VITE_API_PREFIX;

    const filteredRushees = useMemo(
        /* Filter cached rushees by the current search query. */ () => filterPreviewRushees(allRushees, searchQuery),
        [allRushees, searchQuery],
    );

    // Open search and fetch the rushee list if it has not been loaded.
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

    // Close search and clear its query.
    const handleCloseSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };

    // Change the current voting rushee, show request feedback, and close search on success.
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
