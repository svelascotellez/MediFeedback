import { useState, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (base64: string, mimeType: string) => void;
  isProcessing: boolean;
}

export const AudioRecorder = ({ onRecordingComplete, isProcessing }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onRecordingComplete(base64String, 'audio/webm');
        };
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("No pudimos acceder al micrófono. Por favor, asegúrate de dar los permisos necesarios.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          isRecording 
            ? 'bg-red-500 animate-pulse shadow-lg shadow-red-200' 
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isProcessing ? (
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-10 h-10 text-white fill-current" />
        ) : (
          <Mic className="w-10 h-10 text-white" />
        )}
      </button>
      
      {error ? (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-xl text-sm border border-red-100 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-500">
          {isProcessing ? 'Procesando respuesta...' : isRecording ? 'Escuchando... Toca para detener' : 'Toca para responder'}
        </p>
      )}
    </div>
  );
};
