export async function loadDashboardData({
    verifyUser,
    navigate,
    auth,
    db,
    doc,
    getDoc,
    axios,
    api,
    shuffleArray,
    setLoading,
    setBrotherData,
    setShowAvailabilityModal,
    setRushees,
    setFilteredRushees,
    setErrorDescription,
    setError,
}) {
    setLoading(true);
    await verifyUser()
        .then(async (response) => {
            if (response === false) {
                navigate("/");
            }

            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    const brotherDoc = await getDoc(doc(db, "brothers", currentUser.uid));
                    if (brotherDoc.exists()) {
                        setBrotherData({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            ...brotherDoc.data()
                        });
                    } else {
                        setBrotherData({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            firstName: '',
                            lastName: ''
                        });
                    }

                    const checkResponse = await axios.post(`${api}/brother/pis-availability/check`, {
                        brother_uid: currentUser.uid
                    });

                    if (checkResponse.data.status === "success" && checkResponse.data.needs_form) {
                        setShowAvailabilityModal(true);
                    }
                } catch (err) {
                    console.log("Error checking PIS availability:", err);
                }
            }

            await axios
                .get(`${api}/rushee/get-rushees`)
                .then((response) => {
                    if (response.data.status === "success") {
                        console.log(response.data.payload.length)

                        const shuffledRushees = shuffleArray(response.data.payload);
                        setRushees(shuffledRushees);
                        setFilteredRushees(shuffledRushees);
                    } else {
                        setErrorDescription("There was some issue fetching the rushees");
                        setError(true);
                    }
                })
                .catch(() => {
                    setErrorDescription("There was some network error while fetching the rushees.");
                    setError(true);
                });
        })
        .catch(() => {
            setErrorDescription("There was an error verifying your credentials.");
            setError(true);
        });

    setLoading(false);
}
