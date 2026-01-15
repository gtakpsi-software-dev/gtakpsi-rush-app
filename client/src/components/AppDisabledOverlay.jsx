import React from "react";

/**
 * AppDisabledOverlay - Displays a blurred overlay when the rush app is disabled
 * 
 * @param {Object} props
 * @param {string} props.message - Custom message to display (optional)
 * @param {boolean} props.show - Whether to show the overlay
 */
export default function AppDisabledOverlay({ message, show }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Blurred backdrop */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl" />
            
            {/* Content */}
            <div className="relative z-10 text-center px-6 max-w-lg">
                {/* Lock Icon */}
                <div className="mb-8">
                    <div className="w-20 h-20 mx-auto bg-black rounded-full flex items-center justify-center shadow-lg">
                        <svg 
                            className="w-10 h-10 text-white" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={1.5} 
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-apple-large font-light text-black mb-4">
                    Rush App Disabled
                </h1>

                {/* Message */}
                <p className="text-apple-body text-apple-gray-600 font-light mb-8">
                    {message || "The rush app has been temporarily disabled by an administrator. Please check back later."}
                </p>

                {/* Admin Contact */}
                <div className="bg-apple-gray-100 rounded-apple-xl p-4 border border-apple-gray-200">
                    <p className="text-apple-caption1 text-apple-gray-500 font-light">
                        If you believe this is an error, please contact a rush admin.
                    </p>
                </div>

                {/* Sign Out Option */}
                <button
                    onClick={() => {
                        // Import auth and sign out
                        import('../firebase').then(({ auth }) => {
                            auth.signOut().then(() => {
                                window.location.href = '/';
                            });
                        });
                    }}
                    className="mt-6 text-apple-footnote text-apple-gray-500 hover:text-black transition-colors underline font-light"
                >
                    Sign out
                </button>
            </div>
        </div>
    );
}
