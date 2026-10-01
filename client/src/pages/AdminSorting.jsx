import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import { adminGet, adminPut } from "../js/adminAxios";
import { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns, groupSortingRows } from "../features/sorting/board";
import EditableNotesPanel from "../features/sorting/EditableNotesPanel";
import SortingZoomControls from "../features/sorting/SortingZoomControls";
import SortingPresenceIndicator from "../features/sorting/SortingPresenceIndicator";
import SortingGhostCards from "../features/sorting/SortingGhostCards";
import SortingColumn from "../features/sorting/SortingColumn";
import { handleAdminSortingMessage } from "../features/sorting/handleAdminSortingMessage";
import { cleanupStaleSortingGhosts } from "../features/sorting/cleanupStaleSortingGhosts";
import { applySortingDrop } from "../features/sorting/applySortingDrop";
import { applySavedSortingTags } from "../features/sorting/applySavedSortingTags";
import { processSortingMoveQueue } from "../features/sorting/processSortingMoveQueue";
import { createSortingDragHandlers } from "../features/sorting/createSortingDragHandlers";

const SORTING_WS_URL = import.meta.env.VITE_SORTING_BROADCASTER_URL || "ws://localhost:4001";

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
            const ws = new WebSocket(`${SORTING_WS_URL}/ws`);
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

    const fetchData = useCallback(async () => {
        try {
            const current = auth.currentUser;
            if (!current) {
                navigate("/login");
                return;
            }
            const tokenResult = await current.getIdTokenResult(true);
            const isAdmin = tokenResult.claims?.admin === true;
            const email = current.email ? current.email.toLowerCase() : "";
            const isAllowlisted = email && ALLOWLIST.includes(email);
            if (!(isAdmin || isAllowlisted)) {
                navigate("/login");
                return;
            }

            const response = await adminGet(`${apiBase}/rushees/sorting`);
            if (response.data.status === "success") {
                setColumns(groupSortingRows(response.data.payload));
            } else {
                toast.error("Failed to load rushees");
            }
        } catch (err) {
            toast.error("Failed to load rushees");
        } finally {
            setLoading(false);
            setAuthChecked(true);
        }
    }, [apiBase, navigate]);

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

    const openNotes = async (rushee) => {
        setSelectedRushee(rushee);
        setNotesStatus("loading");
        try {
            const resp = await adminGet(`${apiBase}/rushees/${rushee.id}/notes`);
            if (resp.data.status === "success") {
                setNotes(resp.data.sortingNotes || "");
                setTags(resp.data.sortingTags || []);
                setNotesStatus("idle");
            } else {
                setNotes("");
                setTags([]);
                setNotesStatus("error");
            }
        } catch (err) {
            setNotes("");
            setTags([]);
            setNotesStatus("error");
        }
    };

    const closeNotes = () => {
        setSelectedRushee(null);
        setNotes("");
        setTags([]);
        setNotesStatus("idle");
        if (notesTimer.current) {
            clearTimeout(notesTimer.current);
        }
        if (tagsTimer.current) {
            clearTimeout(tagsTimer.current);
        }
    };

    const saveNotes = async (text, currentTags) => {
        if (!selectedRushee) return;
        setNotesStatus("saving");
        try {
            const resp = await adminPut(`${apiBase}/rushees/${selectedRushee.id}/notes`, {
                sortingNotes: text,
                sortingTags: currentTags,
            });
            if (resp.data.status === "success") {
                setColumns((prev) => applySavedSortingTags(prev, selectedRushee.id, currentTags));
                setNotesStatus("saved");
                setTimeout(() => setNotesStatus("idle"), 800);
            } else {
                setNotesStatus("error");
            }
        } catch (err) {
            setNotesStatus("error");
        }
    };

    const onNotesChange = (e) => {
        const val = e.target.value;
        setNotes(val);
        if (notesTimer.current) clearTimeout(notesTimer.current);
        notesTimer.current = setTimeout(() => {
            saveNotes(val, tags);
        }, 500);
    };

    const toggleTag = (tagKey) => {
        const newTags = tags.includes(tagKey)
            ? tags.filter((t) => t !== tagKey)
            : [...tags, tagKey];
        setTags(newTags);
        if (tagsTimer.current) clearTimeout(tagsTimer.current);
        tagsTimer.current = setTimeout(() => {
            saveNotes(notes, newTags);
        }, 300);
    };

    // Zoom controls
    const zoomIn = () => {
        setScale((prev) => Math.min(MAX_SCALE, prev + 0.1));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(MIN_SCALE, prev - 0.1));
    };

    const resetView = () => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    };

    // Canvas ref for wheel listener with passive: false
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e) => {
            // Check if scrolling inside a scrollable element (like the notes panel)
            // If so, let the native scroll behavior happen
            const scrollableParent = e.target.closest('[data-scrollable]');
            if (scrollableParent) {
                // Allow native scrolling inside scrollable elements
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                // Zoom with ctrl/cmd + scroll (pinch-to-zoom)
                e.preventDefault();
                const delta = -e.deltaY * 0.001;
                setScale((prev) => {
                    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
                    return next;
                });
            } else {
                // Pan with two-finger drag (trackpad scroll)
                e.preventDefault();
                setTranslate((prev) => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
            }
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, [loading]);

    const onMouseDown = (e) => {
        // Only pan with right-click (button 2)
        if (e.button !== 2) return;
        if (e.target.closest("[data-card]")) return;
        e.preventDefault();
        panState.current = {
            panning: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: translate.x,
            origY: translate.y,
        };
    };

    const onContextMenu = (e) => {
        // Prevent context menu on right-click for panning
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!panState.current.panning) return;
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        setTranslate({
            x: panState.current.origX + dx,
            y: panState.current.origY + dy,
        });
    };

    const onMouseUp = () => {
        panState.current.panning = false;
    };

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
