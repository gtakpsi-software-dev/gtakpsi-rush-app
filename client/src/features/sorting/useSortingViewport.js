import { useRef, useState } from "react";

import { MAX_SCALE, MIN_SCALE } from "./board";
import { createSortingViewportHandlers } from "./createSortingViewportHandlers";

// Manage board scale, translation, and pan state with their input handlers.
export function useSortingViewport() {
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panState = useRef({ panning: false, startX: 0, startY: 0, origX: 0, origY: 0 });

    const handlers = createSortingViewportHandlers({
        scaleLimits: { min: MIN_SCALE, max: MAX_SCALE },
        panState,
        translate,
        setScale,
        setTranslate,
    });

    return { scale, translate, ...handlers };
}
