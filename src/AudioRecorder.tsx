import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (base64: string, mimeType: string) => void;
  isProcessing: boolean;
  useNativeRecogniser?: boolean;
  onNativeText?: (text: string) => void;
}

export const AudioRecorder = ({ onRecordingComplete, isProcessing, useNativeRecogniser, onNativeText }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // Stop recording thoroughly on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    setError(null);

    // Modo 1: Reconocimiento nativo (Chrome)
    if (useNativeRecogniser) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError("Tu navegador no admite dictado nativo. Por favor usa Google Chrome.");
        return;
      }
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          let chunk = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              chunk += event.results[i][0].transcript + " ";
            }
          }
          if (chunk.trim() && onNativeText) {
            onNativeText(chunk.trim());
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            setError(`Error de voz: ${event.error}`);
            setIsRecording(false);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } catch (err) {
        setError("Hubo un fallo al iniciar el micrófono nativo.");
      }
      return;
    }

    // Modo 2: Grabación estándar (Gemini)
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
      setError("No pudimos acceder al micrófono. Por favor permite el acceso.");
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      if (useNativeRecogniser && recognitionRef.current) {
        recognitionRef.current.stop();
        setTimeout(() => {
          setIsRecording(false);
        }, 800);
      } else if (mediaRecorder.current) {
        mediaRecorder.current.stop();
        setIsRecording(false);
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      }
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
        <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-xl text-sm border border-red-100 animate-in fade-in slide-in-from-top-1 absolute -bottom-16">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-500 absolute -bottom-8 whitespace-nowrap">
          {isProcessing ? 'Procesando...' : isRecording ? 'Escuchando... Toca para enviar' : 'Toca para responder'}
        </p>
      )}
    </div>
  );
};
