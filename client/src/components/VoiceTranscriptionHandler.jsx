import VoiceRecorder from './VoiceRecorder';

const VoiceTranscriptionHandler = ({ 
    onTranscription, 
    questionKey, 
    currentValue = "",
    disabled = false 
}) => {
    const handleTranscription = (transcription) => {
        // Clean up the transcription text
        const cleanTranscription = transcription.trim();
        if (!cleanTranscription) return;
        
        // Determine how to append the transcription
        let newAnswer;
        if (currentValue.trim()) {
            // Add a space before appending if the current text doesn't end with whitespace
            const needsSpace = !/\s$/.test(currentValue);
            newAnswer = `${currentValue}${needsSpace ? ' ' : ''}${cleanTranscription}`;
        } else {
            newAnswer = cleanTranscription;
        }
        
        // Call the parent's transcription handler
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