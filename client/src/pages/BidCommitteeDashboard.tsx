import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { verifyUser } from "../features/auth/verifyUser";
import { filterBidCommitteeRushees } from "../features/dashboard/bidCommitteeList";
import BidCommitteeDashboardView from "../features/dashboard/BidCommitteeDashboardView";
import type { BidCommitteeDashboardRushee } from "../features/dashboard/BidCommitteeDashboardView";

type Props = { user?: unknown };

export default function BidCommitteeDashboard(props: Props) {
    // Keep the legacy initializer and hook slot so stored identity is still parsed during render.
    useState(
        props.user ? props.user : JSON.parse(localStorage.getItem("user"))
    );
    const [loading, setLoading] = useState(true);
    const [errorTitle] = useState("Uh Oh! Something unexpected happened.");
    const [errorDescription, setErrorDescription] = useState("");
    const [error, setError] = useState(false);
    const [rushees, setRushees] = useState<BidCommitteeDashboardRushee[]>([]);
    const [filteredRushees, setFilteredRushees] = useState<BidCommitteeDashboardRushee[]>([]);
    const [query, setQuery] = useState("");
    const [selectedMajor, setSelectedMajor] = useState("All");
    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedSort, setSelectedSort] = useState("none");
    const [rusheeNumberMap, setRusheeNumberMap] = useState<Record<string, string>>({});

    const navigate = useNavigate();
    const api = import.meta.env.VITE_API_PREFIX;

    const getRusheeId = (gtid: string) => {
        return rusheeNumberMap[gtid] || "---";
    };

    function shuffleArray(array: BidCommitteeDashboardRushee[]) {
        return array
            .map((value) => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
    }

    useEffect(() => {
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then(async (response) => {
                    if (response === false) {
                        navigate("/");
                    }

                    await axios
                        .get(`${api}/rushee/get-rushees`)
                        .then((response) => {
                            if (response.data.status === "success") {
                                console.log(response.data.payload.length);
                                const fetchedRushees = response.data.payload;

                                // Create the number map based on registration_order
                                const numberMap: Record<string, string> = {};
                                fetchedRushees.forEach((rushee) => {
                                    // Format as 001, 002, etc.
                                    numberMap[rushee.gtid] = String(rushee.registration_order).padStart(3, '0');
                                });
                                setRusheeNumberMap(numberMap);

                                const shuffledRushees = shuffleArray(fetchedRushees);
                                setRushees(shuffledRushees);
                                setFilteredRushees(shuffledRushees);
                            } else {
                                setErrorDescription("There was some issue fetching the rushees");
                                setError(true);
                            }
                        })
                        .catch(() => {
                            setErrorDescription("There was some network error while fetching the rushees.");
                            setError(true);
                        });
                })
                .catch(() => {
                    setErrorDescription("There was an error verifying your credentials.");
                    setError(true);
                });

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
    }, [loading, navigate]);

    // Removed fuzzy search - only using exact GTID matching

    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        console.log(input);
        setQuery(input);
    };

    const handleFilters = () => {
        const filtered = filterBidCommitteeRushees(
            rushees,
            { selectedMajor, selectedClass, query, selectedSort }
        );

        console.log(filtered);
        setFilteredRushees(filtered);
    };

    useEffect(() => {
        handleFilters();
    }, [query, selectedMajor, selectedClass, selectedSort]);

    return (
        <BidCommitteeDashboardView
            status={{ error, errorTitle, errorDescription, loading }}
            filters={{
                query,
                handleSearch,
                rushees,
                selectedMajor,
                setSelectedMajor,
                selectedClass,
                setSelectedClass,
                selectedSort,
                setSelectedSort,
                onShuffle: () => {
                    const shuffled = shuffleArray(rushees);
                    setFilteredRushees(shuffled);
                },
            }}
            cards={{
                rushees: filteredRushees,
                getRusheeId,
                onOpen: (rushee) => {
                    const rusheeNum = getRusheeId(rushee.gtid);
                    window.open(`/brother/rushee/${rushee.gtid}?bid_committee=true&rushee_num=${rusheeNum}`, "_blank");
                },
            }}
        />
    );
}
