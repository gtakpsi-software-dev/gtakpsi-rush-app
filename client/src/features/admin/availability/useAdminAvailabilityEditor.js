import { useState } from "react";
import { groupEditSlots } from "../pis/pisTime";
import { createAvailabilityEditorActions } from "./availabilityEditorActions";

/**
 * Availability Editor Summary:
 * - Keeps editor state and its actions together while preserving their original state-call order.
 * - Returns the same slot grouping and action closures consumed by the admin page.
 * - Existing editor-action and admin-page fixtures pin behavior and rendered markup.
 */
export default function useAdminAvailabilityEditor({
    apiBase,
    getApiPrefix,
    setBrotherAvailabilities,
    axios,
    toast,
}) {
    const [editingBrotherAvailability, setEditingBrotherAvailability] = useState(null);
    const [editingSlots, setEditingSlots] = useState(new Set());
    const [allPisTimeslots, setAllPisTimeslots] = useState([]);
    const [savingAvailability, setSavingAvailability] = useState(false);

    const actions = createAvailabilityEditorActions({
        apiBase,
        getApiPrefix,
        editingBrotherAvailability,
        editingSlots,
        allPisTimeslots,
        setEditingBrotherAvailability,
        setEditingSlots,
        setSavingAvailability,
        setBrotherAvailabilities,
        axios,
        toast,
    });

    return {
        editingBrotherAvailability,
        editingSlots,
        allPisTimeslots,
        setAllPisTimeslots,
        savingAvailability,
        groupedEditSlots: groupEditSlots(allPisTimeslots),
        ...actions,
    };
}
