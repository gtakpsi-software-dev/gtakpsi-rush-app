import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";

import { useNavigate } from "react-router-dom";

import { useMidtermMode } from "../contexts/MidtermModeContext";

import Fuse from "fuse.js";

import { verifyUser } from "../features/auth/verifyUser";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useCommentVisibility } from "../features/comments/useCommentVisibility";
import { filterDashboardRushees, shuffleArray } from "../features/dashboard/list";
import { loadDashboardData } from "../features/dashboard/loadDashboardData";
import DashboardView from "../features/dashboard/DashboardView";
import type { DashboardAvailabilityUser, DashboardCard } from "../features/dashboard/DashboardView";

type DashboardProps = { user?: unknown };

export default function Dashboard(props: DashboardProps) {
    const { isMidtermMode } = useMidtermMode();
    const { showAll: showRatings } = useCommentVisibility();
    // Keep the legacy initializer: it still parses the stored identity during render.
    useState(
        props.user ? props.user : JSON.parse(localStorage.getItem("user"))
    );
    const [loading, setLoading] = useState(true);
    const [errorTitle] = useState("Uh Oh! Something unexpected happened.");
    const [errorDescription, setErrorDescription] = useState("");
    const [error, setError] = useState(false);
    const [rushees, setRushees] = useState<DashboardCard[]>([]);
    const [filteredRushees, setFilteredRushees] = useState<DashboardCard[]>([]);
    const [query, setQuery] = useState("");
    const [selectedMajor, setSelectedMajor] = useState("All");
    const [selectedClass, setSelectedClass] = useState("All");
    // Preserve this unused slot so the remaining state hooks retain their positions.
    useState("All");
    const [selectedSort, setSelectedSort] = useState("none");

    // PIS Availability Modal state
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [brotherData, setBrotherData] = useState<DashboardAvailabilityUser | null>(null);

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


    const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
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
        <DashboardView
            status={{ loading, error, errorTitle, errorDescription }}
            availability={{
                open: showAvailabilityModal,
                user: brotherData,
                onSubmit: () => setShowAvailabilityModal(false),
            }}
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
                isMidtermMode,
                showRatings,
                onOpen: (rushee) => window.open(`/brother/rushee/${rushee.gtid}`, "_blank"),
            }}
        />
    );
}
