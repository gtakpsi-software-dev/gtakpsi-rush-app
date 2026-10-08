import axios from "axios";
import { useState, useEffect } from "react";

import PisSignUpView, { type PisSignUpViewProps } from "./PisSignUpView";
import type { PisSlot } from "./PisDayCard";

type PisSignUpStepProps =
    Pick<PisSignUpViewProps, "selectedSlot" | "flexWindow" | "setFlexWindow" | "onContinue"> & {
        setSelectedSlot: (slot: PisSlot) => void;
    };

// Load and group PIS timeslots and connect selection state to the signup view.
export default function PisSignUpStep(props: PisSignUpStepProps) {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    const [days, setDays] = useState(new Map<string, PisSlot[]>());
    const [showMonday, setShowMonday] = useState(false);

    useEffect(() => {
        // Fetch timeslots while the stage is loading.
        // Request available timeslots and finish the loading state.
        async function fetch() {
            const api = import.meta.env.VITE_API_PREFIX;

            await axios.get(`${api}/admin/get_pis_timeslots`).then((response) => {
                // Group successful results by local date or flag an unsuccessful response.
                if (response.data.status && response.data.status == "success") {
                    const tempDays = new Map<string, PisSlot[]>();

                    for (const slot in response.data.payload) {
                        const jsDate = new Date(
                            parseInt(response.data.payload[slot].time.$date.$numberLong)
                        );

                        const day = jsDate.toDateString();

                        if (tempDays.has(day)) {
                            tempDays.get(day)!.push({
                                time: jsDate,
                                num_available: response.data.payload[slot].num_available,
                            });
                        } else {
                            tempDays.set(day, [
                                {
                                    time: jsDate,
                                    num_available: response.data.payload[slot].num_available,
                                },
                            ]);
                        }

                        setDays(tempDays);
                    }
                } else {
                    setError(true);
                }
            });

            setLoading(false);
        }

        if (loading === true) {
            fetch();
        }
    });

    // Store the selected PIS timeslot in the registration form.
    const handleSlotClick = (slot: PisSlot) => {
        props.setSelectedSlot(slot);
    };

    return (
        <PisSignUpView
            error={error}
            loading={loading}
            days={days}
            showMonday={showMonday}
            setShowMonday={setShowMonday}
            selectedSlot={props.selectedSlot}
            flexWindow={props.flexWindow}
            setFlexWindow={props.setFlexWindow}
            handleSlotClick={handleSlotClick}
            onContinue={props.onContinue}
        />
    );
}
