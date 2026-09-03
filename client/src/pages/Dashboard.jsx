import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";

import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";

import Error from "../components/Error";
import Loader from "../components/Loader";
import Badges from "../components/Badge";
import RusheeInteractionsByNight from "../components/RusheeInteractionsByNight";
import { useMidtermMode } from "../contexts/MidtermModeContext";

import Fuse from "fuse.js";

import { verifyUser } from "../js/verifications";
import Button from "../components/Button";
import PISAvailabilityModal from "../components/PISAvailabilityModal";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Dashboard(props) {
    const { isMidtermMode } = useMidtermMode();
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
    const [selectedCloud, setSelectedCloud] = useState("All");
    const [selectedSort, setSelectedSort] = useState("none");
    
    // PIS Availability Modal state
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [brotherData, setBrotherData] = useState(null);

    const navigate = useNavigate();
    const api = import.meta.env.VITE_API_PREFIX;

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

                    // Check if brother needs to fill out PIS availability form
                    const currentUser = auth.currentUser;
                    if (currentUser) {
                        try {
                            // Get brother data from Firestore
                            const brotherDoc = await getDoc(doc(db, "brothers", currentUser.uid));
                            if (brotherDoc.exists()) {
                                setBrotherData({
                                    uid: currentUser.uid,
                                    email: currentUser.email,
                                    ...brotherDoc.data()
                                });
                            } else {
                                setBrotherData({
                                    uid: currentUser.uid,
                                    email: currentUser.email,
                                    firstName: '',
                                    lastName: ''
                                });
                            }

                            // Check if form is active and brother hasn't submitted
                            const checkResponse = await axios.post(`${api}/brother/pis-availability/check`, {
                                brother_uid: currentUser.uid
                            });
                            
                            if (checkResponse.data.status === "success" && checkResponse.data.needs_form) {
                                setShowAvailabilityModal(true);
                            }
                        } catch (err) {
                            console.log("Error checking PIS availability:", err);
                        }
                    }

                    await axios
                        .get(`${api}/rushee/get-rushees`)
                        .then((response) => {
                            if (response.data.status === "success") {

                                console.log(response.data.payload.length)

                                const shuffledRushees = shuffleArray(response.data.payload); // Shuffle the array
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

    const fuse = new Fuse(rushees, {
        keys: ["name", "gtid", "major", "email"],
        threshold: 0.3, // Less strict
        minMatchCharLength: 1, // Minimum length of matching characters
    });


    const handleSearch = (e) => {
        const input = e.target.value;
        console.log(input)
        setQuery(input);

        // if (input.trim() === "") {
        //     setFilteredRushees(rushees);
        // } else {
        //     const fuzzyResults = fuse.search(input);
        //     setFilteredRushees(fuzzyResults.map((result) => result.item)); // Extract matching items
        // }
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

        // Filter by query
        if (query.trim() !== "") {
            // Check if query is a 9-digit GTID for exact matching
            if (query.trim().length === 9 && /^[0-9]+$/.test(query.trim())) {
                const exactMatch = filtered.find(rushee => rushee.gtid === query.trim());
                if (exactMatch) {
                    filtered = [exactMatch];
                } else {
                    filtered = []; // No results for exact GTID match
                }
            } else {
                // Use fuzzy search for other queries
                const fuzzyResults = fuse.search(query);
                filtered = fuzzyResults.map((result) => result.item);
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
        }

        console.log(filtered)
        setFilteredRushees(filtered);
    };

    useEffect(() => {
        handleFilters();
    }, [query, selectedMajor, selectedClass, selectedSort]);

    return (
        <div>
            {/* PIS Availability Modal - Blocking */}
            {showAvailabilityModal && brotherData && (
                <PISAvailabilityModal
                    user={brotherData}
                    onSubmit={() => setShowAvailabilityModal(false)}
                />
            )}
            
            {error ? (
                <Error title={errorTitle} description={errorDescription} />
            ) : (
                <div>
                    {loading ? (
                        <Loader />
                    ) : (
                        <div className="h-screen w-screen bg-white overflow-y-scroll">
                            <Navbar />

                            <div className="pt-24 p-4 pb-20">
                                <div className="container mx-auto px-4 max-w-7xl">
                                    

                                    {/* Search and Filters */}
                                    <div className="card-apple p-6 mb-6">
                                        {/* Search Bar */}
                                        <div className="mb-4">
                                            <input
                                                type="text"
                                                value={query}
                                                onChange={handleSearch}
                                                placeholder="Search by name, email, major, or GTID..."
                                                className="input-apple text-apple-body"
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
                                                        <option value="All">All Years</option>
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
                                                        <option value="firstName">First Name</option>
                                                        <option value="lastName">Last Name</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Shuffle Button */}
                                            <div className="mt-2 sm:mt-0">
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

                                    {/* Rushee Cards Grid */}
                                                                            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {filteredRushees.map((rushee) => (
                                            <div
                                                onClick={isMidtermMode ? undefined : () => {
                                                    window.open(`/brother/rushee/${rushee.gtid}`, "_blank");
                                                }}
                                                key={rushee.id}
                                                className={`card-apple transition-all duration-200 ${isMidtermMode ? "cursor-default" : "cursor-pointer hover:border-apple-gray-300 hover:scale-[1.02] active:scale-[0.98]"}`}
                                            >
                                                {/* Picture */}
                                                <img
                                                    className="w-full h-48 object-cover rounded-t-apple-2xl"
                                                    src={rushee.image_url}
                                                    alt={rushee.name}
                                                />

                                                {/* Content */}
                                                <div className="p-5">
                                                    <div className="flex flex-col gap-2 mb-3">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h2 className="text-apple-title1 font-normal text-black leading-tight">
                                                                {rushee.name}
                                                            </h2>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rushee.attendance.map((event, idx) => (
                                                                <Badges text={event.name} key={idx} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-1 mb-3">
                                                        <p className="text-apple-footnote text-apple-gray-600 font-light truncate">
                                                            {rushee.email}
                                                        </p>
                                                        <p className="text-apple-footnote text-apple-gray-600 font-light truncate">
                                                            {rushee.major}
                                                        </p>
                                                        <p className="text-apple-footnote text-apple-gray-600 font-light">
                                                            GTID: {rushee.gtid}
                                                        </p>
                                                        <RusheeInteractionsByNight
                                                            nights={rushee.interactions_by_night}
                                                            compact
                                                        />
                                                    </div>
                                                    
                                                    {rushee.ratings && rushee.ratings.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {rushee.ratings.map((rating, rIdx) => (
                                                                <span
                                                                    key={rIdx}
                                                                    className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                                                >
                                                                    {rating.name}: {rating.value.toFixed(2)}/5.00
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
