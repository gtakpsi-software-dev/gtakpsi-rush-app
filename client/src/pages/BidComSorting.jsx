import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import { realtimeBaseUrls } from "../config/realtimeBaseUrls";
import { adminGet, adminPut } from "../js/adminAxios";
import { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns, groupSortingRows } from "../features/sorting/board";
import EditableNotesPanel from "../features/sorting/EditableNotesPanel";
import ViewerSortingColumn from "../features/sorting/ViewerSortingColumn";
import SortingZoomControls from "../features/sorting/SortingZoomControls";
import SortingPresenceIndicator from "../features/sorting/SortingPresenceIndicator";
import SortingGhostCards from "../features/sorting/SortingGhostCards";
import { createSortingViewportHandlers } from "../features/sorting/createSortingViewportHandlers";
import { createSortingNotesHandlers } from "../features/sorting/createSortingNotesHandlers";
import { handleSortingViewerMessage } from "../features/sorting/handleSortingViewerMessage";
import { cleanupStaleSortingGhosts } from "../features/sorting/cleanupStaleSortingGhosts";

// Parse allowlist once at module level (admins)
const ALLOWLIST = (import.meta.env.VITE_ADMIN_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

export default function BidComSorting() {
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

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panState = useRef({ panning: false, startX: 0, startY: 0, origX: 0, origY: 0 });

    // WebSocket for real-time collaboration
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    
    // Ghost card state (shows when admin is dragging)
    const [ghostCards, setGhostCards] = useState({}); // { [rusheeId]: { rusheeId, rusheeName, x, y, draggerName } }
    const ghostTimestampsRef = useRef({}); // Track when each ghost was created
    
    const fetchDataRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const current = auth.currentUser;
            if (!current) {
                navigate("/login");
                return;
            }
            const tokenResult = await current.getIdTokenResult(true);
            const isAdmin = tokenResult.claims?.admin === true;
            const isBidcom = tokenResult.claims?.bidcom === true;
            const email = current.email ? current.email.toLowerCase() : "";
            const isAllowlisted = email && ALLOWLIST.includes(email);
            
            // Allow if admin, bidcom, or allowlisted
            if (!(isAdmin || isBidcom || isAllowlisted)) {
                toast.error("Access denied - Bid Committee or Admin only");
                navigate("/dashboard");
                return;
            }

            const response = await adminGet(`${apiBase}/rushees/sorting`);
            if (response.data.status === "success") {
                setColumns(groupSortingRows(response.data.payload));
            } else {
                toast.error("Failed to load rushees");
            }
        } catch {
            toast.error("Failed to load rushees");
        } finally {
            setLoading(false);
            setAuthChecked(true);
        }
    }, [apiBase, navigate]);

    // Store fetchData in ref for WebSocket to use
    fetchDataRef.current = fetchData;

    useEffect(() => {
        if (authChecked) return;
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchData();
            } else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [fetchData, authChecked, navigate]);

    // Connect to sorting broadcaster WebSocket for real-time updates
    useEffect(() => {
        const connectWs = () => {
            const ws = new WebSocket(`${realtimeBaseUrls.sorting}/ws`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("Connected to sorting broadcaster (viewer)");
                setWsConnected(true);
                // Join as viewer (non-admin)
                const user = auth.currentUser;
                const name = user?.displayName || user?.email?.split("@")[0] || "Viewer";
                ws.send(JSON.stringify({ type: "join", is_admin: false, name }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    handleSortingViewerMessage(msg, {
                        ghostTimestampsRef, fetchDataRef, setViewerCount, setGhostCards,
                        showRusheeNames: false,
                    });
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            ws.onclose = () => {
                console.log("Disconnected from sorting broadcaster");
                setWsConnected(false);
                setGhostCards({});
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
            cleanupStaleSortingGhosts({ ghostTimestampsRef, setGhostCards });
        }, 5000);

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    }, []);

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
                hideWhenAlone={false}
            />

            {/* Ghost Cards - Shows when admin is dragging */}
            <SortingGhostCards ghostCards={ghostCards} wide={false} />

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
                        transition: "transform 0.05s ease-out",
                    }}
                >
                    <div className="flex gap-4 p-6">
                        {STATUSES.map((col) => (
                            <ViewerSortingColumn
                                key={col.key}
                                col={col}
                                columns={columns}
                                showRusheeNames={false}
                                onOpen={openNotes}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Notes Side Panel */}
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
        </div>
    );
}
