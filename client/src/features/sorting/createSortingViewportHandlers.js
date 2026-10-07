export function createSortingViewportHandlers({
    scaleLimits, panState, translate, setScale, setTranslate,
}) {
    const zoomIn = () => {
        setScale((prev) => Math.min(scaleLimits.max, prev + 0.1));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(scaleLimits.min, prev - 0.1));
    };

    const resetView = () => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    };

    const handleWheel = (e) => {
        // Let the notes panel scroll natively; the board owns wheel gestures elsewhere.
        const scrollableParent = e.target.closest('[data-scrollable]');
        if (scrollableParent) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            setScale((prev) => {
                const next = Math.min(scaleLimits.max, Math.max(scaleLimits.min, prev + delta));
                return next;
            });
        } else {
            e.preventDefault();
            setTranslate((prev) => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY,
            }));
        }
    };

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

    const onContextMenu = (e) => {
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

    return {
        zoomIn, zoomOut, resetView, handleWheel,
        onMouseDown, onContextMenu, onMouseMove, onMouseUp,
    };
}
