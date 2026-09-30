import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import { adminGet, adminPut } from "../js/adminAxios";
import { STATUSES, TAGS, MIN_SCALE, MAX_SCALE, createEmptyColumns, groupSortingRows } from "../features/sorting/board";
import EditableNotesPanel from "../features/sorting/EditableNotesPanel";
import SortingZoomControls from "../features/sorting/SortingZoomControls";
import SortingPresenceIndicator from "../features/sorting/SortingPresenceIndicator";
import SortingGhostCards from "../features/sorting/SortingGhostCards";

const SORTING_WS_URL = import.meta.env.VITE_SORTING_BROADCASTER_URL || "ws://localhost:4001";

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
        } catch (err) {
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
                                    // Show only rushee number for bidcom
                                    rusheeName: `Rushee`,
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
                                        rusheeName: `Rushee`,
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
                // Update tags in columns state
                setColumns((prev) => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach((colKey) => {
                        updated[colKey] = updated[colKey].map((r) =>
                            r.id === selectedRushee.id ? { ...r, sortingTags: currentTags } : r
                        );
                    });
                    return updated;
                });
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
                            onClick={() => openNotes(r)}
                            className="p-3 rounded-apple-lg border-2 bg-white hover:shadow-md cursor-pointer select-none transition-all border-apple-gray-200 hover:border-apple-gray-300"
                        >
                            {/* Show ONLY rushee number, not name */}
                            <div className="text-apple-body text-black font-semibold">
                                Rushee #{r.rushNumber}
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
                        {STATUSES.map((col) => renderColumn(col))}
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
