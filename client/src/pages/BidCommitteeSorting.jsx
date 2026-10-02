import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { auth } from "../firebase";
import { adminGet, adminPut } from "../features/admin/api";
import { createEmptyColumns } from "../features/sorting/board";
import EditableNotesPanel from "../features/sorting/EditableNotesPanel";
import ViewerSortingBoardView from "../features/sorting/ViewerSortingBoardView";
import { useSortingViewport } from "../features/sorting/useSortingViewport";
import { useSortingWheelListener } from "../features/sorting/useSortingWheelListener";
import { createSortingNotesHandlers } from "../features/sorting/createSortingNotesHandlers";
import { useSortingViewerConnection } from "../features/sorting/useSortingViewerConnection";
import { loadBidCommitteeSortingData } from "../features/sorting/loadBidCommitteeSortingData";
import { subscribeToSortingAuth } from "../features/sorting/subscribeToSortingAuth";
import { parseAdminAllowlist } from "../features/auth/parseAdminAllowlist";

const ALLOWLIST = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

export default function BidCommitteeSorting() {
    // Uses bidcom endpoints which allow both admin and bidcom users
    const apiBase = import.meta.env.VITE_API_PREFIX + "/bidcom";

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const [columns, setColumns] = useState(createEmptyColumns());
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [notes, setNotes] = useState("");
    const [tags, setTags] = useState([]);
    const [notesStatus, setNotesStatus] = useState("idle");
    const notesTimer = useRef(null);
    const tagsTimer = useRef(null);

    const {
        scale, translate, zoomIn, zoomOut, resetView, handleWheel,
        onMouseDown, onContextMenu, onMouseMove, onMouseUp,
    } = useSortingViewport();

    // WebSocket for real-time collaboration
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    
    // Ghost card state (shows when admin is dragging)
    const [ghostCards, setGhostCards] = useState({}); // { [rusheeId]: { rusheeId, rusheeName, x, y, draggerName } }
    const ghostTimestampsRef = useRef({}); // Track when each ghost was created
    
    const fetchDataRef = useRef(null);

    const fetchData = useCallback(() => loadBidCommitteeSortingData({
        auth,
        navigate,
        allowlist: ALLOWLIST,
        apiBase,
        getSorting: adminGet,
        setColumns,
        setLoading,
        setAuthChecked,
        showError: (message) => toast.error(message),
    }), [apiBase, navigate]);

    // Store fetchData in ref for WebSocket to use
    fetchDataRef.current = fetchData;

    useEffect(() => subscribeToSortingAuth({
        auth, authChecked, fetchData, navigate,
    }), [fetchData, authChecked, navigate]);

    useSortingViewerConnection({
        auth, wsRef, ghostTimestampsRef, fetchDataRef,
        setWsConnected, setViewerCount, setGhostCards,
        showRusheeNames: false,
    });

    const {
        openNotes,
        closeNotes,
        onNotesChange,
        toggleTag,
    } = createSortingNotesHandlers({
        apiBase,
        selectedRushee,
        notes,
        tags,
        notesTimer,
        tagsTimer,
        getNotes: adminGet,
        putNotes: adminPut,
        setSelectedRushee,
        setNotes,
        setTags,
        setNotesStatus,
        setColumns,
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
            showRusheeNames={false}
            onOpen={openNotes}
        >
            {selectedRushee && (
                <EditableNotesPanel
                    selectedRushee={selectedRushee}
                    audience="bidcom"
                    notesStatus={notesStatus}
                    tags={tags}
                    notes={notes}
                    onClose={closeNotes}
                    onToggleTag={toggleTag}
                    onNotesChange={onNotesChange}
                    onViewRushee={() => navigate(`/brother/rushee/${selectedRushee.id}?bid_committee=true&rushee_num=${selectedRushee.rushNumber}`)}
                />
            )}
        </ViewerSortingBoardView>
    );
}
