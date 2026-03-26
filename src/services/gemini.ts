import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

/**
 * Función robusta para extraer texto de las respuestas de Gemini (v1.45.0)
 */
function safeExtractText(result: any): string {
  if (!result) return "";
  try {
    if (typeof result.text === 'string') return result.text;
    if (result.response?.text && typeof result.response.text === 'function') return result.response.text();
    if (typeof result.text === 'function') return result.text();
    const candidateText = result.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (candidateText) return candidateText;
  } catch (e) {
    console.error("Error al extraer texto de Gemini:", e);
  }
  return "";
}

export type AIProvider = 'gemini' | 'lmstudio';

export const getAIProvider = (): AIProvider => {
  return (localStorage.getItem('ai_provider') as AIProvider) || 'lmstudio';
};

export const setAIProvider = (provider: AIProvider) => {
  localStorage.setItem('ai_provider', provider);
};

export interface AnalysisResult {
  transcript: string;
  sentiment: 'Muy positivo' | 'Positivo' | 'Neutral' | 'Negativo' | 'Muy negativo';
  score: number;
}

export const callLMStudio = async (prompt: string, schema?: any) => {
  const url = '/api-lmstudio/v1/chat/completions';
  
  const body: any = {
    model: "model-identifier", 
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    stream: false
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`LM Studio respondió con status: ${response.status}. ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    if (schema) {
      content = content.replace(/```json|```/g, '').trim();
    }
    
    return content;
  } catch (error: any) {
    console.error(`LM Studio connection error at ${url}:`, error);
    const isCors = error.message?.includes('Failed to fetch') || error.name === 'TypeError';
    const message = isCors 
      ? `Error de conexión en ${url}. Verifica que LM Studio tenga el servidor activo y CORS habilitado.`
      : error.message;
    throw new Error(`LM Studio: ${message}`);
  }
};

export const analyzeText = async (text: string): Promise<Omit<AnalysisResult, 'transcript'>> => {
  const provider = getAIProvider();
  const prompt = `Analiza esta respuesta clínica: "${text}". 
  Proporciona el sentimiento (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo) y un puntaje de satisfacción del 1 al 5.
  Responde ÚNICAMENTE en formato JSON con estas llaves: "sentiment", "score".`;

  if (provider === 'lmstudio') {
    const lmResponse = await callLMStudio(prompt, true);
    try {
      const jsonMatch = lmResponse.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : lmResponse);
    } catch (e) {
      console.warn("Error parseando sentimiento de LM Studio, usando Neutral.");
      return { sentiment: 'Neutral', score: 3 };
    }
  }

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });
  const responseText = safeExtractText(result);
  return JSON.parse(responseText || "{}");
};

export const transcribeAndAnalyze = async (audioBase64: string, mimeType: string, question: string): Promise<AnalysisResult> => {
  const provider = getAIProvider();

  // Siempre necesitamos a Gemini para la transcripción inicial si recibimos audio
  const transcriptionResult = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: audioBase64, mimeType: mimeType } },
          { text: `Transcribe exactamente lo que dice el paciente en respuesta a: "${question}". No agregues análisis.` }
        ]
      }
    ]
  });
  const transcript = safeExtractText(transcriptionResult);

  const analysisPrompt = `Analiza esta respuesta clínica: "${transcript}". 
  Proporciona el sentimiento (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo) y un puntaje de satisfacción del 1 al 5.
  Responde ÚNICAMENTE en formato JSON con estas llaves: "sentiment", "score".`;
  
  if (provider === 'lmstudio') {
    const lmResponse = await callLMStudio(analysisPrompt, true);
    try {
      const jsonMatch = lmResponse.match(/\{[\s\S]*\}/);
      const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : lmResponse);
      return { transcript, ...analysis };
    } catch (e) {
      return { transcript, sentiment: 'Neutral', score: 3 };
    }
  }

  const analysisResult = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: analysisPrompt
  });
  const anaText = safeExtractText(analysisResult);
  const analysis = JSON.parse(anaText || "{}");
  
  return { transcript, ...analysis };
};

export const analyzeOverallSession = async (transcripts: string[]): Promise<{ overallSentiment: string; overallScore: number; insights: string }> => {
  const provider = getAIProvider();
  const prompt = `Analiza estas respuestas de pacientes:
  ${JSON.stringify(transcripts)}

  Proporciona un resumen en ESPAÑOL y en formato JSON con esta estructura exacta:
  {
    "overallSentiment": "Muy positivo | Positivo | Neutral | Negativo | Muy negativo",
    "overallScore": 1-5,
    "insights": "Breve resumen de los puntos clave"
  }
  Responde ÚNICAMENTE el objeto JSON.`;

  if (provider === 'lmstudio') {
    const response = await callLMStudio(prompt, true);
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch (e) {
      console.error("LM Studio falló al generar análisis final:", e);
      throw e; // Propagar para que SurveyFlow use el fallback con log
    }
  }

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });
  const resText = safeExtractText(result);
  return JSON.parse(resText || "{}");
};
