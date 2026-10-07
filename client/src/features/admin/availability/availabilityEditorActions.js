export function createAvailabilityEditorActions({
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
}) {
    const openEditAvailability = (brother) => {
        setEditingBrotherAvailability(brother);
        // Normalize both stored date formats so selections match the timeslot keys.
        const slots = new Set();
        if (brother.available_timeslots) {
            brother.available_timeslots.forEach(ts => {
                let isoString;
                if (ts.$date && ts.$date.$numberLong) {
                    isoString = new Date(parseInt(ts.$date.$numberLong)).toISOString();
                } else {
                    isoString = new Date(ts).toISOString();
                }
                slots.add(isoString);
            });
        }
        setEditingSlots(slots);
    };

    const closeEditAvailability = () => {
        setEditingBrotherAvailability(null);
        setEditingSlots(new Set());
    };

    const toggleEditSlot = (slotIso) => {
        const newSlots = new Set(editingSlots);
        if (newSlots.has(slotIso)) {
            newSlots.delete(slotIso);
        } else {
            newSlots.add(slotIso);
        }
        setEditingSlots(newSlots);
    };

    const selectAllEditSlots = () => {
        const allSlots = new Set(allPisTimeslots.map(slot =>
            new Date(parseInt(slot.time.$date.$numberLong)).toISOString()
        ));
        setEditingSlots(allSlots);
    };

    const clearAllEditSlots = () => {
        setEditingSlots(new Set());
    };

    const saveEditedAvailability = async () => {
        if (!editingBrotherAvailability) return;

        setSavingAvailability(true);
        try {
            const api = getApiPrefix();
            const response = await axios.post(`${api}/brother/pis-availability/submit`, {
                brother_uid: editingBrotherAvailability.brother_uid,
                brother_email: editingBrotherAvailability.brother_email,
                brother_first_name: editingBrotherAvailability.brother_first_name,
                brother_last_name: editingBrotherAvailability.brother_last_name,
                available_timeslots: Array.from(editingSlots)
            });

            if (response.data.status === "success") {
                toast.success(`Updated availability for ${editingBrotherAvailability.brother_first_name}`, {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });

                // Refresh server-assigned values before closing the editor.
                const availabilitiesResponse = await axios.get(`${apiBase}/pis-availability/all`);
                if (availabilitiesResponse.data.status === "success") {
                    setBrotherAvailabilities(availabilitiesResponse.data.payload);
                }

                closeEditAvailability();
            } else {
                toast.error(response.data.message || "Failed to update", {
                    position: "top-center",
                    autoClose: 3000,
                    theme: "dark",
                });
            }
        } catch {
            toast.error("Failed to save availability", {
                position: "top-center",
                autoClose: 3000,
                theme: "dark",
            });
        } finally {
            setSavingAvailability(false);
        }
    };

    return {
        openEditAvailability,
        closeEditAvailability,
        toggleEditSlot,
        selectAllEditSlots,
        clearAllEditSlots,
        saveEditedAvailability,
    };
}
