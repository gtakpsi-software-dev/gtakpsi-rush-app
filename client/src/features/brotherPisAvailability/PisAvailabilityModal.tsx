import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    groupTimeslots,
    selectAllTimeslots,
    sortTimeslots
} from './timeslots';
import { submitAvailability } from './submitAvailability';
import PisAvailabilityView from './PisAvailabilityView';

type BrotherUser = {
    uid?: string;
    email?: string;
    firstName?: string;
    firstname?: string;
    lastName?: string;
    lastname?: string;
    displayName?: string;
};

type PisAvailabilityModalProps = {
    user: BrotherUser;
    onSubmit: () => void;
};

/**
 * PIS Availability Modal
 * Displays a blocking modal for brothers to select their available PIS timeslots.
 * Cannot be dismissed until the form is submitted.
 */
export default function PisAvailabilityModal({ user, onSubmit }: PisAvailabilityModalProps) {
    const [timeslots, setTimeslots] = useState([]);
    const [selectedSlots, setSelectedSlots] = useState(new Set<string>());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        // Load available PIS timeslots when the API URL changes.
        // Fetch and sort timeslots, reporting failures and finishing the loading state.
        const fetchTimeslots = async () => {
            try {
                const response = await axios.get(`${api}/admin/get_pis_timeslots`);
                if (response.data.status === 'success') {
                    setTimeslots(sortTimeslots(response.data.payload));
                }
            } catch (error) {
                console.error('Failed to fetch timeslots:', error);
                toast.error('Failed to load timeslots');
            } finally {
                setLoading(false);
            }
        };

        fetchTimeslots();
    }, [api]);

    // Toggle one timeslot in a new copy of the selected set.
    const toggleSlot = (slotTime) => {
        const newSelected = new Set(selectedSlots);
        if (newSelected.has(slotTime)) {
            newSelected.delete(slotTime);
        } else {
            newSelected.add(slotTime);
        }
        setSelectedSlots(newSelected);
    };

    // Select every available timeslot.
    const selectAll = () => {
        setSelectedSlots(selectAllTimeslots(timeslots));
    };

    // Clear all selected timeslots.
    const clearAll = () => {
        setSelectedSlots(new Set());
    };

    // Submit the current user’s selected availability and update submission state.
    const handleSubmit = () => submitAvailability({
        user,
        selectedSlots,
        api,
        axios,
        toast,
        onSubmit,
        setSubmitting,
        logError: console.error
    });

    const groupedSlots = groupTimeslots(timeslots);

    return (
        <PisAvailabilityView
            loading={loading}
            timeslots={timeslots}
            selectedSlots={selectedSlots}
            submitting={submitting}
            groupedSlots={groupedSlots}
            selectAll={selectAll}
            clearAll={clearAll}
            toggleSlot={toggleSlot}
            handleSubmit={handleSubmit}
        />
    );
}
