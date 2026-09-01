import React, { useState } from "react";

export default function SuccessPage({ title, description, link, gtid }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`${window.location.origin}/rushee/${gtid}/${link}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset the copied state after 2 seconds
        });
    };

    return (
        <div className="relative w-full h-screen bg-white flex flex-col items-center justify-center px-4">
            {/* Success Icon */}
            <div className="mb-8">
                <div className="flex items-center justify-center w-20 h-20 bg-black rounded-apple-2xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>

            {/* Header Section */}
            <div className="text-center mb-8">
                <h1 className="text-apple-large font-light text-black mb-4 max-w-2xl leading-tight">
                    {title}
                </h1>
                <div className="w-16 h-0.5 bg-black mx-auto mb-6"></div>
                <p className="text-apple-title2 text-apple-gray-600 font-light max-w-xl mx-auto leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Link Section */}
            <div className="card-apple p-6 max-w-2xl w-full">
                <div className="mb-4">
                    <label className="block text-apple-footnote text-apple-gray-700 font-normal mb-2">
                        Your personal link:
                    </label>
                    {/* Code-style link display */}
                    <div className="bg-apple-gray-100 rounded-apple p-4 border border-apple-gray-200">
                        <code className="text-apple-footnote text-apple-gray-800 font-mono break-all leading-relaxed">
                            {`${window.location.origin}/rushee/${gtid}/${link}`}
                        </code>
                    </div>
                </div>

                {/* Copy Button */}
                <button
                    onClick={handleCopy}
                    className={`btn-apple w-full transition-all duration-200 ${
                        copied ? 'bg-black text-white' : ''
                    }`}
                >
                    {copied ? (
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Link
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}