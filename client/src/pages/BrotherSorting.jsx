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

// Manage the brother’s read-only sorting board and detail panel.
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

    const fetchData = useCallback(/* Verify sign-in and load the current brother sorting board. */ () => loadBrotherSortingData({
        auth,
        navigate,
        apiBase,
        // Fetch sorting rows through Axios.
        getSorting: (path) => axios.get(path),
        setColumns,
        setLoading,
        // Show a sorting-board loading error.
        showError: (message) => toast.error(message),
    }), [apiBase, navigate]);

    // Store fetchData in ref for WebSocket to use
    fetchDataRef.current = fetchData;

    useEffect(/* Reload or redirect when the authentication state changes. */ () => subscribeToSortingAuth({
        auth, authChecked: false, fetchData, navigate,
    }), [fetchData, navigate]);

    useSortingViewerConnection({
        auth, wsRef, ghostTimestampsRef, fetchDataRef,
        setWsConnected, setViewerCount, setGhostCards,
        showRusheeNames: true,
    });

    const { openDetails, closeDetails } = createBrotherSortingDetailsHandlers({
        apiBase,
        // Fetch the selected rushee’s sorting notes through Axios.
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
                    onViewRushee={/* Open the selected rushee’s full profile. */ () => navigate(`/brother/rushee/${selectedRushee.id}`)}
                />
            )}
        </ViewerSortingBoardView>
    );
}
