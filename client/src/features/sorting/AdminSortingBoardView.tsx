import type { ComponentProps, MouseEventHandler, Ref } from 'react';

import Navbar from '../../components/Navbar';
import { STATUSES } from './board';
import EditableNotesPanel from './EditableNotesPanel';
import SortingColumn from './SortingColumn';
import SortingGhostCards from './SortingGhostCards';
import SortingPresenceIndicator from './SortingPresenceIndicator';
import SortingZoomControls from './SortingZoomControls';

type NotesProps = ComponentProps<typeof EditableNotesPanel>;
type AdminSortingBoardViewProps =
    Omit<ComponentProps<typeof SortingColumn>, 'col'> &
    Pick<NotesProps, 'notesStatus' | 'tags' | 'notes' | 'onNotesChange' | 'onViewRushee'> & {
        canvasRef: Ref<HTMLDivElement>;
        onMouseDown: MouseEventHandler<HTMLDivElement>;
        onMouseMove: MouseEventHandler<HTMLDivElement>;
        onMouseUp: MouseEventHandler<HTMLDivElement>;
        onContextMenu: MouseEventHandler<HTMLDivElement>;
        wsConnected: boolean;
        viewerCount: number;
        ghostCards: ComponentProps<typeof SortingGhostCards>['ghostCards'];
        scale: number;
        zoomOut: () => void;
        zoomIn: () => void;
        resetView: () => void;
        translate: { x: number; y: number };
        selectedRushee: NotesProps['selectedRushee'] | null;
        closeNotes: NotesProps['onClose'];
        toggleTag: NotesProps['onToggleTag'];
    };

export default function AdminSortingBoardView({
    canvasRef, onMouseDown, onMouseMove, onMouseUp, onContextMenu,
    wsConnected, viewerCount, ghostCards, scale, zoomOut, zoomIn,
    resetView, translate, dragging, columns, hoverIndex, draggingRef,
    lockedCards, setHoverIndex, handleDragOver, handleDrop,
    handleDragStart, handleDragEnd, openNotes, selectedRushee,
    notesStatus, tags, notes, closeNotes, toggleTag, onNotesChange,
    onViewRushee,
}: AdminSortingBoardViewProps) {
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

            <SortingPresenceIndicator
                connected={wsConnected}
                viewerCount={viewerCount}
                ghostCards={ghostCards}
                hideWhenAlone={true}
            />

            <SortingGhostCards ghostCards={ghostCards} wide={true} />

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
                    onViewRushee={onViewRushee}
                />
            )}
        </div>
    );
}
