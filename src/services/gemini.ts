import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  transcript: string;
  sentiment: 'Muy positivo' | 'Positivo' | 'Neutral' | 'Negativo' | 'Muy negativo';
  score: number;
}

export const transcribeAndAnalyze = async (audioBase64: string, mimeType: string, question: string): Promise<AnalysisResult> => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Transcribe la respuesta de audio a esta pregunta: "${question}". 
            Luego analiza el sentimiento (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo) y proporciona un puntaje de satisfacción del 1 al 5.
            La transcripción y el análisis deben estar en ESPAÑOL.
            Retorna el resultado en formato JSON.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcript: { type: Type.STRING },
          sentiment: { type: Type.STRING, enum: ["Muy positivo", "Positivo", "Neutral", "Negativo", "Muy negativo"] },
          score: { type: Type.NUMBER },
        },
        required: ["transcript", "sentiment", "score"],
      },
    },
  });

  const response = await model;
  return JSON.parse(response.text || "{}");
};

export const analyzeOverallSession = async (transcripts: string[]): Promise<{ overallSentiment: string; overallScore: number; insights: string }> => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analiza estas respuestas de la encuesta de pacientes y proporciona un sentimiento general (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo), un puntaje de satisfacción general (1-5) y un resumen breve de insights.
    Tanto el sentimiento como los insights deben estar en ESPAÑOL.
    Respuestas: ${JSON.stringify(transcripts)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallSentiment: { type: Type.STRING, enum: ["Muy positivo", "Positivo", "Neutral", "Negativo", "Muy negativo"] },
          overallScore: { type: Type.NUMBER },
          insights: { type: Type.STRING },
        },
        required: ["overallSentiment", "overallScore", "insights"],
      },
    },
  });

  const response = await model;
  return JSON.parse(response.text || "{}");
};
