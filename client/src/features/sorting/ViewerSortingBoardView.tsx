import type { ComponentProps, MouseEventHandler, ReactNode, Ref } from "react";

import Navbar from "../../components/Navbar";
import { STATUSES } from "./board";
import ViewerSortingColumn from "./ViewerSortingColumn";
import SortingZoomControls from "./SortingZoomControls";
import SortingPresenceIndicator from "./SortingPresenceIndicator";
import SortingGhostCards from "./SortingGhostCards";

type ViewerSortingBoardViewProps =
    Pick<ComponentProps<typeof ViewerSortingColumn>, "columns" | "showRusheeNames" | "onOpen"> & {
        canvasRef: Ref<HTMLDivElement>;
        onMouseDown: MouseEventHandler<HTMLDivElement>;
        onMouseMove: MouseEventHandler<HTMLDivElement>;
        onMouseUp: MouseEventHandler<HTMLDivElement>;
        onContextMenu: MouseEventHandler<HTMLDivElement>;
        connected: boolean;
        viewerCount: number;
        ghostCards: ComponentProps<typeof SortingGhostCards>["ghostCards"];
        scale: number;
        onZoomOut: () => void;
        onZoomIn: () => void;
        onResetView: () => void;
        translate: { x: number; y: number };
        children: ReactNode;
    };

// Render the viewer board with pan and zoom, remote drags, and supplied detail panels.
export default function ViewerSortingBoardView({
    canvasRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onContextMenu,
    connected,
    viewerCount,
    ghostCards,
    scale,
    onZoomOut,
    onZoomIn,
    onResetView,
    translate,
    columns,
    showRusheeNames,
    onOpen,
    children,
}: ViewerSortingBoardViewProps) {
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
                connected={connected}
                viewerCount={viewerCount}
                ghostCards={ghostCards}
                hideWhenAlone={false}
            />

            <SortingGhostCards ghostCards={ghostCards} wide={false} />

            <SortingZoomControls
                scale={scale}
                onZoomOut={onZoomOut}
                onZoomIn={onZoomIn}
                onResetView={onResetView}
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
                        {STATUSES.map(/* Render a read-only column for this sorting status. */ (col) => (
                            <ViewerSortingColumn
                                key={col.key}
                                col={col}
                                columns={columns}
                                showRusheeNames={showRusheeNames}
                                onOpen={onOpen}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {children}
        </div>
    );
}
