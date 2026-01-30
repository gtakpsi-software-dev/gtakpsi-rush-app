import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import axios from "axios";

const SORTING_WS_URL = import.meta.env.VITE_SORTING_BROADCASTER_URL || "ws://localhost:4001";

const STATUSES = [
    { key: "UNSORTED", label: "Unsorted" },
    { key: "IN_CLOUD", label: "In Cloud" },
    { key: "MID_CLOUD", label: "Mid Cloud" },
    { key: "OUT_CLOUD", label: "Out Cloud" },
    { key: "INELIGIBLE", label: "Ineligible" },
];

const TAGS = [
    { key: "night_1", label: "Night 1", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { key: "night_2", label: "Night 2", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { key: "closed_night", label: "Closed Night", color: "bg-amber-100 text-amber-700 border-amber-200" },
    { key: "hard_no", label: "Hard No", color: "bg-red-100 text-red-600 border-red-200" },
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

export default function BrotherSorting() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/brother";

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState({
        UNSORTED: [],
        IN_CLOUD: [],
        MID_CLOUD: [],
        OUT_CLOUD: [],
        INELIGIBLE: [],
    });
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
                const grouped = {
                    UNSORTED: [],
                    IN_CLOUD: [],
                    MID_CLOUD: [],
                    OUT_CLOUD: [],
                    INELIGIBLE: [],
                };
                response.data.payload.forEach((r) => {
                    if (grouped[r.sortingStatus]) {
                        grouped[r.sortingStatus].push(r);
                    } else {
                        grouped.UNSORTED.push(r);
                    }
                });
                Object.keys(grouped).forEach((k) => {
                    grouped[k].sort((a, b) => a.sortingOrder - b.sortingOrder);
                });
                setColumns(grouped);
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
                            setGhostCards((prev) => {
                                if (!prev[msg.rushee_id]) return prev;
                                const next = { ...prev };
                                delete next[msg.rushee_id];
                                return next;
                            });
                            break;
                        case "card_moved":
                            // Refresh data when a card has been moved
                            if (fetchDataRef.current) {
                                fetchDataRef.current();
                            }
                            break;
                        case "current_drag":
                            if (msg.active) {
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

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
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
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY * 0.001;
                setScale((prev) => {
                    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
                    return next;
                });
            }
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, []);

    const onMouseDown = (e) => {
        if (e.target.closest("[data-card]")) return;
        panState.current = {
            panning: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: translate.x,
            origY: translate.y,
        };
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
            <div className="fixed bottom-20 left-6 z-30 flex items-center gap-2 bg-white border border-apple-gray-200 rounded-2xl px-4 py-3 shadow-lg">
                <button
                    onClick={zoomOut}
                    className="w-10 h-10 flex items-center justify-center text-apple-gray-700 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors text-2xl font-light"
                    title="Zoom out"
                >
                    −
                </button>
                <span className="text-sm text-apple-gray-600 w-14 text-center font-medium">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={zoomIn}
                    className="w-10 h-10 flex items-center justify-center text-apple-gray-700 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors text-2xl font-light"
                    title="Zoom in"
                >
                    +
                </button>
                <div className="w-px h-8 bg-apple-gray-200 mx-2"></div>
                <button
                    onClick={resetView}
                    className="px-3 h-10 flex items-center justify-center text-sm text-apple-gray-600 hover:text-black hover:bg-apple-gray-100 rounded-xl transition-colors font-medium"
                    title="Reset view"
                >
                    Reset
                </button>
            </div>

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
                <>
                    <div 
                        className="fixed inset-0 bg-black/20 z-10"
                        onClick={closeDetails}
                    />
                    <div className="fixed top-16 bottom-16 right-0 w-full max-w-md bg-white shadow-2xl border-l border-apple-gray-200 z-20 flex flex-col rounded-l-2xl">
                        <div className="p-5 border-b border-apple-gray-200 flex items-start justify-between">
                            <div>
                                <div className="text-xl text-black font-semibold">
                                    {selectedRushee.fullName}
                                </div>
                                <div className="text-sm text-apple-gray-500 mt-1">
                                    {selectedRushee.sortingStatus.replace("_", " ")}
                                </div>
                            </div>
                            <button
                                onClick={closeDetails}
                                className="w-9 h-9 flex items-center justify-center text-apple-gray-400 hover:text-black hover:bg-apple-gray-100 rounded-full text-2xl leading-none transition-colors"
                                title="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-auto">
                            {notesLoading ? (
                                <div className="text-apple-body text-apple-gray-500 text-center py-4">
                                    Loading notes...
                                </div>
                            ) : (
                                <>
                                    {/* Tags Section - View Only */}
                                    {notesTags && notesTags.length > 0 && (
                                        <div className="mb-4">
                                            <div className="text-sm font-medium text-apple-gray-700 mb-2">Tags</div>
                                            <div className="flex flex-wrap gap-2">
                                                {notesTags.map((tagKey) => {
                                                    const tagInfo = TAGS.find((t) => t.key === tagKey);
                                                    if (!tagInfo) return null;
                                                    return (
                                                        <span
                                                            key={tagKey}
                                                            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${tagInfo.color}`}
                                                        >
                                                            {tagInfo.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Notes Section - View Only */}
                                    <div className="mb-4">
                                        <div className="text-sm font-medium text-apple-gray-700 mb-2">Notes</div>
                                        {notes ? (
                                            <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 whitespace-pre-wrap text-apple-body text-black">
                                                {notes}
                                            </div>
                                        ) : (
                                            <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 text-apple-body text-apple-gray-400 italic">
                                                No notes yet
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* View-Only Notice */}
                                    <div className="bg-amber-50 rounded-apple-lg p-3 border border-amber-200">
                                        <p className="text-apple-footnote text-amber-700 text-center">
                                            This is a view-only board. Contact an admin to make changes.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-apple-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => navigate(`/brother/rushee/${selectedRushee.id}`)}
                                className="px-4 py-2 bg-black text-white text-apple-body rounded-apple hover:bg-apple-gray-800 transition-colors"
                            >
                                View Rushee Page
                            </button>
                            <button
                                onClick={closeDetails}
                                className="px-4 py-2 bg-apple-gray-100 text-apple-body text-black rounded-apple hover:bg-apple-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

