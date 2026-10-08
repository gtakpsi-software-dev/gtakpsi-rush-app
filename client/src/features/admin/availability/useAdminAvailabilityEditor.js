import { useState } from "react";
import { groupEditSlots } from "../pis/pisTime";
import { createAvailabilityEditorActions } from "./availabilityEditorActions";

// Manage the availability editor’s selected brother, slots, saving state, and actions.
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
