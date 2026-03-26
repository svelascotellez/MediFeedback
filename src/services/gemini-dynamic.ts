import { GoogleGenAI } from "@google/genai";
import { getAIProvider, callLMStudio } from "./gemini";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Función robusta para extraer texto de las respuestas de Gemini (v1.45.0)
 */
function safeExtractText(result: any): string {
  if (!result) return "";
  try {
    // 1. Intentar como getter o propiedad directa (común en @google/genai)
    if (typeof result.text === 'string') return result.text;
    if (result.response?.text && typeof result.response.text === 'function') return result.response.text();
    
    // 2. Intentar como función (común en @google/generative-ai)
    if (typeof result.text === 'function') return result.text();
    
    // 3. Acceso profundo a candidatos (estructura base de la API)
    const candidateText = result.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    if (candidateText) return candidateText;
    
    console.warn("No se pudo extraer texto de la respuesta de Gemini:", JSON.stringify(result).substring(0, 200));
  } catch (e) {
    console.error("Error al extraer texto de Gemini:", e);
  }
  return "";
}

interface DynamicStep {
  nextQuestion: string;
  isFinished: boolean;
  transcript?: string;
  suggestedSentiment: string;
  suggestedScore: number;
  error?: string;
}

/**
 * Genera la siguiente pregunta basada en el historial de la conversación.
 */
export async function getNextDynamicQuestion(
  history: { question: string, answer: string }[],
  patientName: string,
  audioBase64?: string
): Promise<DynamicStep> {
  const provider = getAIProvider();
  const context = history.map(h => `P: ${h.question}\nR: ${h.answer}`).join("\n\n");

  const prompt = `
    Eres un entrevistador médico experto y empático del IMSS (Instituto Mexicano del Seguro Social). 
    Tu objetivo es realizar una entrevista dinámica al paciente ${patientName}.

    GUION DE TEMAS OBLIGATORIOS (Pregúntalos uno por uno en este orden, pero profundiza si detectas quejas):
    1. ¿Bajo qué esquema se encuentra asegurado actualmente en el IMSS?
    2. ¿Cuál es el estado actual de su residencia?
    3. ¿Ha viajado a México específicamente para recibir atención médica en el IMSS?
    4. ¿Qué tipo de servicio utilizó en su última visita?
    5. ¿Cómo ha evolucionado la calidad de los servicios del IMSS en los últimos 3 años?
    6. ¿Qué cambios le gustaría ver en el IMSS?
    7. ¿Tiene algún comentario?

    REGLAS:
    - Comienza por el primer tema que no haya sido respondido.
    - Si el paciente menciona un problema (por ejemplo, en el servicio utilizado), DETENTE y haz preguntas de seguimiento para entender mejor el problema antes de pasar a la siguiente pregunta del guion.
    - Mantén un tono profesional y amable.
    - Si ya se cubrieron todos los puntos y no hay más temas por profundizar, marca isFinished: true.

    HISTORIAL DE LA CONVERSACIÓN:
    ${context || "Inicio."}

    RESPONDE ÚNICAMENTE EN FORMATO JSON:
    {
      "transcript": "transcripción si hubo audio",
      "nextQuestion": "tu pregunta (la siguiente del guion o una de seguimiento)",
      "isFinished": false,
      "suggestedSentiment": "Positivo|Neutral|Negativo",
      "suggestedScore": 1-5
    }
  `;

  let resultText = "";
  try {
    let transcriptFromAudio = "";
    
    // ... 
    if (audioBase64) {
      const transcriptionResult = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { inlineData: { data: audioBase64, mimeType: "audio/webm" } },
              { text: "Transcribe exactamente lo que dice el paciente." }
            ]
          }
        ]
      });
      transcriptFromAudio = safeExtractText(transcriptionResult);
      console.log("Audio transcrito:", transcriptFromAudio);
    }

    if (provider === 'lmstudio') {
      const finalPrompt = audioBase64 
        ? `${prompt}\n\nNueva respuesta del paciente (AUDIO TRANSCRITO): "${transcriptFromAudio}"`
        : prompt;
      
      resultText = await callLMStudio(finalPrompt, true);
    } else {
      const contents: any[] = [];
      if (audioBase64) {
        contents.push({ inlineData: { data: audioBase64, mimeType: "audio/webm" } });
      }
      contents.push({ text: prompt });

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: contents }]
      });
      resultText = safeExtractText(result);
    }

    let jsonToParse = resultText;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonToParse = jsonMatch[0];
    } else {
      console.warn("No JSON found in response, trying to parse raw text.");
    }

    const parsed = JSON.parse(jsonToParse);
    
    if (audioBase64 && !parsed.transcript) {
      parsed.transcript = transcriptFromAudio;
    }
    
    return parsed;
  } catch (error: any) {
    console.error("AI FAIL - Historial:", history.length, "Error:", error);
    
    // Lista de respaldo (guion original)
    const fallbackGuion = [
      "¿Bajo qué esquema se encuentra asegurado actualmente en el IMSS?",
      "¿Cuál es el estado actual de su residencia?",
      "¿Ha viajado a México específicamente para recibir atención médica en el IMSS?",
      "¿Qué tipo de servicio utilizó en su última visita?",
      "¿Cómo ha evolucionado la calidad de los servicios del IMSS en los últimos 3 años?",
      "¿Qué cambios le gustaría ver en el IMSS?",
      "¿Tiene algún comentario?"
    ];

    // Buscamos cuál es la siguiente pregunta del guion que no hemos hecho
    const nextFallbackIndex = history.length + 1;
    const fallbackQuestion = fallbackGuion[nextFallbackIndex] || "¿Tiene algún comentario final para cerrar la encuesta?";
    const isActuallyFinished = nextFallbackIndex >= fallbackGuion.length;

    // Si el error es de conexión grave, mostramos un aviso al desarrollador en consola
    if (error.message?.includes('Failed to fetch')) {
      console.error("LM Studio no responde en http://localhost:1234/v1. Revisa el puerto y CORS.");
    }

    return {
      nextQuestion: fallbackQuestion,
      isFinished: isActuallyFinished,
      suggestedSentiment: "Neutral",
      suggestedScore: 3,
      error: error.message || "Error de conexión con la IA"
    };
  }
}
