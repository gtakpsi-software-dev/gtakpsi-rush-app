import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "../components/Navbar";
import { auth } from "../firebase";

const STATUSES = [
    { key: "UNSORTED", label: "Unsorted" },
    { key: "IN_CLOUD", label: "In Cloud" },
    { key: "MID_CLOUD", label: "Mid Cloud" },
    { key: "OUT_CLOUD", label: "Out Cloud" },
    { key: "INELIGIBLE", label: "Ineligible" },
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

export default function AdminSorting() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";
    const allowlist = (import.meta.env.VITE_ADMIN_ALLOWLIST || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
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
    const [notesStatus, setNotesStatus] = useState("idle"); // idle | loading | saving | saved | error
    const notesTimer = useRef(null);

    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panState = useRef({ panning: false, startX: 0, startY: 0, origX: 0, origY: 0 });

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
            const isAllowlisted = email && allowlist.includes(email);
            if (!(isAdmin || isAllowlisted)) {
                navigate("/login");
                return;
            }
            axios.defaults.headers.common["Authorization"] = `Bearer ${tokenResult.token}`;

            const response = await axios.get(`${apiBase}/rushees/sorting`);
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
        }
    }, [apiBase, allowlist, navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDragStart = (rushee, fromColumn, index) => {
        setDragging({ id: rushee.id, fromColumn, index });
    };

    const handleDragOver = (e, columnKey, index) => {
        e.preventDefault();
        setHoverIndex({ column: columnKey, index });
    };

    const clearDragState = () => {
        setDragging(null);
        setHoverIndex({ column: null, index: null });
    };

    const persistReorder = async (updatedColumns, colsToUpdate) => {
        try {
            await Promise.all(
                colsToUpdate.map((colKey) => {
                    const ids = updatedColumns[colKey].map((r) => r.id);
                    return axios.put(`${apiBase}/rushees/reorder`, {
                        column: colKey,
                        orderedRusheeIds: ids,
                    });
                })
            );
        } catch (err) {
            toast.error("Failed to save order; reverting");
            await fetchData();
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

            // persist async
            const colsToUpdate =
                fromColumn === targetColumn ? [targetColumn] : [fromColumn, targetColumn];
            persistReorder(updated, colsToUpdate);

            return updated;
        });
        clearDragState();
    };

    const openNotes = async (rushee) => {
        setSelectedRushee(rushee);
        setNotesStatus("loading");
        try {
            const resp = await axios.get(`${apiBase}/rushees/${rushee.id}/notes`);
            if (resp.data.status === "success") {
                setNotes(resp.data.sortingNotes || "");
                setNotesStatus("idle");
            } else {
                setNotes("");
                setNotesStatus("error");
            }
        } catch (err) {
            setNotes("");
            setNotesStatus("error");
        }
    };

    const closeNotes = () => {
        setSelectedRushee(null);
        setNotes("");
        setNotesStatus("idle");
        if (notesTimer.current) {
            clearTimeout(notesTimer.current);
        }
    };

    const saveNotes = async (text) => {
        if (!selectedRushee) return;
        setNotesStatus("saving");
        try {
            const resp = await axios.put(`${apiBase}/rushees/${selectedRushee.id}/notes`, {
                sortingNotes: text,
            });
            if (resp.data.status === "success") {
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
            saveNotes(val);
        }, 500);
    };

    // Pan + zoom handlers
    const onWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            setScale((prev) => {
                const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
                return next;
            });
        }
    };

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

    const renderColumn = (col) => {
        const items = columns[col.key] || [];
        return (
            <div
                key={col.key}
                className="bg-white/90 backdrop-blur-sm border border-apple-gray-200 rounded-apple-xl shadow-sm p-4 w-64"
                onDragOver={(e) => handleDragOver(e, col.key, items.length)}
                onDrop={() => handleDrop(col.key, hoverIndex.column === col.key ? hoverIndex.index : items.length)}
            >
                <div className="flex justify-between items-center mb-3">
                    <div className="text-apple-headline text-black font-medium">{col.label}</div>
                    <div className="text-apple-caption2 text-apple-gray-600">{items.length}</div>
                </div>
                <div className="space-y-2">
                    {items.map((r, idx) => (
                        <div
                            key={r.id}
                            data-card
                            draggable
                            onDragStart={() => handleDragStart(r, col.key, idx)}
                            onDragOver={(e) => handleDragOver(e, col.key, idx)}
                            onDrop={() => handleDrop(col.key, idx)}
                            onClick={() => openNotes(r)}
                            className={`p-3 rounded-apple-lg border border-apple-gray-200 bg-white hover:shadow-md cursor-grab select-none ${
                                dragging?.id === r.id ? "opacity-70" : ""
                            }`}
                        >
                            <div className="text-apple-body text-black font-medium">{r.fullName}</div>
                            <div className="text-apple-caption2 text-apple-gray-600">Rushee #{r.rushNumber}</div>
                            {hoverIndex.column === col.key && hoverIndex.index === idx && (
                                <div className="h-0.5 bg-black/60 mt-2 rounded"></div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="text-apple-caption2 text-apple-gray-500 text-center py-4 border border-dashed border-apple-gray-200 rounded-apple-lg">
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
            className="w-screen h-screen overflow-hidden bg-apple-gray-50"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
        >
            <Navbar />
            <div className="p-4">
                <h1 className="text-apple-title1 font-normal text-black mb-2">Rushee Sorting</h1>
                <p className="text-apple-footnote text-apple-gray-600">
                    Drag and drop rushees across clouds. Pan with drag; zoom with ctrl/cmd + scroll.
                </p>
            </div>

            <div className="relative w-full h-[calc(100vh-120px)] overflow-hidden">
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

            {selectedRushee && (
                <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-apple-gray-200 z-20 flex flex-col">
                    <div className="p-4 border-b border-apple-gray-200 flex items-start justify-between">
                        <div>
                            <div className="text-apple-headline text-black font-medium">
                                {selectedRushee.fullName}
                            </div>
                            <div className="text-apple-caption2 text-apple-gray-600">
                                Rushee #{selectedRushee.rushNumber} • {selectedRushee.sortingStatus.replace("_", " ")}
                            </div>
                        </div>
                        <button
                            onClick={closeNotes}
                            className="text-apple-gray-500 hover:text-black text-xl leading-none"
                        >
                            ×
                        </button>
                    </div>
                    <div className="p-4 flex-1 overflow-auto">
                        {notesStatus === "loading" ? (
                            <div className="text-apple-body text-apple-gray-600">Loading notes...</div>
                        ) : (
                            <textarea
                                className="w-full h-full border border-apple-gray-200 rounded-apple-lg p-3 text-apple-body text-black outline-none focus:border-black"
                                value={notes}
                                onChange={onNotesChange}
                                placeholder="Add notes..."
                            />
                        )}
                    </div>
                    <div className="p-4 border-t border-apple-gray-200 text-apple-caption2 text-apple-gray-600">
                        {notesStatus === "saving" && "Saving..."}
                        {notesStatus === "saved" && "Saved"}
                        {notesStatus === "error" && "Error saving notes"}
                        {notesStatus === "idle" && "Autosave enabled"}
                    </div>
                </div>
            )}
        </div>
    );
}

