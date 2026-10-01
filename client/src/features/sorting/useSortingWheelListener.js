import { useEffect } from 'react';

export function useSortingWheelListener(canvasRef, handleWheel, loading) {
    // Keep listener replacement tied to loading, as it was in each sorting page.
    // Adding the changing handler would rebind the listener on more renders.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- Rebinding on handler changes would alter the existing loading-only lifecycle.
    }, [loading]);
}
