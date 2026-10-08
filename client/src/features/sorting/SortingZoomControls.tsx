type SortingZoomControlsProps = {
    scale: number;
    onZoomOut: () => void;
    onZoomIn: () => void;
    onResetView: () => void;
};

// Render zoom-out, zoom-in, scale percentage, and reset controls.
export default function SortingZoomControls({
    scale,
    onZoomOut,
    onZoomIn,
    onResetView,
}: SortingZoomControlsProps) {
    return (
        <div className="fixed bottom-20 left-6 z-30 flex items-center gap-2 bg-white border border-apple-gray-200 rounded-2xl px-4 py-3 shadow-lg">
            <button
                onClick={onZoomOut}
                className="w-10 h-10 flex items-center justify-center text-apple-gray-700 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors text-2xl font-light"
                title="Zoom out"
            >
                −
            </button>
            <span className="text-sm text-apple-gray-600 w-14 text-center font-medium">
                {Math.round(scale * 100)}%
            </span>
            <button
                onClick={onZoomIn}
                className="w-10 h-10 flex items-center justify-center text-apple-gray-700 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors text-2xl font-light"
                title="Zoom in"
            >
                +
            </button>
            <div className="w-px h-8 bg-apple-gray-200 mx-2"></div>
            <button
                onClick={onResetView}
                className="px-3 h-10 flex items-center justify-center text-sm text-apple-gray-600 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors font-medium"
                title="Reset view"
            >
                Reset
            </button>
        </div>
    );
}
