import type { ChangeEvent, FormEvent, Ref } from "react";
import type Webcam from "react-webcam";

import Loader from "../../../components/Loader";
import Navbar from "../../../components/Navbar";
import RusheePhotoModal from "./RusheePhotoModal";
import RusheeProfileForm from "./RusheeProfileForm";
import RusheeProfileSummary from "./RusheeProfileSummary";

type Rushee = {
    first_name: string;
    last_name: string;
    housing: string;
    phone_number: string;
    email: string;
    gtid: string;
    major: string;
    class: string;
    pronouns: string;
    image_url: string;
    attendance: { name: string }[];
};

type Props = {
    loading: boolean;
    rushee: Rushee | null;
    initialRushee: Rushee | null;
    formattedPisTime: string | null;
    isModalOpen: boolean;
    showPreview: boolean;
    image: string | null;
    webcamRef: Ref<Webcam>;
    onPhotoClose: () => void;
    onPhotoRetake: () => void;
    onPhotoSave: () => void;
    onPhotoCapture: () => void;
    onEditImage: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

// Render the self-service profile, PIS time, edit form, and optional photo modal.
export default function RusheeSelfPageView({
    loading, rushee, initialRushee, formattedPisTime,
    isModalOpen, showPreview, image, webcamRef,
    onPhotoClose, onPhotoRetake, onPhotoSave, onPhotoCapture,
    onEditImage, onSubmit, onChange,
}: Props) {
    return (
        <div>
            <Navbar stripped={true} />

            {loading ? (
                <Loader />
            ) : (
                <div className="min-h-screen bg-white py-10">
                    {isModalOpen && (
                        <RusheePhotoModal
                            showPreview={showPreview}
                            image={image}
                            webcamRef={webcamRef}
                            onClose={onPhotoClose}
                            onRetake={onPhotoRetake}
                            onSave={onPhotoSave}
                            onCapture={onPhotoCapture}
                        />
                    )}
                    <div className="h-16" />
                    <RusheeProfileSummary
                        initialRushee={initialRushee!}
                        onEditImage={onEditImage}
                    />

                    <div className="mt-8 max-w-4xl mx-auto card-apple">
                        <div className="p-6">
                            <h2 className="text-apple-title1 font-light text-black mb-4">PIS Details</h2>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-apple-gray-100 rounded-apple flex items-center justify-center">
                                    <svg className="w-5 h-5 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-apple-footnote text-apple-gray-500 font-light">Scheduled for</p>
                                    <p className="text-apple-body text-black font-normal">
                                        {formattedPisTime}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <RusheeProfileForm
                        rushee={rushee!}
                        onSubmit={onSubmit}
                        onChange={onChange}
                    />
                </div>
            )}
        </div>
    );
}
