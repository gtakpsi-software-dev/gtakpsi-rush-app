import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import Error from "../components/Error";
import Loader from "../components/Loader";
import { verifyUser } from "../features/auth/verifyUser";
import { filterBidCommitteeRushees } from "../features/dashboard/bidCommitteeList";
import BidCommitteeRusheeCard from "../features/dashboard/BidCommitteeRusheeCard";
import BidCommitteeFilters from "../features/dashboard/BidCommitteeFilters";
import Button from "../components/Button";

export default function BidCommitteeDashboard(props) {
    const [user, setUser] = useState(
        props.user ? props.user : JSON.parse(localStorage.getItem("user"))
    );
    const [loading, setLoading] = useState(true);
    const [errorTitle, setErrorTitle] = useState("Uh Oh! Something unexpected happened.");
    const [errorDescription, setErrorDescription] = useState("");
    const [error, setError] = useState(false);
    const [rushees, setRushees] = useState([]);
    const [filteredRushees, setFilteredRushees] = useState([]);
    const [query, setQuery] = useState("");
    const [selectedMajor, setSelectedMajor] = useState("All");
    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedSort, setSelectedSort] = useState("none");
    const [rusheeNumberMap, setRusheeNumberMap] = useState({});  // Map GTID -> formatted number

    const navigate = useNavigate();
    const api = import.meta.env.VITE_API_PREFIX;

    // Function to get rushee number from the map (formatted as 001, 002, etc.)
    const getRusheeId = (gtid) => {
        return rusheeNumberMap[gtid] || "---";
    };

    // Function to generate a placeholder image with number (Apple-themed)
    const getPlaceholderImage = (rusheeId) => {
        // Create a canvas-based placeholder image with the number
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        
        // Light gray background (Apple-themed)
        ctx.fillStyle = '#f9fafb'; // apple-gray-50
        ctx.fillRect(0, 0, 300, 300);
        
        // Add number
        ctx.fillStyle = '#000000'; // Black text
        ctx.font = '300 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'; // Light weight system font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rusheeId.toString(), 150, 150);
        
        return canvas.toDataURL();
    };

    function shuffleArray(array) {
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
                                const numberMap = {};
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

    const handleSearch = (e) => {
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
        <div>
            {error ? (
                <Error title={errorTitle} description={errorDescription} />
            ) : (
                <div>
                    {loading ? (
                        <Loader />
                    ) : (
                        <div className="min-h-screen w-full bg-white overflow-y-scroll">
                            <Navbar />

                            <div className="pt-24 p-4 pb-20">
                                <div className="container mx-auto px-4 max-w-7xl">


                                    {/* Search and Filters */}
                                    <BidCommitteeFilters
                                        query={query}
                                        handleSearch={handleSearch}
                                        rushees={rushees}
                                        selectedMajor={selectedMajor}
                                        setSelectedMajor={setSelectedMajor}
                                        selectedClass={selectedClass}
                                        setSelectedClass={setSelectedClass}
                                        selectedSort={selectedSort}
                                        setSelectedSort={setSelectedSort}
                                        onShuffle={() => {
                                            const shuffled = shuffleArray(rushees);
                                            setFilteredRushees(shuffled);
                                        }}
                                    />
                                </div>

                                <div className="container mx-auto px-4 max-w-7xl">
                                    <div className="grid gap-6 mt-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                        {filteredRushees.map((rushee) => {
                                            const rusheeId = getRusheeId(rushee.gtid);
                                            return (
                                                <BidCommitteeRusheeCard
                                                    key={rushee.id}
                                                    rushee={rushee}
                                                    rusheeId={rusheeId}
                                                    onOpen={() => {
                                                        const rusheeNum = getRusheeId(rushee.gtid);
                                                        window.open(`/brother/rushee/${rushee.gtid}?bid_committee=true&rushee_num=${rusheeNum}`, "_blank");
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="h-16" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
