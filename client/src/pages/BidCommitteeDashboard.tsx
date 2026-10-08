import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { verifyUser } from "../features/auth/verifyUser";
import { filterBidCommitteeRushees } from "../features/dashboard/bidCommitteeList";
import BidCommitteeDashboardView from "../features/dashboard/BidCommitteeDashboardView";
import type { BidCommitteeDashboardRushee } from "../features/dashboard/BidCommitteeDashboardView";

type Props = { user?: unknown };

// Manage committee dashboard loading, anonymous IDs, exact GTID search, and filters.
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

    // Return the committee-facing rushee ID or a placeholder when unavailable.
    const getRusheeId = (gtid: string) => {
        return rusheeNumberMap[gtid] || "---";
    };

    // Return a shuffled copy using randomly assigned sort keys.
    function shuffleArray(array: BidCommitteeDashboardRushee[]) {
        return array
            .map(/* Assign a random sort key to a rushee. */ (value) => ({ value, sort: Math.random() }))
            .sort(/* Compare the randomly assigned sort keys. */ (a, b) => a.sort - b.sort)
            .map(/* Extract the rushee after sorting. */ ({ value }) => value);
    }

    useEffect(() => {
        // Load the committee dashboard while loading is true.
        // Verify access, load rushees, and finish the loading state.
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then(async (response) => {
                    // Redirect failed verification and continue the rushee-list request.
                    if (response === false) {
                        navigate("/");
                    }

                    await axios
                        .get(`${api}/rushee/get-rushees`)
                        .then((response) => {
                            // Build anonymous IDs and store shuffled rushees, or report an unsuccessful response.
                            if (response.data.status === "success") {
                                console.log(response.data.payload.length);
                                const fetchedRushees = response.data.payload;

                                const numberMap: Record<string, string> = {};
                                fetchedRushees.forEach((rushee) => {
                                    // Index each GTID by its zero-padded registration number.
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
                            // Report a network failure while loading committee rushees.
                            setErrorDescription("There was some network error while fetching the rushees.");
                            setError(true);
                        });
                })
                .catch(() => {
                    // Report a failure to verify the current user.
                    setErrorDescription("There was an error verifying your credentials.");
                    setError(true);
                });

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
    }, [loading, navigate, api]);

    // Removed fuzzy search - only using exact GTID matching

    // Update and log the exact-GTID search query.
    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        console.log(input);
        setQuery(input);
    };

    // Apply current committee filters and sorting to the displayed rushees.
    const handleFilters = () => {
        const filtered = filterBidCommitteeRushees(
            rushees,
            { selectedMajor, selectedClass, query, selectedSort }
        );

        console.log(filtered);
        setFilteredRushees(filtered);
    };

    useEffect(() => {
        // Reapply filters when a search or filter selection changes.
        handleFilters();
        // Preserve the original filter triggers; loading new rushees alone did not reapply filters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                // Shuffle the full rushee list into the displayed list.
                onShuffle: () => {
                    const shuffled = shuffleArray(rushees);
                    setFilteredRushees(shuffled);
                },
            }}
            cards={{
                rushees: filteredRushees,
                getRusheeId,
                // Open the selected profile in a new tab with committee mode and its anonymous ID.
                onOpen: (rushee) => {
                    const rusheeNum = getRusheeId(rushee.gtid);
                    window.open(`/brother/rushee/${rushee.gtid}?bid_committee=true&rushee_num=${rusheeNum}`, "_blank");
                },
            }}
        />
    );
}
