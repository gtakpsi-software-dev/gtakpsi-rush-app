import type { ComponentProps } from "react";

import Loader from "../../components/Loader";
import SplashPage from "./SplashPage";
import DisplayInfo from "./DisplayInfo";
import SuccessPage from "./SuccessPage";

type AttendanceViewProps = {
    loading: boolean | undefined;
    page: number;
    gtid: string | undefined;
    setGtid: (gtid: string) => void;
    rushee: ComponentProps<typeof DisplayInfo>["rushee"];
    handleSubmit: () => void;
    goBack: () => void;
    checkIn: () => void;
};

// Render the loading, GTID entry, identity confirmation, or check-in success screen.
export default function AttendanceView({
    loading, page, gtid, setGtid, rushee, handleSubmit, goBack, checkIn,
}: AttendanceViewProps) {
    return (
        <div>
            {loading ? (
                <Loader />
            ) : (
                <div>
                    {page == 0 ? (
                        <SplashPage func={handleSubmit} gtid={gtid} setGtid={setGtid} />
                    ) : (
                        <div>
                            {page == 1 ? (
                                <DisplayInfo rushee={rushee} goBack={goBack} checkIn={checkIn} />
                            ) : (
                                <SuccessPage goBack={goBack} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
