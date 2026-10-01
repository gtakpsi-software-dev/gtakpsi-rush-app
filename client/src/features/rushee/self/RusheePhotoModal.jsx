import Webcam from "react-webcam";

export default function RusheePhotoModal({
    showPreview, image, webcamRef, onClose, onRetake, onSave, onCapture,
}) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card-apple p-6 max-w-lg w-full mx-4 relative">
                <div className="mb-6">
                    <h2 className="text-apple-title1 font-light text-black text-center">Update Photo</h2>
                    <div className="w-12 h-0.5 bg-black mx-auto mt-2"></div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-apple-gray-500 hover:text-black transition-colors duration-200 rounded-apple"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="w-80 h-80 bg-apple-gray-50 rounded-apple-2xl overflow-hidden border border-apple-gray-200 flex items-center justify-center mb-6">
                    {showPreview ? (
                        <img
                            src={image}
                            alt="Captured preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    {showPreview ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={onRetake}
                                className="btn-apple-secondary px-6 py-3 text-apple-body font-light flex-1"
                            >
                                Retake Photo
                            </button>
                            <button
                                onClick={onSave}
                                className="btn-apple px-6 py-3 text-apple-body font-light flex-1"
                            >
                                Save Photo
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onCapture}
                            className="btn-apple px-8 py-4 text-apple-headline font-light"
                        >
                            Take Photo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
