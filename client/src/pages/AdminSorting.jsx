import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { auth } from "../firebase";
import { adminGet, adminPut } from "../features/admin/api";
import { createEmptyColumns } from "../features/sorting/board";
import AdminSortingBoardView from "../features/sorting/AdminSortingBoardView";
import { useSortingAdminConnection } from "../features/sorting/useSortingAdminConnection";
import { createAdminSortingMoveActions } from "../features/sorting/createAdminSortingMoveActions";
import { createSortingDragHandlers } from "../features/sorting/createSortingDragHandlers";
import { useSortingViewport } from "../features/sorting/useSortingViewport";
import { useSortingWheelListener } from "../features/sorting/useSortingWheelListener";
import { createSortingNotesHandlers } from "../features/sorting/createSortingNotesHandlers";
import { loadAdminSortingData } from "../features/sorting/loadAdminSortingData";
import { subscribeToSortingAuth } from "../features/sorting/subscribeToSortingAuth";
import { parseAdminAllowlist } from "../features/auth/parseAdminAllowlist";

const ALLOWLIST = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

// Manage the editable admin sorting board, persistence queue, collaboration, and notes.
export default function AdminSorting() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const [columns, setColumns] = useState(createEmptyColumns());
    const [dragging, setDragging] = useState(null); // {id, fromColumn, index}
    const [hoverIndex, setHoverIndex] = useState({ column: null, index: null });
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [notes, setNotes] = useState("");
    const [tags, setTags] = useState([]); // Array of tag keys
    const [notesStatus, setNotesStatus] = useState("idle"); // idle | loading | saving | saved | error
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
    const [ghostCards, setGhostCards] = useState({});
    const [lockedCards, setLockedCards] = useState({});
    const ghostTimestampsRef = useRef({}); // Track when each ghost was created
    const dragPositionRef = useRef({ x: 0, y: 0 });
    const throttleRef = useRef(null);
    const moveInFlightRef = useRef(false);
    const pendingMovesRef = useRef([]);
    const fetchDataRef = useRef(null);
    const draggingRef = useRef(null);

    useSortingAdminConnection({
        auth, wsRef, draggingRef, ghostTimestampsRef, fetchDataRef,
        setWsConnected, setViewerCount, setGhostCards, setLockedCards,
        // Resolve the drag-cancellation handler after the page has created it.
        getCancelDragState: () => cancelDragState,
    });

    // Send WebSocket message helper
    const wsSend = useCallback((msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const fetchData = useCallback(/* Verify admin access and load the current sorting board. */ () => loadAdminSortingData({
        auth,
        navigate,
        allowlist: ALLOWLIST,
        apiBase,
        getSorting: adminGet,
        setColumns,
        setLoading,
        setAuthChecked,
        // Show a sorting-board loading error.
        showError: (message) => toast.error(message),
    }), [apiBase, navigate]);

    // Store latest fetchData for WebSocket refresh
    fetchDataRef.current = fetchData;

    useEffect(() => {
        // Keep the drag ref synchronized with the current React state.
        draggingRef.current = dragging;
    }, [dragging]);

    useEffect(/* Subscribe to authentication until the initial board access check completes. */ () => subscribeToSortingAuth({
        auth, authChecked, fetchData, navigate,
    }), [fetchData, authChecked, navigate]);

    const {
        handleDragStart,
        handleDragOver,
        clearDragState,
        cancelDragState,
        handleDragEnd,
    } = createSortingDragHandlers({
        lockedCards,
        draggingRef,
        dragPositionRef,
        throttleRef,
        setDragging,
        setHoverIndex,
        wsSend,
    });

    const { handleDrop } = createAdminSortingMoveActions({
        dragging,
        setColumns,
        clearDragState,
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        // Persist one queued sorting move through the authenticated admin API.
        persistMove: (next) => adminPut(`${apiBase}/rushees/move`, next),
        wsSend,
        // Show a sorting-move persistence error.
        showError: (message) => toast.error(message),
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

    return <AdminSortingBoardView {...{
        canvasRef, onMouseDown, onMouseMove, onMouseUp, onContextMenu,
        wsConnected, viewerCount, ghostCards, scale, zoomOut, zoomIn,
        resetView, translate, dragging, columns, hoverIndex, draggingRef,
        lockedCards, setHoverIndex, handleDragOver, handleDrop,
        handleDragStart, handleDragEnd, openNotes, selectedRushee,
        notesStatus, tags, notes, closeNotes, toggleTag, onNotesChange,
        // Open the selected rushee’s full profile.
        onViewRushee: () => navigate(`/brother/rushee/${selectedRushee.id}`),
    }} />;
}
