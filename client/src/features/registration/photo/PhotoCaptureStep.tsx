import { useState } from "react";
import type { RefObject } from "react";
import Webcam from "react-webcam";

type PhotoCaptureStepProps = {
    webcamRef: RefObject<Webcam>;
    image?: string;
    setImage: (image: string) => void;
    onContinue: () => void;
};

export default function PhotoCaptureStep(props: PhotoCaptureStepProps) {

    const [showPreview, setShowPreview] = useState(false)

    const videoConstraints = {
        width: 1280,
        height: 1280,
        facingMode: "user",
        aspectRatio: 1,
    };

    const capture = () => {
        const webcam = props.webcamRef.current!;
        const video = webcam.video!;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = 1280;
        canvas.height = 1280;
        
        // The preview mirrors the camera, so flip the saved frame to match it.
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const mirroredScreenshot = canvas.toDataURL('image/jpeg', 0.95);
        
        setShowPreview(true);
        props.setImage(mirroredScreenshot);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white pt-16">
            <div className="text-center mb-8 animate-slide-up">
                <h1 className="mb-3 text-apple-large font-light text-black">
                    Capture Your Photo
                </h1>
                <div className="w-16 h-0.5 bg-black mx-auto mb-4"></div>
                <p className="text-apple-subheadline text-apple-gray-600 font-light max-w-md">
                    Take a clear photo so we can recognize you during rush events
                </p>
            </div>

            <div className="card-apple mb-8 animate-slide-up" style={{animationDelay: '0.1s'}}>
                <div className="p-8">
                    <div className="w-80 h-80 md:w-96 md:h-96 bg-apple-gray-50 rounded-apple-2xl overflow-hidden border border-apple-gray-200 flex items-center justify-center">
                        {showPreview ? (
                            <img
                                src={props.image}
                                alt="Captured photo preview"
                                className="w-full h-full object-cover rounded-apple-2xl"
                            />
                        ) : (
                            <Webcam
                                ref={props.webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                screenshotQuality={0.95}
                                videoConstraints={videoConstraints}
                                mirrored={true}
                                className="w-full h-full object-cover rounded-apple-2xl"
                            />
                        )}
                    </div>

                    <div className="flex flex-col items-center mt-6 space-y-4">
                        {showPreview ? (
                            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="btn-apple-secondary px-6 py-3 text-apple-body font-light"
                                >
                                    Retake Photo
                                </button>
                                <button
                                    onClick={props.onContinue}
                                    className="btn-apple px-6 py-3 text-apple-body font-light"
                                >
                                    Continue
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={capture}
                                className="btn-apple px-8 py-4 text-apple-headline font-light"
                            >
                                Take Photo
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
