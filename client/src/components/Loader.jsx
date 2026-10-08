
// Render the full-page loading spinner and label.
export default function Loader() {

    return (
        <div className="w-screen bg-white h-screen items-center flex justify-center">
            <div className="flex flex-col items-center animate-fade-in">
                {/* Modern Apple-style spinner */}
                <div className="relative">
                    <div className="w-8 h-8 border-2 border-apple-gray-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-6 text-apple-footnote text-apple-gray-600 font-light">
                    Loading...
                </p>
            </div>
        </div>
    )

}