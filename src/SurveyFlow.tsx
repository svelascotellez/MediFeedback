import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, User, AlertCircle, Loader2, Mic, MicOff } from 'lucide-react';
import { db, initAnonymousAuth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getNextDynamicQuestion } from './services/gemini-dynamic';
import { analyzeOverallSession, getAIProvider } from './services/gemini';
import { AudioRecorder } from './AudioRecorder'; // assuming flattened

export const SurveyFlow = () => {
  const [step, setStep] = useState(0); // 0: Name, 1: Questions, 2: Finished
  const [patientName, setPatientName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('¿Bajo qué esquema se encuentra asegurado actualmente en el IMSS?');
  const [history, setHistory] = useState<{ question: string, answer: string, sentiment?: string, score?: number }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    initAnonymousAuth();
  }, []);

  const startSurvey = () => {
    if (!patientName.trim()) {
      setError('Por favor ingrese un nombre');
      return;
    }
    setError(null);
    setStep(1);
  };

  const handleAudioAnswer = async (base64: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getNextDynamicQuestion(history, patientName, base64);
      
      if (result.error) {
        setWarning(`⚠️ IA local (LM Studio) desconectada. Usando guion de respaldo.`);
      } else {
        setWarning(null);
      }

      const newHistory = [...history, { 
        question: currentQuestion, 
        answer: result.transcript || "(Audio)",
        sentiment: result.suggestedSentiment,
        score: result.suggestedScore
      }];
      setHistory(newHistory);
      
      if (result.isFinished || newHistory.length >= 10) {
        await finishSurvey(newHistory);
      } else {
        setCurrentQuestion(result.nextQuestion);
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Error al procesar el audio.');
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (!currentAnswer.trim()) {
      setError('Por favor proporcione una respuesta');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Necesitamos una historia temporal con la respuesta actual para que la IA la analice
      const tempHistory = [...history, { question: currentQuestion, answer: currentAnswer }];
      const result = await getNextDynamicQuestion(tempHistory, patientName);

      if (result.error) {
        setWarning(`⚠️ IA local (LM Studio) desconectada. Usando guion de respaldo.`);
      } else {
        setWarning(null);
      }

      const newHistory = [...history, { 
        question: currentQuestion, 
        answer: currentAnswer,
        sentiment: result.suggestedSentiment,
        score: result.suggestedScore
      }];
      setHistory(newHistory);
      setCurrentAnswer('');

      if (result.isFinished || newHistory.length >= 10) {
        await finishSurvey(newHistory);
      } else {
        setCurrentQuestion(result.nextQuestion);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Hubo un error al generar la siguiente pregunta.');
      setIsLoading(false);
    }
  };

  const finishSurvey = async (finalHistory: any[]) => {
    setIsLoading(true);
    try {
      // Intentar obtener un análisis de toda la sesión
      console.log("Generando análisis final para", finalHistory.length, "respuestas...");
      let overall = { overallSentiment: 'Neutral', overallScore: 3, insights: 'Análisis IA no disponible.' };
      try {
        const transcripts = finalHistory.map(h => h.answer).filter(t => t && t !== "(Audio)");
        if (transcripts.length > 0) {
          const analysis = await analyzeOverallSession(transcripts);
          overall = analysis;
          console.log("Análisis final completado con éxito.");
        } else {
          overall.insights = "No se proporcionaron respuestas de texto para analizar.";
        }
      } catch (err) {
        console.error("Error crítico al analizar sesión completa:", err);
        overall.insights = "Error de conexión con IA al generar resumen final.";
      }

      const docRef = await addDoc(collection(db, 'surveys'), {
        patientName,
        responses: finalHistory.map(h => ({
          questionText: h.question,
          transcript: h.answer,
          sentiment: h.sentiment || 'Neutral',
          score: h.score || 3
        })),
        timestamp: serverTimestamp(),
        status: 'completed',
        overallSentiment: overall.overallSentiment, 
        overallScore: overall.overallScore,
        type: 'dynamic',
        insights: overall.insights
      });
      console.log("Encuesta guardada con éxito. ID:", docRef.id);
      setStep(2);
    } catch (err: any) {
      console.error("ERROR FATAL AL GUARDAR EN FIRESTORE:", err);
      setError(`Error de base de datos: ${err.message}. Revisa la consola y las reglas de seguridad.`);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <User className="text-indigo-600 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Bienvenido a MediFeedback Dynamic</h2>
          <p className="text-slate-500 text-center mb-8 text-sm">Entrevista de satisfacción del paciente generada por IA en tiempo real.</p>
          
          <div className="space-y-4">
            <div className="relative group">
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nombre del Paciente" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none pl-12" />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm font-medium"><AlertCircle className="w-4 h-4" />{error}</motion.div>}
            <button onClick={startSurvey} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Iniciar Entrevista</button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto p-4 py-12">
        <div className="mb-10 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">{history.length + 1}</div>
              <p className="text-slate-500 text-sm font-bold tracking-wider uppercase">Pregunta Dinámica {history.length + 1}</p>
            </div>
        </div>

        <motion.div key={history.length} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="text-2xl font-bold text-slate-900 mb-8 leading-tight">{currentQuestion}</h3>
          
          <div className="space-y-6">
            <div className="relative group">
              <textarea 
                value={currentAnswer} 
                onChange={(e) => setCurrentAnswer(e.target.value)} 
                placeholder="Escriba o use voz para su respuesta..."
                className="w-full h-40 px-6 py-5 bg-white border-2 border-slate-100 rounded-3xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all shadow-sm text-lg resize-none pr-14"
              />
              <div className="absolute top-4 right-4">
                <AudioRecorder 
                  onRecordingComplete={(base64) => handleAudioAnswer(base64)} 
                  isProcessing={isLoading} 
                  useNativeRecogniser={getAIProvider() === 'lmstudio'}
                  onNativeText={(text) => setCurrentAnswer(prev => prev ? prev + ' ' + text : text)}
                />
              </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl font-medium text-sm border border-red-100 flex items-center gap-3"><AlertCircle className="w-5 h-5" />{error}</div>}

            {warning && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-amber-50 text-amber-800 rounded-2xl font-medium text-sm border border-amber-200 flex items-start gap-4 shadow-sm"
              >
                <div className="mt-1 flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold mb-1 leading-tight">{warning}</p>
                  <p className="text-xs text-amber-700/80 leading-relaxed italic border-t border-amber-200/50 mt-2 pt-1 mb-3">
                    Error técnico detectado: El servidor LM Studio no respondió (probablemente apagado o sin CORS habilitado).
                  </p>
                  <button 
                    onClick={() => { setWarning(null); handleNext(); }}
                    className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-2"
                  >
                    <Loader2 className="w-3 h-3" /> Reintentar Conexión
                  </button>
                </div>
              </motion.div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button onClick={handleNext} disabled={isLoading} className="ml-auto flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : 'Siguiente'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-slate-100">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-8 mx-auto">
          <CheckCircle2 className="text-emerald-500 w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">¡Muchas Gracias!</h2>
        <p className="text-slate-500 mb-10 leading-relaxed text-lg font-medium">Su retroalimentación dinámica ha sido guardada. El personal administrativo analizará sus respuestas.</p>
        <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold shadow-xl hover:bg-slate-800 transition-all">Nueva Encuesta</button>
      </motion.div>
    </div>
  );
};
