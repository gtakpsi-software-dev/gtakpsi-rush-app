import { useState, useRef, useCallback } from 'react';
import { requestTranscription } from './requestTranscription';

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      chunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording. Please check microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
          
          // Stop all tracks to release microphone
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
          
          setIsRecording(false);
          resolve(audioBlob);
        };

        mediaRecorderRef.current.stop();
      } else {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [isRecording]);

  const transcribeAudio = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    
    try {
      // Vite exposes this key to browsers; it must not be treated as a secret credential.
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      return await requestTranscription(audioBlob, apiKey);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const recordAndTranscribe = useCallback(async () => {
    await startRecording();

    return new Promise((resolve, reject) => {
      const handleStop = async () => {
        try {
          const audioBlob = await stopRecording();
          if (audioBlob) {
            const transcription = await transcribeAudio(audioBlob);
            resolve(transcription);
          } else {
            resolve('');
          }
        } catch (error) {
          reject(error);
        }
      };

      // External recorder controls call this handler to settle the pending promise.
      window._stopRecordingHandler = handleStop;
    });
  }, [startRecording, stopRecording, transcribeAudio]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    transcribeAudio,
    recordAndTranscribe,
  };
};
