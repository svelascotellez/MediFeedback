import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioRecorder } from './AudioRecorder';
import { transcribeAndAnalyze, analyzeOverallSession } from '../services/gemini';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, User, AlertCircle } from 'lucide-react';

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

  const handleStart = () => {
    if (patientName.trim()) {
      setStep('questions');
    }
  };

  const handleRecordingComplete = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    try {
      const question = QUESTIONS[currentQuestionIndex];
      const analysis = await transcribeAndAnalyze(base64, mimeType, question.text);
      
      const newResponse = {
        questionId: question.id,
        questionText: question.text,
        ...analysis
      };

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);

      if (currentQuestionIndex < QUESTIONS.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        await finishSurvey(updatedResponses);
      }
    } catch (error) {
      console.error("Error processing response:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const finishSurvey = async (finalResponses: any[]) => {
    try {
      const transcripts = finalResponses.map(r => r.transcript);
      const overall = await analyzeOverallSession(transcripts);

      const surveyData = {
        patientName,
        timestamp: serverTimestamp(),
        responses: finalResponses,
        ...overall,
        status: 'completed'
      };

      try {
        await addDoc(collection(db, 'surveys'), surveyData);
        setStep('finished');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'surveys');
      }
    } catch (error) {
      console.error("Error saving survey:", error);
      throw error; // Let ErrorBoundary handle it or show local error
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

            <AudioRecorder 
              onRecordingComplete={handleRecordingComplete} 
              isProcessing={isProcessing}
            />

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
