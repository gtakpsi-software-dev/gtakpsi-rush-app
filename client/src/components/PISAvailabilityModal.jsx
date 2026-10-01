import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    groupTimeslots,
    selectAllTimeslots,
    sortTimeslots
} from '../features/brotherPisAvailability/timeslots';
import PISAvailabilityView from '../features/brotherPisAvailability/PISAvailabilityView';

/**
 * PIS Availability Modal
 * Displays a blocking modal for brothers to select their available PIS timeslots.
 * Cannot be dismissed until the form is submitted.
 */
export default function PISAvailabilityModal({ 
    user, 
    onSubmit 
}) {
    const [timeslots, setTimeslots] = useState([]);
    const [selectedSlots, setSelectedSlots] = useState(new Set());
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

    const handleSubmit = async () => {
        // Allow submission with zero slots (brother is not available for any)

        // Extract first and last names, handling various possible formats
        let firstName = user.firstName || user.firstname || '';
        let lastName = user.lastName || user.lastname || '';
        
        // If names are empty but we have a displayName, try to parse it
        if ((!firstName || !lastName) && user.displayName) {
            const nameParts = user.displayName.trim().split(' ');
            if (!firstName) firstName = nameParts[0] || '';
            if (!lastName) lastName = nameParts.slice(1).join(' ') || '';
        }
        
        // Trim names to avoid whitespace issues
        firstName = firstName.trim();
        lastName = lastName.trim();
        
        if (!firstName || !lastName) {
            toast.error('Unable to determine your name. Please contact an admin.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await axios.post(`${api}/brother/pis-availability/submit`, {
                brother_uid: user.uid,
                brother_email: user.email,
                brother_first_name: firstName,
                brother_last_name: lastName,
                available_timeslots: Array.from(selectedSlots)
            });

            if (response.data.status === 'success') {
                toast.success('Availability submitted successfully!');
                onSubmit();
            } else {
                toast.error(response.data.message || 'Failed to submit');
            }
        } catch (error) {
            console.error('Failed to submit availability:', error);
            toast.error('Failed to submit availability');
        } finally {
            setSubmitting(false);
        }
    };

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
