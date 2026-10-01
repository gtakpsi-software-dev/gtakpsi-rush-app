import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    groupTimeslots,
    selectAllTimeslots,
    sortTimeslots
} from '../features/brotherPisAvailability/timeslots';
import { submitAvailability } from '../features/brotherPisAvailability/submitAvailability';
import PISAvailabilityView from '../features/brotherPisAvailability/PISAvailabilityView';

type BrotherUser = {
    uid?: string;
    email?: string;
    firstName?: string;
    firstname?: string;
    lastName?: string;
    lastname?: string;
    displayName?: string;
};

type PISAvailabilityModalProps = {
    user: BrotherUser;
    onSubmit: () => void;
};

/**
 * PIS Availability Modal
 * Displays a blocking modal for brothers to select their available PIS timeslots.
 * Cannot be dismissed until the form is submitted.
 */
export default function PISAvailabilityModal({ user, onSubmit }: PISAvailabilityModalProps) {
    const [timeslots, setTimeslots] = useState([]);
    const [selectedSlots, setSelectedSlots] = useState(new Set<string>());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        fetchTimeslots();
    }, []);

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

    const toggleSlot = (slotTime) => {
        const newSelected = new Set(selectedSlots);
        if (newSelected.has(slotTime)) {
            newSelected.delete(slotTime);
        } else {
            newSelected.add(slotTime);
        }
        setSelectedSlots(newSelected);
    };

    const selectAll = () => {
        setSelectedSlots(selectAllTimeslots(timeslots));
    };

    const clearAll = () => {
        setSelectedSlots(new Set());
    };

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
        <PISAvailabilityView
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
