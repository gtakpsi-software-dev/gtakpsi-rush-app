import { useState } from "react";
import { createPromotionActions } from "./promotionActions";

/**
 * Promotion Summary:
 * - Keeps the selected brother and role status with their promotion actions.
 * - Retains the same initial values and role-request closures.
 * - Existing action and admin markup tests pin selection and display behavior.
 */
export default function useAdminPromotion({
    apiBase,
    setBrotherSearch,
    setFilteredBrothers,
    axios,
    toast,
}) {
    const [selectedBrother, setSelectedBrother] = useState(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const [brotherAdminStatus, setBrotherAdminStatus] = useState(null);
    const [brotherBidcomStatus, setBrotherBidcomStatus] = useState(null);

    const actions = createPromotionActions({
        apiBase,
        selectedBrother,
        setSelectedBrother,
        setBrotherSearch,
        setFilteredBrothers,
        setBrotherAdminStatus,
        setBrotherBidcomStatus,
        setIsPromoting,
        axios,
        toast,
    });

    return {
        selectedBrother,
        setSelectedBrother,
        isPromoting,
        brotherAdminStatus,
        brotherBidcomStatus,
        ...actions,
    };
}
