import { useState } from "react";
import { createAvailabilityFormActions } from "./availabilityFormActions";

/**
 * Availability Form Summary:
 * - Keeps form lifecycle and submission state beside their existing actions.
 * - Preserves the state-call order needed by the neighboring editor hook.
 * - Returns only display inputs to the view while exposing setters to bootstrap.
 */
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
