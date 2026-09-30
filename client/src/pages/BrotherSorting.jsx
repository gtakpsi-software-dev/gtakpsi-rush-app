import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import axios from "axios";
import { STATUSES, TAGS, MIN_SCALE, MAX_SCALE, createEmptyColumns, groupSortingRows } from "../features/sorting/board";
import ReadOnlyDetailsPanel from "../features/sorting/ReadOnlyDetailsPanel";
import SortingZoomControls from "../features/sorting/SortingZoomControls";

const SORTING_WS_URL = import.meta.env.VITE_SORTING_BROADCASTER_URL || "ws://localhost:4001";

export default function BrotherSorting() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/brother";

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState(createEmptyColumns());
    const [selectedRushee, setSelectedRushee] = useState(null);
    const [notes, setNotes] = useState("");
    const [notesLoading, setNotesLoading] = useState(false);
    const [notesTags, setNotesTags] = useState([]);

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panState = useRef({ panning: false, startX: 0, startY: 0, origX: 0, origY: 0 });

    // WebSocket for real-time collaboration
    const wsRef = useRef(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    
    // Ghost card state (shows when admin is dragging)
    const [ghostCards, setGhostCards] = useState({});
    const ghostTimestampsRef = useRef({}); // Track when each ghost was created
    
    const fetchDataRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const current = auth.currentUser;
            if (!current) {
                navigate("/login");
                return;
            }

            const response = await axios.get(`${apiBase}/sorting`);
            if (response.data.status === "success") {
                setColumns(groupSortingRows(response.data.payload));
            } else {
                toast.error("Failed to load rushees");
            }
        } catch (err) {
            toast.error("Failed to load rushees");
        } finally {
            setLoading(false);
        }
    }, [apiBase, navigate]);

    // Store fetchData in ref for WebSocket to use
    fetchDataRef.current = fetchData;

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchData();
            } else {
                navigate("/login");
            }
        });
        return () => unsubscribe();
    }, [fetchData, navigate]);

    // Connect to sorting broadcaster WebSocket for real-time updates
    useEffect(() => {
        const connectWs = () => {
            const ws = new WebSocket(`${SORTING_WS_URL}/ws`);
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
                    
                    switch (msg.type) {
                        case "viewer_count":
                            setViewerCount(msg.count);
                            break;
                        case "drag_start":
                            ghostTimestampsRef.current[msg.rushee_id] = Date.now();
                            setGhostCards((prev) => ({
                                ...prev,
                                [msg.rushee_id]: {
                                    rusheeId: msg.rushee_id,
                                    rusheeName: msg.rushee_name,
                                    x: msg.x,
                                    y: msg.y,
                                    draggerName: msg.dragger_name,
                                },
                            }));
                            break;
                        case "drag_move":
                            ghostTimestampsRef.current[msg.rushee_id] = Date.now();
                            setGhostCards((prev) => {
                                if (!prev[msg.rushee_id]) return prev;
                                return {
                                    ...prev,
                                    [msg.rushee_id]: {
                                        ...prev[msg.rushee_id],
                                        x: msg.x,
                                        y: msg.y,
                                    },
                                };
                            });
                            break;
                        case "drag_end":
                            delete ghostTimestampsRef.current[msg.rushee_id];
                            setGhostCards((prev) => {
                                if (!prev[msg.rushee_id]) return prev;
                                const next = { ...prev };
                                delete next[msg.rushee_id];
                                return next;
                            });
                            break;
                        case "card_moved":
                            // Clear ghost state for this card (fallback if drag_end was missed)
                            if (msg.rushee_id) {
                                delete ghostTimestampsRef.current[msg.rushee_id];
                                setGhostCards((prev) => {
                                    if (!prev[msg.rushee_id]) return prev;
                                    const next = { ...prev };
                                    delete next[msg.rushee_id];
                                    return next;
                                });
                            }
                            // Refresh data when a card has been moved
                            if (fetchDataRef.current) {
                                fetchDataRef.current();
                            }
                            break;
                        case "current_drag":
                            if (msg.active) {
                                ghostTimestampsRef.current[msg.rushee_id] = Date.now();
                                setGhostCards((prev) => ({
                                    ...prev,
                                    [msg.rushee_id]: {
                                        rusheeId: msg.rushee_id,
                                        rusheeName: msg.rushee_name,
                                        x: msg.x,
                                        y: msg.y,
                                        draggerName: msg.dragger_name,
                                    },
                                }));
                            }
                            break;
                    }
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

        // Stale ghost cleanup interval - clear ghosts older than 30 seconds
        const staleCleanupInterval = setInterval(() => {
            const now = Date.now();
            const STALE_THRESHOLD = 30000; // 30 seconds
            const staleIds = Object.entries(ghostTimestampsRef.current)
                .filter(([_, timestamp]) => now - timestamp > STALE_THRESHOLD)
                .map(([id]) => id);
            
            if (staleIds.length > 0) {
                console.log("Cleaning up stale ghosts:", staleIds);
                staleIds.forEach((id) => {
                    delete ghostTimestampsRef.current[id];
                });
                setGhostCards((prev) => {
                    const next = { ...prev };
                    staleIds.forEach((id) => delete next[id]);
                    return next;
                });
            }
        }, 5000); // Check every 5 seconds

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            clearInterval(staleCleanupInterval);
        };
    }, []);

    const openDetails = async (rushee) => {
        setSelectedRushee(rushee);
        setNotes("");
        setNotesTags([]);
        setNotesLoading(true);
        
        try {
            const response = await axios.get(`${apiBase}/rushees/${rushee.id}/notes`);
            if (response.data.status === "success") {
                setNotes(response.data.sortingNotes || "");
                setNotesTags(response.data.sortingTags || []);
            }
        } catch (err) {
            console.error("Failed to fetch notes", err);
        } finally {
            setNotesLoading(false);
        }
    };

    const closeDetails = () => {
        setSelectedRushee(null);
        setNotes("");
        setNotesTags([]);
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

    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e) => {
            // Check if scrolling inside a scrollable element (like the notes panel)
            // If so, let the native scroll behavior happen
            const scrollableParent = e.target.closest('[data-scrollable]');
            if (scrollableParent) {
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

    const renderColumn = (col) => {
        const items = columns[col.key] || [];
        
        return (
            <div
                key={col.key}
                className="bg-white/90 backdrop-blur-sm border-2 rounded-apple-xl shadow-sm p-4 w-64 border-apple-gray-200"
            >
                <div className="flex justify-between items-center mb-3">
                    <div className="text-apple-headline text-black font-medium">{col.label}</div>
                    <div className="text-apple-caption2 text-apple-gray-600 bg-apple-gray-100 px-2 py-0.5 rounded-full">{items.length}</div>
                </div>
                <div className="space-y-1 min-h-[60px]">
                    {items.map((r) => (
                        <div
                            key={r.id}
                            data-card
                            onClick={() => openDetails(r)}
                            className="p-3 rounded-apple-lg border-2 bg-white hover:shadow-md cursor-pointer select-none transition-all border-apple-gray-200 hover:border-apple-gray-300"
                        >
                            {/* Show name for brothers */}
                            <div className="text-apple-body text-black font-medium">
                                {r.fullName}
                            </div>
                            {/* Tags */}
                            {r.sortingTags && r.sortingTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {r.sortingTags.map((tagKey) => {
                                        const tagInfo = TAGS.find((t) => t.key === tagKey);
                                        if (!tagInfo) return null;
                                        return (
                                            <span
                                                key={tagKey}
                                                className={`text-xs px-2 py-0.5 rounded-full border ${tagInfo.color}`}
                                            >
                                                {tagInfo.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="text-apple-caption2 text-center py-6 border-2 border-dashed rounded-apple-lg border-apple-gray-200 text-apple-gray-500">
                            Empty
                        </div>
                    )}
                </div>
            </div>
        );
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
            {(() => {
                const ghostList = Object.values(ghostCards);
                const ghostCount = ghostList.length;
                if (!wsConnected) return null;
                const label =
                    ghostCount === 0
                        ? `${viewerCount} viewing`
                        : ghostCount === 1
                            ? `${ghostList[0].draggerName} is editing`
                            : `${ghostCount} admins editing`;
                return (
                    <div className="fixed top-20 right-6 z-30 flex items-center gap-2 bg-white border border-apple-gray-200 rounded-full px-3 py-1.5 shadow-sm">
                        <div className={`w-2 h-2 rounded-full ${ghostCount > 0 ? "bg-orange-500 animate-pulse" : "bg-green-500"}`}></div>
                        <span className="text-sm text-apple-gray-600">
                            {label}
                        </span>
                    </div>
                );
            })()}

            {/* Ghost Cards - Shows when admins are dragging */}
            {Object.values(ghostCards).map((ghost) => (
                <div
                    key={ghost.rusheeId}
                    className="fixed z-50 pointer-events-none"
                    style={{
                        left: ghost.x,
                        top: ghost.y,
                        transform: "translate(-50%, -50%)",
                    }}
                >
                    <div className="p-3 rounded-apple-lg border-2 border-blue-400 bg-blue-50/90 shadow-xl backdrop-blur-sm animate-pulse w-48">
                        <div className="text-apple-body text-blue-700 font-semibold">
                            {ghost.rusheeName}
                        </div>
                        <div className="text-apple-caption2 text-blue-500 mt-1">
                            Being moved by {ghost.draggerName}
                        </div>
                    </div>
                </div>
            ))}

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
                        {STATUSES.map((col) => renderColumn(col))}
                    </div>
                </div>
            </div>

            {/* View-Only Details Panel */}
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
        </div>
    );
}

