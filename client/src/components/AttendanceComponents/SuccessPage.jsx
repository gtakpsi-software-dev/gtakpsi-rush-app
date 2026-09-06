import React from "react";

export default function SuccessPage(props) {

    return (
        <div className="min-h-screen w-full bg-white flex items-center justify-center p-4">
            <div className="text-center max-w-lg w-full">
                {/* Success Icon */}
                <div className="flex items-center justify-center w-28 h-28 bg-black rounded-apple-2xl mx-auto mb-8">
                    <svg
                        className="w-16 h-16 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="text-apple-large font-light text-black mb-3">You're Checked In!</h1>
                <div className="w-16 h-0.5 bg-black mx-auto mb-6"></div>

                {/* Description */}
                <p className="text-apple-title2 text-apple-gray-600 font-light leading-relaxed">
                    Make sure to grab a name tag and proceed inside the room.
                </p>

                {props.goBack && (
                    <button
                        onClick={props.goBack}
                        className="btn-apple px-8 py-4 text-apple-headline font-light mt-10"
                    >
                        Back
                    </button>
                )}
            </div>
        </div>
    )

}