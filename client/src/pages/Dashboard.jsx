import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";

import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";

import Error from "../components/Error";
import Loader from "../components/Loader";
import { useMidtermMode } from "../contexts/MidtermModeContext";

import Fuse from "fuse.js";

import { verifyUser } from "../features/auth/verifyUser";
import Button from "../components/Button";
import PISAvailabilityModal from "../components/PISAvailabilityModal";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useCommentVisibility } from "../hooks/useCommentVisibility";
import { filterDashboardRushees, shuffleArray } from "../features/dashboard/list";
import { loadDashboardData } from "../features/dashboard/loadDashboardData";
import DashboardRusheeCard from "../features/dashboard/DashboardRusheeCard";
import DashboardFilters from "../features/dashboard/DashboardFilters";

export default function Dashboard(props) {
    const { isMidtermMode } = useMidtermMode();
    const { showAll: showRatings } = useCommentVisibility();
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

    useEffect(() => {
        if (loading === true) {
            loadDashboardData({
                verifyUser,
                navigate,
                auth,
                db,
                doc,
                getDoc,
                axios,
                api,
                shuffleArray,
                setLoading,
                setBrotherData,
                setShowAvailabilityModal,
                setRushees,
                setFilteredRushees,
                setErrorDescription,
                setError,
            });
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
    };

    const handleFilters = () => {
        const filtered = filterDashboardRushees(
            rushees,
            { selectedMajor, selectedClass, query, selectedSort },
            fuse
        );

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
                                    <DashboardFilters
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

                                    {/* Rushee Cards Grid */}
                                                                            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {filteredRushees.map((rushee) => (
                                            <DashboardRusheeCard
                                                key={rushee.id}
                                                rushee={rushee}
                                                isMidtermMode={isMidtermMode}
                                                showRatings={showRatings}
                                                onOpen={() => window.open(`/brother/rushee/${rushee.gtid}`, "_blank")}
                                            />
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
