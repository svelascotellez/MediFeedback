import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type AIProvider = 'gemini' | 'lmstudio';

export const getAIProvider = (): AIProvider => {
  return (localStorage.getItem('ai_provider') as AIProvider) || 'gemini';
};

export const setAIProvider = (provider: AIProvider) => {
  localStorage.setItem('ai_provider', provider);
};

export interface AnalysisResult {
  transcript: string;
  sentiment: 'Muy positivo' | 'Positivo' | 'Neutral' | 'Negativo' | 'Muy negativo';
  score: number;
}

const callLMStudio = async (prompt: string, schema?: any) => {
  const url = `${process.env.LM_STUDIO_URL}/chat/completions`;
  
  // Algunos modelos locales fallan con el parámetro 'response_format' si no están optimizados.
  // Vamos a enviarlo de forma más sencilla.
  const body: any = {
    model: "", // LM Studio usará el modelo cargado actualmente si se deja vacío o "model-identifier"
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    stream: false
  };

  // Solo agregamos el formato JSON si el modelo lo soporta, 
  // pero para evitar el error 400 en modelos que no lo entienden, vamos a omitirlo por ahora 
  // y confiar en que el prompt sea lo suficientemente claro para JSON.parse.
  // body.response_format = schema ? { type: "json_object" } : undefined;

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
    
    // Limpieza básica por si el modelo devuelve markdown (bloques de código)
    if (schema) {
      content = content.replace(/```json|```/g, '').trim();
    }
    
    return content;
  } catch (error: any) {
    console.error("LM Studio Error:", error);
    const isCors = error.message?.includes('Failed to fetch') || error.name === 'TypeError';
    const message = isCors 
      ? "Error de conexión o CORS. Asegúrate de habilitar 'Cross-Origin Resource Sharing (CORS)' en la configuración de LM Studio."
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
    return JSON.parse(lmResponse);
  }

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentiment: { type: Type.STRING, enum: ["Muy positivo", "Positivo", "Neutral", "Negativo", "Muy negativo"] },
          score: { type: Type.NUMBER },
        },
        required: ["sentiment", "score"],
      },
    },
  });

  return JSON.parse(result.text || "{}");
};

export const transcribeAndAnalyze = async (audioBase64: string, mimeType: string, question: string): Promise<AnalysisResult> => {
  const provider = getAIProvider();

  // Si usamos Gemini, hacemos TODO en una sola llamada para ahorrar cuota (1 request en lugar de 2)
  if (provider === 'gemini') {
    const model = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: audioBase64, mimeType: mimeType } },
            { 
              text: `Transcribe la respuesta de audio a esta pregunta: "${question}". 
              Luego analiza el sentimiento (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo) y proporciona un puntaje de satisfacción del 1 al 5.
              Responde ÚNICAMENTE en formato JSON con las llaves: "transcript", "sentiment", "score".` 
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

    const result = await model;
    return JSON.parse(result.text || "{}");
  }

  // Si usamos LM Studio, Gemini SOLO hace la transcripción
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: audioBase64, mimeType: mimeType } },
          { text: `Transcribe EXACTAMENTE lo que dice el paciente en respuesta a: "${question}". No agregues análisis.` },
        ],
      },
    ],
  });

  const transcriptionResponse = await model;
  const transcript = transcriptionResponse.text || "";

  const analysisPrompt = `Analiza esta respuesta clínica: "${transcript}". 
  Proporciona el sentimiento (Muy positivo, Positivo, Neutral, Negativo, o Muy negativo) y un puntaje de satisfacción del 1 al 5.
  Responde ÚNICAMENTE en formato JSON con estas llaves: "sentiment", "score".`;
  
  const lmResponse = await callLMStudio(analysisPrompt, true);
  const analysis = JSON.parse(lmResponse);
  
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
      return JSON.parse(response);
    } catch (e) {
      console.error("Error parseando resumen de LM Studio:", response);
      throw new Error("LM Studio devolvió un formato de resumen inválido.");
    }
  }

  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
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
