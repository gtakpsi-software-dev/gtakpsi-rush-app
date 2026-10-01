import { useEffect, useState } from "react";
import { filterBrothers, filterRushees } from "./filterAdminSearch";

export function useAdminSearch({ brothers, rushees }) {
    const [rusheeSearch, setRusheeSearch] = useState("");
    const [filteredRushees, setFilteredRushees] = useState([]);
    const [brotherSearch, setBrotherSearch] = useState("");
    const [filteredBrothers, setFilteredBrothers] = useState([]);

    useEffect(() => {
        setFilteredRushees(filterRushees(rushees, rusheeSearch));
    }, [rusheeSearch, rushees]);

    useEffect(() => {
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
