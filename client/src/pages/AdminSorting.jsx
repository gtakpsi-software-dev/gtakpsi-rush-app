import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";
import { adminGet, adminPut } from "../js/adminAxios";

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
    const [columns, setColumns] = useState({
        UNSORTED: [],
        IN_CLOUD: [],
        MID_CLOUD: [],
        OUT_CLOUD: [],
        INELIGIBLE: [],
    });
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
    const dragPositionRef = useRef({ x: 0, y: 0 });
    const throttleRef = useRef(null);
    const reorderInFlightRef = useRef(false);
    const pendingReorderRef = useRef(null);

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
                    if (msg.type === "viewer_count") {
                        setViewerCount(msg.count);
                    }
                    // Admin doesn't need to handle incoming drag events (they're the source)
                } catch (e) {
                    console.error("Failed to parse WS message", e);
                }
            };

            ws.onclose = () => {
                console.log("Disconnected from sorting broadcaster");
                setWsConnected(false);
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
                // sort by sortingOrder within column
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
            setAuthChecked(true);
        }
    }, [apiBase, navigate]);

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

    const handleDragStart = (rushee, fromColumn, index, e) => {
        setDragging({ id: rushee.id, fromColumn, index, rushee });
        
        // Send drag_start to WebSocket
        const rect = e?.currentTarget?.getBoundingClientRect();
        const x = rect ? rect.left : 0;
        const y = rect ? rect.top : 0;
        dragPositionRef.current = { x, y };
        
        wsSend({
            type: "drag_start",
            rushee_id: rushee.id,
            rushee_name: rushee.fullName,
            x,
            y,
        });
    };

    const handleDragOver = (e, columnKey, index) => {
        e.preventDefault();
        setHoverIndex({ column: columnKey, index });
        
        // Throttle drag_move messages to ~30fps
        const now = Date.now();
        if (!throttleRef.current || now - throttleRef.current > 33) {
            throttleRef.current = now;
            const x = e.clientX;
            const y = e.clientY;
            dragPositionRef.current = { x, y };
            wsSend({ type: "drag_move", x, y });
        }
    };

    const clearDragState = () => {
        // Send drag_end to WebSocket
        wsSend({ type: "drag_end" });
        
        setDragging(null);
        setHoverIndex({ column: null, index: null });
    };

    const persistReorder = async (updatedColumns, colsToUpdate, movedRusheeId, newStatus) => {
        if (reorderInFlightRef.current) {
            pendingReorderRef.current = { updatedColumns, colsToUpdate, movedRusheeId, newStatus };
            return;
        }

        reorderInFlightRef.current = true;
        try {
            await Promise.all(
                colsToUpdate.map((colKey) => {
                    const ids = updatedColumns[colKey].map((r) => r.id);
                    return adminPut(`${apiBase}/rushees/reorder`, {
                        column: colKey,
                        orderedRusheeIds: ids,
                    });
                })
            );

            // Notify WebSocket that card was saved (only if no newer reorder is queued)
            if (movedRusheeId && newStatus && !pendingReorderRef.current) {
                wsSend({ type: "card_saved", rushee_id: movedRusheeId, new_status: newStatus });
            }
        } catch (err) {
            toast.error("Failed to save order; reverting");
            pendingReorderRef.current = null;
            await fetchData();
        } finally {
            reorderInFlightRef.current = false;
            if (pendingReorderRef.current) {
                const next = pendingReorderRef.current;
                pendingReorderRef.current = null;
                persistReorder(
                    next.updatedColumns,
                    next.colsToUpdate,
                    next.movedRusheeId,
                    next.newStatus
                );
            }
        }
    };

    const handleDrop = (targetColumn, targetIndex) => {
        if (!dragging) return;
        const { id, fromColumn } = dragging;
        setColumns((prev) => {
            const updated = { ...prev };
            const sourceList = [...updated[fromColumn]];
            const targetList = fromColumn === targetColumn ? sourceList : [...updated[targetColumn]];

            const draggedItemIndex = sourceList.findIndex((r) => r.id === id);
            if (draggedItemIndex === -1) return prev;
            const [item] = sourceList.splice(draggedItemIndex, 1);
            // if moving across, update status
            const newItem = { ...item, sortingStatus: targetColumn };

            let insertAt = targetIndex;
            if (insertAt === null || insertAt === undefined || insertAt > targetList.length) {
                insertAt = targetList.length;
            }
            targetList.splice(insertAt, 0, newItem);

            // rebuild columns
            if (fromColumn === targetColumn) {
                updated[targetColumn] = targetList.map((r, idx) => ({
                    ...r,
                    sortingOrder: idx + 1,
                }));
            } else {
                updated[fromColumn] = sourceList.map((r, idx) => ({
                    ...r,
                    sortingOrder: idx + 1,
                }));
                updated[targetColumn] = targetList.map((r, idx) => ({
                    ...r,
                    sortingOrder: idx + 1,
                }));
            }

            // persist async - pass rushee id and new status for WebSocket notification
            const colsToUpdate =
                fromColumn === targetColumn ? [targetColumn] : [fromColumn, targetColumn];
            persistReorder(updated, colsToUpdate, id, targetColumn);

            return updated;
        });
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

    // Canvas ref for wheel listener with passive: false
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
        if (e.target.closest("[data-card]")) return; // don't pan when grabbing card
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

    // Drop indicator component
    const DropIndicator = () => (
        <div className="h-1 bg-blue-500 rounded-full my-1 shadow-lg shadow-blue-500/50 animate-pulse" />
    );

    const renderColumn = (col) => {
        const items = columns[col.key] || [];
        const isHoveringThisColumn = hoverIndex.column === col.key;
        const isHoveringEmptyArea = isHoveringThisColumn && hoverIndex.index >= items.length;
        
        return (
            <div
                key={col.key}
                className={`bg-white/90 backdrop-blur-sm border-2 rounded-apple-xl shadow-sm p-4 w-64 transition-colors ${
                    isHoveringThisColumn && dragging ? "border-blue-400 bg-blue-50/50" : "border-apple-gray-200"
                }`}
                onDragOver={(e) => handleDragOver(e, col.key, items.length)}
                onDrop={() => handleDrop(col.key, hoverIndex.column === col.key ? hoverIndex.index : items.length)}
                onDragLeave={() => {
                    if (hoverIndex.column === col.key) {
                        setHoverIndex({ column: null, index: null });
                    }
                }}
            >
                <div className="flex justify-between items-center mb-3">
                    <div className="text-apple-headline text-black font-medium">{col.label}</div>
                    <div className="text-apple-caption2 text-apple-gray-600 bg-apple-gray-100 px-2 py-0.5 rounded-full">{items.length}</div>
                </div>
                <div className="space-y-1 min-h-[60px]">
                    {items.map((r, idx) => (
                        <React.Fragment key={r.id}>
                            {/* Drop indicator BEFORE this card */}
                            {isHoveringThisColumn && hoverIndex.index === idx && dragging && dragging.id !== r.id && (
                                <DropIndicator />
                            )}
                            <div
                                data-card
                                draggable
                                onDragStart={(e) => handleDragStart(r, col.key, idx, e)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Determine if we're in the top or bottom half of the card
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const midY = rect.top + rect.height / 2;
                                    const insertIndex = e.clientY < midY ? idx : idx + 1;
                                    setHoverIndex({ column: col.key, index: insertIndex });
                                }}
                                onDrop={(e) => {
                                    e.stopPropagation();
                                    handleDrop(col.key, hoverIndex.index);
                                }}
                                onClick={() => openNotes(r)}
                                className={`p-3 rounded-apple-lg border-2 bg-white hover:shadow-md cursor-grab select-none transition-all ${
                                    dragging?.id === r.id 
                                        ? "opacity-50 border-dashed border-apple-gray-300 bg-apple-gray-50" 
                                        : "border-apple-gray-200 hover:border-apple-gray-300"
                                }`}
                            >
                                <div className="text-apple-body text-black font-medium">{r.fullName}</div>
                                <div className="text-apple-caption2 text-apple-gray-600">Rushee #{r.rushNumber}</div>
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
                            {/* Drop indicator AFTER this card (only for last item) */}
                            {isHoveringThisColumn && hoverIndex.index === idx + 1 && idx === items.length - 1 && dragging && dragging.id !== r.id && (
                                <DropIndicator />
                            )}
                        </React.Fragment>
                    ))}
                    {/* Empty state or drop zone at end */}
                    {items.length === 0 ? (
                        <div 
                            className={`text-apple-caption2 text-center py-6 border-2 border-dashed rounded-apple-lg transition-colors ${
                                isHoveringThisColumn && dragging 
                                    ? "border-blue-400 bg-blue-50 text-blue-600" 
                                    : "border-apple-gray-200 text-apple-gray-500"
                            }`}
                        >
                            {isHoveringThisColumn && dragging ? "Drop here" : "Empty"}
                        </div>
                    ) : (
                        /* Invisible drop zone at end of non-empty column */
                        isHoveringEmptyArea && dragging && (
                            <DropIndicator />
                        )
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
            
            {/* Viewer Count - Top Right */}
            {wsConnected && viewerCount > 1 && (
                <div className="fixed top-20 right-6 z-30 flex items-center gap-2 bg-white border border-apple-gray-200 rounded-full px-3 py-1.5 shadow-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-apple-gray-600">{viewerCount} viewing</span>
                </div>
            )}

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
                        transition: dragging ? "none" : "transform 0.05s ease-out",
                    }}
                >
                    <div className="flex gap-4 p-6">
                        {STATUSES.map((col) => renderColumn(col))}
                    </div>
                </div>
            </div>

            {/* Notes Side Panel */}
            {selectedRushee && (
                <>
                    {/* Backdrop overlay */}
                    <div 
                        className="fixed inset-0 bg-black/20 z-10"
                        onClick={closeNotes}
                    />
                    <div className="fixed top-16 bottom-16 right-0 w-full max-w-md bg-white shadow-2xl border-l border-apple-gray-200 z-20 flex flex-col rounded-l-2xl">
                        <div className="p-5 border-b border-apple-gray-200 flex items-start justify-between">
                            <div>
                                <div className="text-xl text-black font-semibold">
                                    {selectedRushee.fullName}
                                </div>
                                <div className="text-sm text-apple-gray-500 mt-1">
                                    Rushee #{selectedRushee.rushNumber} • {selectedRushee.sortingStatus.replace("_", " ")}
                                </div>
                            </div>
                            <button
                                onClick={closeNotes}
                                className="w-9 h-9 flex items-center justify-center text-apple-gray-400 hover:text-black hover:bg-apple-gray-100 rounded-full text-2xl leading-none transition-colors"
                                title="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-auto flex flex-col gap-4">
                            {notesStatus === "loading" ? (
                                <div className="text-apple-body text-apple-gray-600">Loading...</div>
                            ) : (
                                <>
                                    {/* Tags Section */}
                                    <div>
                                        <div className="text-sm font-medium text-apple-gray-700 mb-2">Tags</div>
                                        <div className="flex flex-wrap gap-2">
                                            {TAGS.map((tag) => {
                                                const isSelected = tags.includes(tag.key);
                                                return (
                                                    <button
                                                        key={tag.key}
                                                        onClick={() => toggleTag(tag.key)}
                                                        className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                                                            isSelected
                                                                ? tag.color + " border-current"
                                                                : "bg-apple-gray-50 text-apple-gray-500 border-apple-gray-200 hover:border-apple-gray-300"
                                                        }`}
                                                    >
                                                        {isSelected && <span className="mr-1">✓</span>}
                                                        {tag.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* Notes Section */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="text-sm font-medium text-apple-gray-700 mb-2">Notes</div>
                                        <textarea
                                            className="w-full flex-1 min-h-[150px] border border-apple-gray-200 rounded-apple-lg p-3 text-apple-body text-black outline-none focus:border-black resize-none"
                                            value={notes}
                                            onChange={onNotesChange}
                                            placeholder="Add notes about this rushee..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-apple-gray-200 flex justify-between items-center">
                            <span className="text-apple-caption2 text-apple-gray-600">
                                {notesStatus === "saving" && "Saving..."}
                                {notesStatus === "saved" && "✓ Saved"}
                                {notesStatus === "error" && "Error saving notes"}
                                {notesStatus === "idle" && "Autosave enabled"}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/brother/rushee/${selectedRushee.id}`)}
                                    className="px-4 py-2 bg-black text-white text-apple-body rounded-apple hover:bg-apple-gray-800 transition-colors"
                                >
                                    View Rushee Page
                                </button>
                                <button
                                    onClick={closeNotes}
                                    className="px-4 py-2 bg-apple-gray-100 text-apple-body text-black rounded-apple hover:bg-apple-gray-200 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

