import type { ComponentProps, RefObject } from 'react';

type InputProps = ComponentProps<'input'>;

type CollaborativeInputViewProps = {
    inputRef: RefObject<HTMLInputElement>;
    className?: string;
    placeholder?: string;
    localValue: string;
    disabled: boolean;
    required: boolean;
    isFieldLocked: boolean;
    lockedByUser: string | null;
    handleTextChange: NonNullable<InputProps['onChange']>;
    handleCursorChange: NonNullable<InputProps['onSelect']>;
    handleFocus: NonNullable<InputProps['onFocus']>;
    handleBlur: NonNullable<InputProps['onBlur']>;
    handleMouseDown: NonNullable<InputProps['onMouseDown']>;
};

// Render a collaborative input and its remote-owner typing overlay.
export default function CollaborativeInputView({
    inputRef, className, placeholder, localValue, disabled, required,
    isFieldLocked, lockedByUser, handleTextChange, handleCursorChange,
    handleFocus, handleBlur, handleMouseDown,
}: CollaborativeInputViewProps) {
    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isFieldLocked ? 'cursor-not-allowed bg-blue-50' : ''}`}
                placeholder={placeholder}
                value={localValue}
                onChange={handleTextChange}
                onSelect={handleCursorChange}
                onClick={handleCursorChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onMouseDown={handleMouseDown}
                disabled={disabled}
                required={required}
            />

            {isFieldLocked && (
                <div className="absolute inset-0 bg-blue-50/50 border-2 border-blue-300 rounded-apple pointer-events-none flex items-center justify-center">
                    <div className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium shadow-sm whitespace-nowrap">
                        {lockedByUser} is typing
                    </div>
                </div>
            )}
        </div>
    );
}
