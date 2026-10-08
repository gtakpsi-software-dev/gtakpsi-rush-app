import type { ComponentProps } from "react";

import Loader from "../../components/Loader";
import BasicInfoForm from "./BasicInfoForm";
import PhotoCaptureStep from "./photo/PhotoCaptureStep";
import PisSignUpStep from "./pis/PisSignUpStep";

type RegistrationStageViewProps = {
    page: number;
    loading: boolean;
    basicInfoProps: ComponentProps<typeof BasicInfoForm>;
    photoProps: ComponentProps<typeof PhotoCaptureStep>;
    pisProps: ComponentProps<typeof PisSignUpStep>;
};

// Select the basic-information, photo, PIS, or loading view for the current stage.
export default function RegistrationStageView({
    page,
    loading,
    basicInfoProps,
    photoProps,
    pisProps,
}: RegistrationStageViewProps) {
    if (page == 0) {
        return <BasicInfoForm {...basicInfoProps} />;
    }

    // Keep each step's original wrapper depth so registration layout and DOM stay unchanged.
    if (page == 1) {
        return (
            <div>
                <PhotoCaptureStep {...photoProps} />
            </div>
        );
    }

    if (page == 2) {
        return (
            <div>
                <div>
                    <PisSignUpStep {...pisProps} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div>
                <div>{loading ? <Loader /> : null}</div>
            </div>
        </div>
    );
}
