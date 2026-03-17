import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioRecorder } from './AudioRecorder';
import { transcribeAndAnalyze, analyzeOverallSession, analyzeText, getAIProvider } from '../services/gemini';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, User, AlertCircle, Loader2, Mic, MicOff } from 'lucide-react';

const QUESTIONS = [
  { id: 'q1', text: '¿Cómo calificaría la atención recibida por el personal médico?' },
  { id: 'q2', text: '¿Qué le pareció el tiempo de espera antes de su consulta?' },
  { id: 'q3', text: '¿Las instalaciones le parecieron limpias y adecuadas?' },
  { id: 'q4', text: '¿Tiene algún comentario adicional o sugerencia para mejorar nuestro servicio?' }
];

export const SurveyFlow = () => {
  const [step, setStep] = useState<'intro' | 'questions' | 'finished'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [patientName, setPatientName] = useState('');
  const [responses, setResponses] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Lógica para reconocimiento de voz nativo del navegador (Web Speech API)
  const startLocalSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setGlobalError("Tu navegador no soporta reconocimiento de voz local. Por favor usa el modo texto o Gemini.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsProcessing(true);
      try {
        const analysis = await analyzeText(transcript);
        processResponse(transcript, analysis);
      } catch (error: any) {
        setGlobalError(error.message);
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      setGlobalError(`Error de voz: ${event.error}`);
    };

    recognition.start();
  };

  const handleStart = () => {
    if (patientName.trim()) {
      setStep('questions');
    }
  };

  const processResponse = (transcript: string, analysis: any) => {
    const question = QUESTIONS[currentQuestionIndex];
    const newResponse = {
      questionId: question.id,
      questionText: question.text,
      transcript,
      ...analysis
    };

    const updatedResponses = [...responses, newResponse];
    setResponses(updatedResponses);
    setTextInput('');

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishSurvey(updatedResponses);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim() || isProcessing) return;
    setIsProcessing(true);
    setGlobalError(null);
    try {
      const analysis = await analyzeText(textInput);
      processResponse(textInput, analysis);
    } catch (error: any) {
      setGlobalError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingComplete = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setGlobalError(null);
    try {
      const question = QUESTIONS[currentQuestionIndex];
      const analysis = await transcribeAndAnalyze(base64, mimeType, question.text);
      processResponse(analysis.transcript, { sentiment: analysis.sentiment, score: analysis.score });
    } catch (error: any) {
      console.error("Error processing response:", error);
      setGlobalError(error.message || "Error al procesar la respuesta. Verifica tu conexión.");
    } finally {
      setIsProcessing(false);
    }
  };

  const finishSurvey = async (finalResponses: any[]) => {
    setIsProcessing(true);
    setGlobalError(null);
    try {
      let overall: any = { 
        insights: 'El análisis automático no se pudo completar en este momento.' 
      };

      try {
        const transcripts = finalResponses.map(r => r.transcript);
        const result = await analyzeOverallSession(transcripts);
        overall = result;
      } catch (analysisError) {
        console.warn("Could not generate overall analysis, saving survey with partial data:", analysisError);
      }

      const surveyData = {
        patientName,
        timestamp: serverTimestamp(),
        responses: finalResponses,
        ...overall,
        status: 'completed'
      };

      await addDoc(collection(db, 'surveys'), surveyData);
      setStep('finished');
    } catch (error: any) {
      console.error("Error saving survey:", error);
      // Si falla el guardado final, informamos al usuario
      setGlobalError("Error al guardar la encuesta en la base de datos. Por favor, intente enviarla de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Encuesta de Satisfacción</h2>
            <p className="text-slate-600 mb-8">Ayúdenos a mejorar nuestro servicio respondiendo unas breves preguntas con su voz.</p>
            
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Nombre del Paciente</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Ingrese su nombre"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <button
                onClick={handleStart}
                disabled={!patientName.trim()}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
              >
                Comenzar Encuesta
              </button>
            </div>
          </motion.div>
        )}

        {step === 'questions' && (
          <motion.div
            key="questions"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center"
          >
            <div className="mb-8">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full">
                Pregunta {currentQuestionIndex + 1} de {QUESTIONS.length}
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-4 leading-tight">
                {QUESTIONS[currentQuestionIndex].text}
              </h3>
            </div>

            <div className="flex justify-center gap-4 mb-8">
              <button 
                onClick={() => setInputMode('voice')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${inputMode === 'voice' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Voz
              </button>
              <button 
                onClick={() => setInputMode('text')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${inputMode === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Texto
              </button>
            </div>

            {inputMode === 'voice' ? (
              getAIProvider() === 'lmstudio' ? (
                <div className="flex flex-col items-center gap-6">
                  <button
                    onClick={startLocalSpeechRecognition}
                    disabled={isProcessing || isListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                      isListening 
                        ? 'bg-red-500 shadow-lg shadow-red-200 animate-pulse' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                    } disabled:opacity-50`}
                  >
                    {isListening ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
                  </button>
                  <p className="text-sm font-medium text-slate-500">
                    {isListening ? "Escuchando..." : "Haz clic para dictar tu respuesta localmente"}
                  </p>
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-indigo-600 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analizando con LM Studio...
                    </div>
                  )}
                </div>
              ) : (
                <AudioRecorder 
                  onRecordingComplete={handleRecordingComplete} 
                  isProcessing={isProcessing}
                />
              )
            ) : (
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Escriba su respuesta aquí..."
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none text-slate-700"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isProcessing}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Siguiente'}
                </button>
              </div>
            )}

            {globalError && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-left font-medium">{globalError}</p>
              </div>
            )}

            <div className="mt-12 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex) / QUESTIONS.length) * 100}%` }}
              />
            </div>
          </motion.div>
        )}

        {step === 'finished' && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-10 shadow-xl border border-slate-100 text-center"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">¡Muchas Gracias!</h2>
            <p className="text-slate-600 mb-8">Sus respuestas han sido registradas y nos ayudarán a brindarle una mejor atención.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-indigo-600 font-bold hover:text-indigo-700"
            >
              Finalizar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
