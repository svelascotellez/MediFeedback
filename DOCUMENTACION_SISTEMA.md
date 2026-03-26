# Documentación del Proyecto MediFeedback

Este documento detalla la arquitectura y el funcionamiento de las dos versiones del sistema MediFeedback: la versión **Estándar** y la versión **Dinámica**.

---

## 🏗️ Arquitectura del Sistema

El proyecto se divide en dos aplicaciones independientes que comparten la misma base de datos Firebase pero ofrecen experiencias de usuario distintas.

### 1. MediFeedback (Versión Estándar)
*   **Directorio:** `/MediFeedback`
*   **Puerto:** `3001` (o 3000 según disponibilidad)
*   **Lógica:** Basada en un cuestionario de 6 preguntas fijas predefinidas.
*   **Análisis:** Utiliza IA (Gemini o LM Studio) para analizar el sentimiento y puntaje *después* de que el paciente responde cada pregunta.

### 2. MediFeedback-Dynamic (Versión Dinámica)
*   **Directorio:** `/MediFeedback-Dynamic`
*   **Puerto:** `3002`
*   **Lógica:** Basada en una "Entrevista Inteligente". Sigue un guion de **7 preguntas obligatorias**, pero tiene la capacidad de desviarse para profundizar en quejas o comentarios específicos.
*   **Guion Base:**
    1. Esquema de aseguramiento en el IMSS.
    2. Estado de residencia.
    3. Turismo médico (viaje para atención).
    4. Tipo de servicio utilizado.
    5. Evolución de la calidad (últimos 3 años).
    6. Cambios o mejoras deseadas.
    7. Comentario final.
*   **Cerebro:** La IA (`gemini-dynamic.ts`) decide si hace la siguiente pregunta del guion o una de seguimiento.
*   **Mecanismo de Respaldo:** Si la IA falla (ej: LM Studio apagado), el sistema activa un **"Fallback de Respaldo"** que permite completar las 7 preguntas originales sin detener la encuesta.

---

## 🤖 Configuración de IA (Motores)

Ambas aplicaciones permiten alternar entre dos proveedores de IA:

### **Gemini AI (Nube)**
- **Modelo:** `gemini-3-flash-preview`
- **Uso:** Ideal para producción y máxima precisión.
- **Requiere:** `VITE_GEMINI_API_KEY` en el archivo `.env.local`.

### **LM Studio (Local)**
- **Servidor:** `http://127.0.0.1:1234/v1` (enrutado transparentemente vía Proxy Inverso `/api-lmstudio` en Vite).
- **Uso:** Ideal para lograr privacidad 100% y eludir las cuotas de red.
- **Configuración:** Debe estar seleccionado como proveedor en la UI superior.
- **Transcripción Nativa:** En la versión dinámica, si usas LM Studio, la aplicación utilizará automáticamente la **API de Web Speech de Google Chrome** para transcribir el audio sin tocar internet, escribiendo tus palabras en tiempo real. Esto soluciona los problemas de latencia y de límite de cuota (*rate limit*) de Gemini.

---

## 📁 Archivos Clave (Versión Dinámica)

| Archivo | Responsabilidad |
| :--- | :--- |
| `src/services/gemini-dynamic.ts` | El "motor" de la entrevista. Decide cuál es la siguiente pregunta y cuándo terminar la sesión. |
| `src/SurveyFlow.tsx` | Gestiona el flujo de la UI, la grabación de audio y la coordinación con el servicio dinámico. |
| `src/services/gemini.ts` | Puente central para análisis de texto y comunicación con LM Studio. |
| `.env.local` | Contiene las llaves de API y la URL local de LM Studio. |

---

## 🚀 Guía de Operación

### Ejecutar las aplicaciones simultáneamente:

1.  **Terminal 1 (Estándar):**
    ```powershell
    cd MediFeedback
    npm run dev
    ```
    Accessible en: `http://localhost:3001`

2.  **Terminal 2 (Dinámica):**
    ```powershell
    cd MediFeedback-Dynamic
    npm run dev
    ```
    Accessible en: `http://localhost:3002`

### Configurar LM Studio como motor principal:
1.  Abre LM Studio.
2.  Carga un modelo (ej. Mistral o Llama 3).
3.  Inicia el servidor local en el puerto `1234`.
4.  En la aplicación (Puerto 3002), asegúrate de que el botón superior diga **"LM Studio"**.

---

## 🎤 Acceso de Micrófono en Red Local

Si accedes a la aplicación mediante una dirección IP (Ej: `http://172.29.16.15:3002`) en lugar de `localhost`, Chrome bloqueará el micrófono por seguridad. Para habilitarlo:

1.  En Chrome, navega a: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2.  Cambia el estado a **Enabled**.
3.  En el cuadro de texto, añade la dirección IP y el puerto: `http://172.29.16.15:3002`
4.  Reinicia Chrome.

---

## 🛠️ Solución de Problemas Comunes

### 1. La encuesta repite siempre la misma pregunta
*   **Causa:** El servidor de IA (LM Studio o Gemini) no responde.
*   **Solución:** Verifica que el puerto local de LM Studio sea `1234`. Ahora el sistema tiene un **respaldo automático** que te preguntará los temas básicos si la IA falla.

### 2. No veo las respuestas en el Dashboard
*   **Causa:** Fallo en la subida a Firebase o filtros de visualización.
*   **Novedad:** Ahora el sistema muestra un **mensaje de error en rojo** si la base de datos no acepta el registro. 
*   **Traceability:** Las encuestas dinámicas se guardan con el campo `type: 'dynamic'` para diferenciarlas en la base de datos.

### 3. Error `429: Quota Exhausted` (Límite Excedido)
*   **Causa:** Google GenAI impone límites muy agresivos para claves gratuitas vinculadas a Proyectos de Google Cloud Antiguos (ej. 20 peticiones al día para *gemini-3-flash-preview*).
*   **Solución 1:** Usa una API Key generada gratuitamente desde tu cuenta personal de Gmail en [Google AI Studio](https://aistudio.google.com), la cual permite 15 RPM.
*   **Solución 2:** Selecciona "LM Studio" en la aplicación. Esto forzará el uso del Dictado Nativo de Chrome, deteniendo por completo las peticiones de transcripción de audio hacia Google.

---

## 📊 Exportación de Reportes

La aplicación ahora permite extraer todos los datos de las encuestas para análisis avanzado en Excel:

1.  En el **Dashboard**, desplázate hasta la tabla de **Registro Completo**.
2.  **(Opcional)** Selecciona un rango de fechas usando los selectores de calendario para filtrar los resultados.
3.  Haz clic en el botón verde **"Exportar Excel"**.
4.  El sistema descargará un archivo `.xlsx` que incluye:
    *   Información del paciente y fecha.
    *   Resultados de sentimiento y score.
    *   **Conversación Completa:** Todas las preguntas y respuestas concatenadas en una sola celda para facilitar la lectura.

*Nota: La exportación respetará los filtros de fecha que hayas seleccionado en la tabla. El nombre del archivo reflejará el rango elegido.*

---

## 📊 Base de Datos (Firebase)

Ambas aplicaciones guardan los resultados en la misma colección de Firestore: `surveys`.

- **Campos de Documento:**
  - `patientName`: Nombre del paciente.
  - `timestamp`: Marca de tiempo del servidor (para orden cronológico).
  - `status`: Estado de la encuesta (`completed`).
  - `overallSentiment`: Sentimiento general (`Pendiente` en modo dinámico hasta ser analizado).
  - `overallScore`: Puntaje final.
  - `type`: Identificador de versión (`dynamic` para la nueva versión).
  - `responses`: Lista de objetos con `questionText`, `transcript`, `sentiment` y `score`.

---
*Documento generado por Antigravity AI - Marzo 2026*
