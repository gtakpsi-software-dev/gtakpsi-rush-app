import { useState } from "react";
import { createAvailabilityFormActions } from "./availabilityFormActions";

// Manage availability form status, submissions, loading, and management actions.
export default function useAdminAvailabilityForm({ apiBase, axios, toast, confirm }) {
    const [pisFormStatus, setPisFormStatus] = useState({ is_active: false, sent_at: null });
    const [pisFormLoading, setPisFormLoading] = useState(false);
    const [brotherAvailabilities, setBrotherAvailabilities] = useState([]);

    const actions = createAvailabilityFormActions({
        apiBase,
        pisFormStatus,
        setPisFormStatus,
        setPisFormLoading,
        setBrotherAvailabilities,
        axios,
        toast,
        confirm,
    });

    return {
        setPisFormStatus,
        setBrotherAvailabilities,
        view: {
            pisFormStatus,
            pisFormLoading,
            brotherAvailabilities,
            ...actions,
        },
    };
}
