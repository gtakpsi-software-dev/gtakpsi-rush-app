import { useEffect } from 'react';
import axios from 'axios';

import { verifyUser } from '../auth/verifyUser';
import { auth } from '../../firebase';
import { loadPisPageData } from './loadPisPageData';

// Load interview data while the page is in its initial loading state.
export function usePisPageBootstrap({
    loading,
    navigate,
    currentUser,
    api,
    gtid,
    setCurrentUser,
    setRushee,
    setAnswers,
    setBrotherA,
    setBrotherB,
    setQuestions,
    setQuestionsAvailable,
    setRevealAt,
    setLoading,
}) {
    const errorTitle = 'Default Error Title';
    const errorDescription = 'Default Error Description';

    useEffect(() => {
        // Start the session verification and interview-loading sequence.
        if (loading) {
            loadPisPageData({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                currentUser,
                auth,
                // Read the stored brother identity.
                getStoredUser: () => localStorage.getItem('user'),
                setCurrentUser,
                // Forward an interview data request through Axios.
                get: (...args) => axios.get(...args),
                api,
                gtid,
                setRushee,
                setAnswers,
                setBrotherA,
                setBrotherB,
                setQuestions,
                setQuestionsAvailable,
                setRevealAt,
                setLoading,
                // Log an interview bootstrap error.
                logError: (error) => console.log(error),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Identity updates during loading must not restart the original request sequence.
    }, [loading, api, gtid, navigate]);
}
