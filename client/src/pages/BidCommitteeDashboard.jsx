import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import Error from "../components/Error";
import Loader from "../components/Loader";
import Badges from "../components/Badge";
import { verifyUser } from "../js/verifications";
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
        let filtered = rushees;

        // Filter by major
        if (selectedMajor !== "All") {
            filtered = filtered.filter((rushee) => rushee.major === selectedMajor);
        }

        // Filter by class
        if (selectedClass !== "All") {
            filtered = filtered.filter((rushee) => rushee.class === selectedClass);
        }

        // Filter by query (search by GTID only)
        if (query.trim() !== "") {
            // Only allow 9-digit GTID for exact matching
            if (query.trim().length === 9 && /^[0-9]+$/.test(query.trim())) {
                const exactMatch = filtered.find(rushee => rushee.gtid === query.trim());
                if (exactMatch) {
                    filtered = [exactMatch];
                } else {
                    filtered = []; // No results for exact GTID match
                }
            } else {
                // Invalid GTID format - show no results
                filtered = [];
            }
        }

        // Sort by selected criterion
        if (selectedSort === "firstName") {
            filtered = [...filtered].sort((a, b) => a.name.split(" ")[0].localeCompare(b.name.split(" ")[0]));
        } else if (selectedSort === "lastName") {
            filtered = [...filtered].sort((a, b) => {
                const aLastName = a.name.split(" ").slice(-1)[0];
                const bLastName = b.name.split(" ").slice(-1)[0];
                return aLastName.localeCompare(bLastName);
            });
        } else if (selectedSort === "rusheeId") {
            // Sort by registration order (sequential number)
            filtered = [...filtered].sort((a, b) => a.registration_order - b.registration_order);
        }

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
                                    <div className="card-apple p-6 mb-8">
                                        {/* Search Bar */}
                                        <div className="mb-4">
                                            <input
                                                type="text"
                                                value={query}
                                                onChange={handleSearch}
                                                placeholder="Search by 9-digit GTID..."
                                                className="input-apple text-apple-body"
                                                maxLength="9"
                                                pattern="[0-9]{9}"
                                            />
                                        </div>

                                        {/* Filters */}
                                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                                            <div className="flex flex-wrap gap-3">
                                                {/* Major Filter */}
                                                <div>
                                                    <select
                                                        value={selectedMajor}
                                                        onChange={(e) => setSelectedMajor(e.target.value)}
                                                        className="input-apple text-apple-body"
                                                    >
                                                        <option value="All">All Majors</option>
                                                        {Array.from(new Set(rushees.map((rushee) => rushee.major))).map((major, idx) => (
                                                            <option key={idx} value={major}>
                                                                {major}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Class Filter */}
                                                <div>
                                                    <select
                                                        value={selectedClass}
                                                        onChange={(e) => setSelectedClass(e.target.value)}
                                                        className="input-apple text-apple-body"
                                                    >
                                                        <option value="All">All Classes</option>
                                                        {Array.from(new Set(rushees.map((rushee) => rushee.class))).map((classYear, idx) => (
                                                            <option key={idx} value={classYear}>
                                                                {classYear}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Sorting Dropdown */}
                                                <div>
                                                    <select
                                                        value={selectedSort}
                                                        onChange={(e) => setSelectedSort(e.target.value)}
                                                        className="input-apple text-apple-body"
                                                    >
                                                        <option value="none">No Sorting</option>
                                                        <option value="rusheeId">Sort by Rushee ID</option>
                                                        <option value="firstName">Sort by First Name</option>
                                                        <option value="lastName">Sort by Last Name</option>
                                                    </select>
                                                </div>

                                            </div>

                                            {/* Shuffle and Export Buttons */}
                                            <div className="mt-2 sm:mt-0 flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        const shuffled = shuffleArray(rushees);
                                                        setFilteredRushees(shuffled);
                                                    }}
                                                    className="btn-apple-secondary px-6 py-3 text-apple-body font-light"
                                                >
                                                    Shuffle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="container mx-auto px-4 max-w-7xl">
                                    <div className="grid gap-6 mt-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                        {filteredRushees.map((rushee) => {
                                            const rusheeId = getRusheeId(rushee.gtid);
                                            return (
                                                <div
                                                    onClick={() => {
                                                        const rusheeNum = getRusheeId(rushee.gtid);
                                                        window.open(`/brother/rushee/${rushee.gtid}?bid_committee=true&rushee_num=${rusheeNum}`, "_blank");
                                                    }}
                                                    key={rushee.id}
                                                    className="card-apple cursor-pointer hover:border-apple-gray-300 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                                >
                                                    {/* Numbered Picture */}
                                                    <div className="w-full h-48 bg-apple-gray-100 flex items-center justify-center rounded-t-apple-2xl border-b border-apple-gray-200">
                                                        <span className="text-6xl font-light text-black">
                                                            {rusheeId}
                                                        </span>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex flex-col flex-grow p-4">
                                                        <div className="flex flex-row gap-4 items-center mb-2">
                                                            <h2 className="text-apple-title1 font-normal text-black truncate">
                                                                Rushee #{rusheeId}
                                                            </h2>
                                                            {rushee.attendance.map((event, idx) => (
                                                                <Badges text={event.name} key={idx} />
                                                            ))}
                                                        </div>
                                                        
                                                        <p className="text-apple-footnote text-apple-gray-600 font-light mb-1 truncate">
                                                            {rushee.major}
                                                        </p>
                                                        
                                                        <p className="text-apple-footnote text-apple-gray-600 font-light mb-1 truncate">
                                                            {rushee.class}
                                                        </p>
                                                        
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {rushee.ratings.map((rating, rIdx) => (
                                                                <span
                                                                    key={rIdx}
                                                                    className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                                                >
                                                                    {rating.name}: {((rating.value / 5) * 100).toFixed(0)}%
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
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