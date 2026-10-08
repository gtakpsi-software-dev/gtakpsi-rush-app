import { FaExclamationTriangle, FaUser, FaComment } from 'react-icons/fa';

export type CommentWarningItem = { type: string; message: string };

type Props = {
    warnings?: CommentWarningItem[] | null;
    onDismiss?: (index: number) => void;
};

// Display validation warnings with optional dismissal controls.
const CommentWarning = ({ warnings, onDismiss }: Props) => {
    if (!warnings || warnings.length === 0) {
        return null;
    }

    // Choose the icon for a speculative-language, name, or general warning.
    const getIcon = (type: string) => {
        switch (type) {
            case 'speculative':
                return <FaComment className="text-yellow-600" />;
            case 'name':
                return <FaUser className="text-red-600" />;
            default:
                return <FaExclamationTriangle className="text-orange-600" />;
        }
    };

    // Choose border and background colors for the warning type.
    const getWarningClass = (type: string) => {
        switch (type) {
            case 'speculative':
                return 'border-yellow-200 bg-yellow-50';
            case 'name':
                return 'border-red-200 bg-red-50';
            default:
                return 'border-orange-200 bg-orange-50';
        }
    };

    return (
        <div className="mb-4 space-y-2">
            {warnings.map(/* Render one validation warning and its optional dismiss button. */ (warning, index) => (
                <div
                    key={index}
                    className={`flex items-start p-4 rounded-apple border ${getWarningClass(warning.type)}`}
                >
                    <div className="flex-shrink-0 mr-3 mt-0.5">
                        {getIcon(warning.type)}
                    </div>
                    <div className="flex-1">
                        <p className="text-apple-footnote text-black font-light">
                            {warning.message}
                        </p>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={/* Dismiss the warning at this index. */ () => onDismiss(index)}
                            className="flex-shrink-0 ml-2 text-apple-gray-600 hover:text-black text-lg font-light"
                        >
                            ×
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CommentWarning;
