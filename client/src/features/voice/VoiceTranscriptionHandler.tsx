import VoiceRecorder from './VoiceRecorder';

type Props = {
    onTranscription: (value: string) => void;
    // Keep accepting this legacy prop while existing callers still pass it.
    questionKey?: string;
    currentValue?: string;
    disabled?: boolean;
};

const VoiceTranscriptionHandler = ({
    onTranscription,
    currentValue = "",
    disabled = false,
}: Props) => {
    const handleTranscription = (transcription: string) => {
        const cleanTranscription = transcription.trim();
        if (!cleanTranscription) return;

        let newAnswer;
        if (currentValue.trim()) {
            // Append without a second space when the existing answer already ends in whitespace.
            const needsSpace = !/\s$/.test(currentValue);
            newAnswer = `${currentValue}${needsSpace ? ' ' : ''}${cleanTranscription}`;
        } else {
            newAnswer = cleanTranscription;
        }

        onTranscription(newAnswer);
    };

    return (
        <div className="flex-shrink-0">
            <VoiceRecorder 
                onTranscription={handleTranscription}
                disabled={disabled}
            />
            {disabled && (
                <div className="text-xs text-gray-500 mt-1 text-center">
                    Voice disabled<br/>during collab
                </div>
            )}
        </div>
    );
};

export default VoiceTranscriptionHandler;
