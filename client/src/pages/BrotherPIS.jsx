import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { verifyUser } from "../features/auth/verifyUser";
import BrotherPisSlotSelectionView from "../features/brotherPis/BrotherPisSlotSelectionView";
import { loadBrotherPisSlots } from "../features/brotherPis/loadBrotherPisSlots";
import { submitBrotherPisSlot } from "../features/brotherPis/submitBrotherPisSlot";

const api = import.meta.env.VITE_API_PREFIX;

export default function BrotherPIS() {
    const user = JSON.parse(localStorage.getItem("user"));

    const [days, setDays] = useState(new Map());
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        if (loading === true) {
            loadBrotherPisSlots({
                verifyUser,
                navigate,
                axios,
                api,
                setDays,
                setLoading,
                logPayload: (payload) => console.log(payload),
            });
        }
    }, [loading, navigate]);

    const handleSlotSelection = (day, slot) => {
        const slotKey = `${day}zz${slot.time.toISOString()}zz${slot.rushee_gtid}`;
        setSelectedSlot(selectedSlot === slotKey ? null : slotKey);
    };

    const handleSubmit = () => submitBrotherPisSlot({
        selectedSlot,
        user,
        axios,
        api,
        toast,
        alert,
        reload: () => window.location.reload(),
        logError: (...args) => console.error(...args),
    });

    return (
        <BrotherPisSlotSelectionView
            days={days}
            selectedSlot={selectedSlot}
            loading={loading}
            onSelect={handleSlotSelection}
            onSubmit={handleSubmit}
        />
    );
}
