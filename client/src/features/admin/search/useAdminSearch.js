import { useEffect, useState } from "react";
import { filterBrothers, filterRushees } from "./filterAdminSearch";

// Manage brother and rushee search inputs and their filtered results.
export function useAdminSearch({ brothers, rushees }) {
    const [rusheeSearch, setRusheeSearch] = useState("");
    const [filteredRushees, setFilteredRushees] = useState([]);
    const [brotherSearch, setBrotherSearch] = useState("");
    const [filteredBrothers, setFilteredBrothers] = useState([]);

    useEffect(() => {
        // Refresh rushee matches when the query or source list changes.
        setFilteredRushees(filterRushees(rushees, rusheeSearch));
    }, [rusheeSearch, rushees]);

    useEffect(() => {
        // Refresh brother matches when the query or source list changes.
        setFilteredBrothers(filterBrothers(brothers, brotherSearch));
    }, [brotherSearch, brothers]);

    return {
        rusheeSearch,
        setRusheeSearch,
        filteredRushees,
        setFilteredRushees,
        brotherSearch,
        setBrotherSearch,
        filteredBrothers,
        setFilteredBrothers,
    };
}
