import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { verifyUser } from "../features/auth/verifyUser";
import { createAddTimeslotActions } from "../features/admin/pis/createAddTimeslotActions";
import AddTimeslotForm from "../features/admin/pis/AddTimeslotForm";

export default function AddTimeslotPage() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [result, setResult] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        async function checkAuth() {
            try {
                const isValid = await verifyUser();
                if (!isValid) {
                    navigate('/error/Invalid User Credentials/If this is a mistake, try logging back in');
                }
                setLoading(false);
            } catch (error) {
                console.error('Auth error:', error);
                navigate('/error/Invalid User Credentials/If this is a mistake, try logging back in');
            }
        }

        if (loading) {
            checkAuth();
        }
    }, [navigate, loading]);

    const { handleAddTimeslot } = createAddTimeslotActions({
        apiBase,
        timeslotTime,
        timeslotChange,
        setResult,
        setIsSubmitting,
        setTimeslotTime,
        setTimeslotChange,
        setShowSuccess,
        axios,
        scheduleTimeout: setTimeout,
    });

    return loading ? (
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-r from-blue-50 to-orange-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    ) : (
        <AddTimeslotForm
            timeslotTime={timeslotTime}
            setTimeslotTime={setTimeslotTime}
            timeslotChange={timeslotChange}
            setTimeslotChange={setTimeslotChange}
            result={result}
            isSubmitting={isSubmitting}
            showSuccess={showSuccess}
            handleAddTimeslot={handleAddTimeslot}
        />
    );
}
