# 🏥 MediFeedback - IA para la Satisfacción del Paciente

MediFeedback es una plataforma inteligente que moderniza la recolección de retroalimentación en entornos hospitalarios. Utilizando la potencia de **Google Gemini**, transforma las respuestas de voz de los pacientes en datos analíticos procesables en tiempo real.

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="Banner" width="100%"/>
</div>

## ✨ Características Principales

### 🎙️ Encuestas por Voz (Patient Experience)
- **Modalidades Flexibles**: El paciente puede responder a las 7 preguntas utilizando el micrófono o escribiendo en modo texto.
- **Transcripción Inteligente**: Utiliza Gemini o reconocimiento de voz local (Web Speech API) para convertir audio a texto con alta precisión.
- **Análisis de Sentimiento Inmediato**: Cada respuesta se califica automáticamente (Muy positivo, Positivo, Neutral, Negativo, Muy negativo).

### 📊 Dashboard de Análisis (Hospital Backoffice)
- **Visualización en Tiempo Real**: Gráficos interactivos de distribución de satisfacción.
- **AI Insights**: Resúmenes automáticos generados por IA que condensan la opinión de múltiples pacientes.
- **Gestión de Datos Total**: Tabla completa con paginación, búsqueda, y borrado individual/masivo de registros.

### 🔒 Seguridad de Grado Médico
- **Reglas de Firestore Estrictas**: Validación robusta de esquemas de datos al crear encuestas.
- **Modo Prototipo Activo**: Actualmente configurado para permitir lectura y borrado público en el Dashboard para facilitar las pruebas.

## 🛠️ Stack Tecnológico

- **Frontend**: React 19, Vite, TypeScript.
- **Estilos**: Tailwind CSS 4, Lucide Icons.
- **Animaciones**: Framer Motion.
- **Backend/Base de Datos**: Firebase Firestore.
- **Autenticación**: Firebase Auth.
- **Inteligencia Artificial**: Google Generative AI (Gemini 3 Flash).

---

## 🚀 Instalación y Configuración Local

### 1. Requisitos Previos
- Node.js (v18 o superior)
- Una cuenta en [Google AI Studio](https://aistudio.google.com/) para obtener tu API Key.

### 2. Clonar e Instalar
```bash
git clone [URL_DEL_REPOSITORIO]
cd MediFeedback
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto:
```env
GEMINI_API_KEY="TU_CLAVE_DE_API_AQUÍ"
```

### 4. Configuración de IA (Opcional: LM Studio)
El sistema permite alternar entre **Gemini** (Nube) y **LM Studio** (Local):
- Por defecto usa Gemini para todo.
- Si activas **LM Studio** en la interfaz:
  - Gemini seguirá encargándose de la **transcripción** (audio a texto).
  - LM Studio se encargará del **análisis clínico** y generación de insights.
  - Asegúrate de tener LM Studio corriendo con el servidor local en `http://localhost:1234`.

### 5. Configuración de Firebase
Para que el inicio de sesión funcione localmente:
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Selecciona tu proyecto (`gen-lang-client-...`).
3. Ve a **Authentication > Settings > Authorized domains**.
4. Añade `localhost`.

### 5. Ejecutar la Aplicación
```bash
npm run dev
```

---

## 📖 Guía de Uso

### Flujo de Pacientes
1. Ingrese el nombre del paciente.
2. Haga clic en el micrófono para grabar la respuesta a cada pregunta.
3. Al finalizar, los datos se procesan y analizan automáticamente.

### Acceso al Dashboard
1. Navega a la vista del Dashboard. Como el sistema está en **modo prototipo**, las reglas permiten que cualquier usuario lea y gestione (borre) los datos.
2. Desde la tabla inferior puedes expandir detalles de AI, buscar encuestas y borrar uno, varios o todos los registros.

## 🛡️ Reglas de Seguridad (Firestore)
El archivo `firestore.rules` garantiza que:
- Solo se creen encuestas que cumplan con el formato exacto de preguntas.
- **Atención**: En esta versión de prototipo, las reglas permiten que cualquier usuario *lea y borre* datos del dashboard libremente. Para un entorno de producción, vuelva a activar la función `isAdmin()`.

---

Desarrollado con ❤️ para mejorar la atención médica mediante Inteligencia Artificial.
