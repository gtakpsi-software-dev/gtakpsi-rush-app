// Validate the brother’s name and submit selected timeslots, including an empty selection.
export async function submitAvailability({
    user,
    selectedSlots,
    api,
    axios,
    toast,
    onSubmit,
    setSubmitting,
    logError
}) {
    let firstName = user.firstName || user.firstname || '';
    let lastName = user.lastName || user.lastname || '';

    if ((!firstName || !lastName) && user.displayName) {
        const nameParts = user.displayName.trim().split(' ');
        if (!firstName) firstName = nameParts[0] || '';
        if (!lastName) lastName = nameParts.slice(1).join(' ') || '';
    }

    firstName = firstName.trim();
    lastName = lastName.trim();

    // Zero selected slots means unavailable; missing identity is the submission gate.
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
        logError('Failed to submit availability:', error);
        toast.error('Failed to submit availability');
    } finally {
        setSubmitting(false);
    }
}
