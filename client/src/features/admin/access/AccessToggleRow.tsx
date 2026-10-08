import type { ReactNode } from 'react';

type AccessToggleRowProps = {
    label: string;
    description: ReactNode;
    enabled: boolean;
    disabled: boolean;
    onClick: () => void;
};

// Render a labeled settings toggle with its enabled and disabled states.
export default function AccessToggleRow({
    label, description, enabled, disabled, onClick,
}: AccessToggleRowProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="text-apple-body font-normal text-black">{label}</div>
                <div className="text-apple-caption2 text-apple-gray-500">{description}</div>
            </div>
            <button
                onClick={onClick}
                disabled={disabled}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                    enabled ? 'bg-black' : 'bg-apple-gray-300'
                } ${disabled ? 'opacity-50' : ''}`}
            >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                    enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
            </button>
        </div>
    );
}
