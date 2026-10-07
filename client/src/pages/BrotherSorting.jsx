import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { auth } from "../firebase";
import axios from "axios";
import { createEmptyColumns } from "../features/sorting/board";
import ReadOnlyDetailsPanel from "../features/sorting/ReadOnlyDetailsPanel";
import ViewerSortingBoardView from "../features/sorting/ViewerSortingBoardView";
import { createBrotherSortingDetailsHandlers } from "../features/sorting/createBrotherSortingDetailsHandlers";
import { useSortingViewport } from "../features/sorting/useSortingViewport";
import { useSortingWheelListener } from "../features/sorting/useSortingWheelListener";
import { useSortingViewerConnection } from "../features/sorting/useSortingViewerConnection";
import { loadBrotherSortingData } from "../features/sorting/loadBrotherSortingData";
import { subscribeToSortingAuth } from "../features/sorting/subscribeToSortingAuth";

export default function BrotherSorting() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/brother";

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState(createEmptyColumns());
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [notes, setNotes] = useState("");
    const [notesLoading, setNotesLoading] = useState(false);
    const [notesTags, setNotesTags] = useState([]);

    const {
        scale, translate, zoomIn, zoomOut, resetView, handleWheel,
        onMouseDown, onContextMenu, onMouseMove, onMouseUp,
    } = useSortingViewport();

    // WebSocket for real-time collaboration
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    
    // Ghost card state (shows when admin is dragging)
    const [ghostCards, setGhostCards] = useState({});
    const ghostTimestampsRef = useRef({}); // Track when each ghost was created
    
    const fetchDataRef = useRef(null);

    const fetchData = useCallback(() => loadBrotherSortingData({
        auth,
        navigate,
        apiBase,
        getSorting: (path) => axios.get(path),
        setColumns,
        setLoading,
        showError: (message) => toast.error(message),
    }), [apiBase, navigate]);

    // Store fetchData in ref for WebSocket to use
    fetchDataRef.current = fetchData;

    useEffect(() => subscribeToSortingAuth({
        auth, authChecked: false, fetchData, navigate,
    }), [fetchData, navigate]);

    useSortingViewerConnection({
        auth, wsRef, ghostTimestampsRef, fetchDataRef,
        setWsConnected, setViewerCount, setGhostCards,
        showRusheeNames: true,
    });

    const { openDetails, closeDetails } = createBrotherSortingDetailsHandlers({
        apiBase,
        getNotes: (path) => axios.get(path),
        setSelectedRushee,
        setNotes,
        setNotesTags,
        setNotesLoading,
        logger: console,
    });

    const canvasRef = useRef(null);

    useSortingWheelListener(canvasRef, handleWheel, loading);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-apple-body text-apple-gray-600">Loading sorting board...</div>
            </div>
        );
    }

    return (
        <ViewerSortingBoardView
            canvasRef={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onContextMenu={onContextMenu}
            connected={wsConnected}
            viewerCount={viewerCount}
            ghostCards={ghostCards}
            scale={scale}
            onZoomOut={zoomOut}
            onZoomIn={zoomIn}
            onResetView={resetView}
            translate={translate}
            columns={columns}
            showRusheeNames={true}
            onOpen={openDetails}
        >
            {selectedRushee && (
                <ReadOnlyDetailsPanel
                    selectedRushee={selectedRushee}
                    notesLoading={notesLoading}
                    notesTags={notesTags}
                    notes={notes}
                    onClose={closeDetails}
                    onViewRushee={() => navigate(`/brother/rushee/${selectedRushee.id}`)}
                />
            )}
        </ViewerSortingBoardView>
    );
}
