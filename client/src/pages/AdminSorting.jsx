import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import { realtimeBaseUrls } from "../config/realtimeBaseUrls";
import { adminGet, adminPut } from "../js/adminAxios";
import { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns } from "../features/sorting/board";
import EditableNotesPanel from "../features/sorting/EditableNotesPanel";
import SortingZoomControls from "../features/sorting/SortingZoomControls";
import SortingPresenceIndicator from "../features/sorting/SortingPresenceIndicator";
import SortingGhostCards from "../features/sorting/SortingGhostCards";
import SortingColumn from "../features/sorting/SortingColumn";
import { handleAdminSortingMessage } from "../features/sorting/handleAdminSortingMessage";
import { cleanupStaleSortingGhosts } from "../features/sorting/cleanupStaleSortingGhosts";
import { applySortingDrop } from "../features/sorting/applySortingDrop";
import { processSortingMoveQueue } from "../features/sorting/processSortingMoveQueue";
import { createSortingDragHandlers } from "../features/sorting/createSortingDragHandlers";
import { createSortingViewportHandlers } from "../features/sorting/createSortingViewportHandlers";
import { createSortingNotesHandlers } from "../features/sorting/createSortingNotesHandlers";
import { loadAdminSortingData } from "../features/sorting/loadAdminSortingData";

// Parse allowlist once at module level
const ALLOWLIST = (import.meta.env.VITE_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

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

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panState = useRef({ panning: false, startX: 0, startY: 0, origX: 0, origY: 0 });

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

    // Connect to sorting broadcaster WebSocket
    useEffect(() => {
        const connectWs = () => {
            const ws = new WebSocket(`${realtimeBaseUrls.sorting}/ws`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("Connected to sorting broadcaster");
                setWsConnected(true);
                // Join as admin
                const user = auth.currentUser;
                const name = user?.displayName || user?.email?.split("@")[0] || "Admin";
                ws.send(JSON.stringify({ type: "join", is_admin: true, name }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleAdminSortingMessage(msg, {
                        draggingRef, ghostTimestampsRef, fetchDataRef,
                        setViewerCount, setGhostCards, setLockedCards, cancelDragState,
                    });
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            ws.onclose = () => {
                console.log("Disconnected from sorting broadcaster");
                setWsConnected(false);
                setGhostCards({});
                setLockedCards({});
                // Reconnect after 3 seconds
                setTimeout(connectWs, 3000);
            };

            ws.onerror = (err) => {
                console.error("WebSocket error", err);
                ws.close();
            };
        };

        connectWs();

        const staleCleanupInterval = setInterval(() => {
            cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards, setLockedCards });
        }, 5000);

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    }, []);

    // Send WebSocket message helper
    const wsSend = useCallback((msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const fetchData = useCallback(() => loadAdminSortingData({
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

    // Store latest fetchData for WebSocket refresh
    fetchDataRef.current = fetchData;

    useEffect(() => {
        draggingRef.current = dragging;
    }, [dragging]);

    useEffect(() => {
        // Only run once
        if (authChecked) return;
        
        // Wait for auth to be ready
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchData();
            } else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [fetchData, authChecked, navigate]);

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

    const processMoveQueue = () => processSortingMoveQueue({
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        persistMove: (next) => adminPut(`${apiBase}/rushees/move`, next),
        wsSend,
        showError: (message) => toast.error(message),
    });

    const enqueueMove = (payload) => {
        pendingMovesRef.current.push(payload);
        processMoveQueue();
    };

    const handleDrop = (targetColumn, targetIndex) => {
        if (!dragging) return;
        const { id, fromColumn } = dragging;
        setColumns((prev) => applySortingDrop(prev, {
            id, fromColumn, targetColumn, targetIndex, enqueueMove,
        }));
        clearDragState();
    };

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

    const {
        zoomIn,
        zoomOut,
        resetView,
        handleWheel,
        onMouseDown,
        onContextMenu,
        onMouseMove,
        onMouseUp,
    } = createSortingViewportHandlers({
        scaleLimits: { min: MIN_SCALE, max: MAX_SCALE },
        panState,
        translate,
        setScale,
        setTranslate,
    });

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, [loading]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-apple-body text-apple-gray-600">Loading sorting board...</div>
            </div>
        );
    }

    return (
        <div
            ref={canvasRef}
            className="w-screen h-screen overflow-hidden bg-apple-gray-50"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onContextMenu={onContextMenu}
        >
            <Navbar />
            
            {/* Viewer Count & Live Indicator */}
            <SortingPresenceIndicator
                connected={wsConnected}
                viewerCount={viewerCount}
                ghostCards={ghostCards}
                hideWhenAlone={true}
            />

            {/* Ghost Cards - Shows when other admins are dragging */}
            <SortingGhostCards ghostCards={ghostCards} wide={true} />

            {/* Fixed Zoom Controls - Bottom Left */}
            <SortingZoomControls
                scale={scale}
                onZoomOut={zoomOut}
                onZoomIn={zoomIn}
                onResetView={resetView}
            />

            <div className="relative w-full h-[calc(100vh-80px)] mt-16 overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                        transformOrigin: "0 0",
                        transition: dragging ? "none" : "transform 0.05s ease-out",
                    }}
                >
                    <div className="flex gap-4 p-6">
                        {STATUSES.map((col) => (
                            <SortingColumn
                                key={col.key}
                                col={col}
                                columns={columns}
                                hoverIndex={hoverIndex}
                                dragging={dragging}
                                draggingRef={draggingRef}
                                lockedCards={lockedCards}
                                setHoverIndex={setHoverIndex}
                                handleDragOver={handleDragOver}
                                handleDrop={handleDrop}
                                handleDragStart={handleDragStart}
                                handleDragEnd={handleDragEnd}
                                openNotes={openNotes}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Notes Side Panel */}
            {selectedRushee && (
                <EditableNotesPanel
                    selectedRushee={selectedRushee}
                    audience="admin"
                    notesStatus={notesStatus}
                    tags={tags}
                    notes={notes}
                    onClose={closeNotes}
                    onToggleTag={toggleTag}
                    onNotesChange={onNotesChange}
                    onViewRushee={() => navigate(`/brother/rushee/${selectedRushee.id}`)}
                />
            )}
        </div>
    );
}
