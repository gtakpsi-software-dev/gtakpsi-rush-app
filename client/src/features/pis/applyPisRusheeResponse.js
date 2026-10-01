export function applyPisRusheeResponse(response, {
    setRushee, setAnswers, setBrotherA, setBrotherB, navigate, errorTitle,
    log = (...values) => console.log(...values),
}) {
    if (response.data.status === "success") {
        const rusheeData = response.data.payload;
        setRushee(rusheeData);

        const existingAnswers = {};
        rusheeData.pis?.forEach((pis) => {
            existingAnswers[pis.question] = pis.answer;
        });
        // Database answers replace matching live values during initial hydration.
        setAnswers((prev) => ({ ...prev, ...existingAnswers }));

        if (rusheeData.pis_signup) {
            const signup = rusheeData.pis_signup;

            // The API uses "none" and empty names to mean no assigned brother.
            const isValidName = (val) => val && val.trim() && val.trim().toLowerCase() !== "none";

            const brotherAFirst = isValidName(signup.first_brother_first_name) ? signup.first_brother_first_name.trim() : '';
            const brotherALast = isValidName(signup.first_brother_last_name) ? signup.first_brother_last_name.trim() : '';
            const brotherBFirst = isValidName(signup.second_brother_first_name) ? signup.second_brother_first_name.trim() : '';
            const brotherBLast = isValidName(signup.second_brother_last_name) ? signup.second_brother_last_name.trim() : '';

            log('Initializing brother names:', {
                brotherA: { firstName: brotherAFirst, lastName: brotherALast },
                brotherB: { firstName: brotherBFirst, lastName: brotherBLast },
                rawSignup: signup
            });

            setBrotherA({ firstName: brotherAFirst, lastName: brotherALast });
            setBrotherB({ firstName: brotherBFirst, lastName: brotherBLast });
        }
    } else {
        navigate(`/error/${errorTitle}/${"Rushee with this GTID does not exist"}`);
    }
}
