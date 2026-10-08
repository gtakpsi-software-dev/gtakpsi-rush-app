import type { ComponentProps, RefObject } from 'react';
import getCaretCoordinates from 'textarea-caret';

type TextareaProps = ComponentProps<'textarea'>;
type Cursor = { id: string; name?: string; cursor: number };

type CollaborativeTextareaViewProps = {
    textareaRef: RefObject<HTMLTextAreaElement>;
    colorMapRef: RefObject<Record<string, string>>;
    className?: string;
    placeholder?: string;
    localValue: string;
    disabled: boolean;
    isFieldLocked: boolean;
    isConnected: boolean;
    otherUserCursors: Cursor[];
    handleTextChange: NonNullable<TextareaProps['onChange']>;
    handleCursorChange: NonNullable<TextareaProps['onSelect']>;
    handleFocus: NonNullable<TextareaProps['onFocus']>;
    handleBlur: NonNullable<TextareaProps['onBlur']>;
    handleMouseDown: NonNullable<TextareaProps['onMouseDown']>;
    handleCompositionStart: NonNullable<TextareaProps['onCompositionStart']>;
    handleCompositionEnd: NonNullable<TextareaProps['onCompositionEnd']>;
};

// Generate a saturated random hue for a collaborator’s cursor.
const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 90%, 50%)`;

// Render the shared textarea, remote-owner overlay, offline state, and cursor markers.
export default function CollaborativeTextareaView({
    textareaRef, colorMapRef, className, placeholder, localValue,
    disabled, isFieldLocked, isConnected, otherUserCursors,
    handleTextChange, handleCursorChange, handleFocus, handleBlur,
    handleMouseDown, handleCompositionStart, handleCompositionEnd,
}: CollaborativeTextareaViewProps) {
    return (
        <div className="relative">
            <textarea
                ref={textareaRef}
                className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isFieldLocked ? 'cursor-not-allowed' : ''}`}
                placeholder={placeholder}
                value={localValue}
                onChange={handleTextChange}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onMouseDown={handleMouseDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                disabled={disabled}
            />

            {isFieldLocked && (
                <div className="absolute inset-0 bg-blue-50/30 border-2 border-blue-300 rounded-md pointer-events-none flex items-center justify-center">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                        {otherUserCursors[0]?.name || 'Another user'} is editing
                    </div>
                </div>
            )}

            {!isConnected && (
                <div className="absolute top-2 right-2 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Offline</span>
                </div>
            )}

            {otherUserCursors.map((user) => {
                // Position a remote cursor marker and reuse its assigned color.
                let leftOffset = 0;
                let topOffset = 0;
                if (textareaRef.current) {
                    const coords = getCaretCoordinates(textareaRef.current, user.cursor);
                    leftOffset = coords.left;
                    topOffset = coords.top;
                }

                // Keep each collaborator's cursor color stable across renders in this field.
                if (!colorMapRef.current[user.id]) {
                    colorMapRef.current[user.id] = getRandomColor();
                }
                const colorStyle = colorMapRef.current[user.id];

                return (
                    <div
                        key={user.id}
                        className="absolute pointer-events-none z-10"
                        style={{
                            left: `${leftOffset}px`,
                            top: `${topOffset}px`,
                        }}
                    >
                        <div className="w-0.5 h-5 animate-pulse" style={{ backgroundColor: colorStyle }} />
                    </div>
                );
            })}
        </div>
    );
}
