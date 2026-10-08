import { useState } from "react";
import { createPromotionActions } from "./promotionActions";

// Manage the selected brother’s role flags and connect role-update actions.
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
