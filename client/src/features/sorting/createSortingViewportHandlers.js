// Create bounded zoom, wheel pan, and right-button drag-pan actions for the board.
export function createSortingViewportHandlers({
    scaleLimits, panState, translate, setScale, setTranslate,
}) {
    // Increase the board zoom by one step.
    const zoomIn = () => {
        setScale(/* Clamp the increased zoom to the maximum scale. */ (prev) => Math.min(scaleLimits.max, prev + 0.1));
    };

    // Decrease the board zoom by one step.
    const zoomOut = () => {
        setScale(/* Clamp the decreased zoom to the minimum scale. */ (prev) => Math.max(scaleLimits.min, prev - 0.1));
    };

    // Restore the default scale and translation.
    const resetView = () => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    };

    // Zoom with modifier-wheel input or pan otherwise, excluding scrollable detail panels.
    const handleWheel = (e) => {
        // Let the notes panel scroll natively; the board owns wheel gestures elsewhere.
        const scrollableParent = e.target.closest('[data-scrollable]');
        if (scrollableParent) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            setScale((prev) => {
                // Clamp wheel-driven zoom to the supported scale range.
                const next = Math.min(scaleLimits.max, Math.max(scaleLimits.min, prev + delta));
                return next;
            });
        } else {
            e.preventDefault();
            setTranslate(/* Translate the board opposite the wheel deltas. */ (prev) => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY,
            }));
        }
    };

    // Begin right-button panning outside board cards.
    const onMouseDown = (e) => {
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

    // Suppress the browser context menu on the board.
    const onContextMenu = (e) => {
        e.preventDefault();
    };

    // Update board translation from the active pan gesture.
    const onMouseMove = (e) => {
        if (!panState.current.panning) return;
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        setTranslate({
            x: panState.current.origX + dx,
            y: panState.current.origY + dy,
        });
    };

    // End the active pan gesture.
    const onMouseUp = () => {
        panState.current.panning = false;
    };

    return {
        zoomIn, zoomOut, resetView, handleWheel,
        onMouseDown, onContextMenu, onMouseMove, onMouseUp,
    };
}
