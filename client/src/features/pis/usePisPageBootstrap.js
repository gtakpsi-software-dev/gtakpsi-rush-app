import { useEffect } from 'react';
import axios from 'axios';

import { verifyUser } from '../auth/verifyUser';
import { auth } from '../../firebase';
import { loadPisPageData } from './loadPisPageData';

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
        if (loading) {
            loadPisPageData({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                currentUser,
                auth,
                getStoredUser: () => localStorage.getItem('user'),
                setCurrentUser,
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
                logError: (error) => console.log(error),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Identity updates during loading must not restart the original request sequence.
    }, [loading, api, gtid, navigate]);
}
