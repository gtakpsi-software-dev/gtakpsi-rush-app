import { useState } from 'react';
import { useVoiceRecording } from './useVoiceRecording';

type Props = {
  onTranscription?: (value: string) => void;
  disabled?: boolean;
};

/**
 * Voice Recorder Summary:
 * - Types the optional transcription callback and disabled flag.
 * - Keeps recording, processing, error, and button presentation unchanged.
 */
const VoiceRecorder = ({ onTranscription, disabled = false }: Props) => {
  const { isRecording, isProcessing, startRecording, stopRecording, transcribeAudio } = useVoiceRecording();
  const [error, setError] = useState('');

  const handleToggleRecording = async () => {
    try {
      setError('');

      if (isRecording) {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          const transcription = await transcribeAudio(audioBlob);
          if (onTranscription) {
            onTranscription(transcription);
          }
        }
      } else {
        await startRecording();
      }
    } catch (error) {
      console.error('Recording error:', error);
      setError(error.message);
    }
  };

  const getButtonContent = () => {
    if (isProcessing) {
      return (
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-b-transparent"></div>
      );
    }

    if (isRecording) {
      return (
        <div className="w-4 h-4 bg-white rounded-sm"></div>
      );
    }

    return (
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const getButtonClass = () => {
    const baseClass = "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 text-white font-medium text-sm";

    if (disabled || isProcessing) {
      return `${baseClass} bg-gray-500 cursor-not-allowed opacity-50`;
    }

    if (isRecording) {
      return `${baseClass} bg-red-500 hover:bg-red-600 shadow-lg animate-pulse`;
    }

    return `${baseClass} bg-black hover:bg-apple-gray-800 shadow-md hover:shadow-lg`;
  };

  return (
    <div className="flex flex-col items-center space-y-1">
      <button
        onClick={handleToggleRecording}
        disabled={disabled || isProcessing}
        className={getButtonClass()}
        title={isRecording ? "Stop recording" : "Start voice recording"}
      >
        {getButtonContent()}
      </button>

      {error && (
        <div className="text-red-400 text-xs max-w-xs text-center bg-red-900/20 px-2 py-1 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
