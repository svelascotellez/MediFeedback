# 🏥 MediFeedback - IA para la Satisfacción del Paciente

MediFeedback es una plataforma inteligente que moderniza la recolección de retroalimentación en entornos hospitalarios. Utilizando la potencia de **Google Gemini**, transforma las respuestas de voz de los pacientes en datos analíticos procesables en tiempo real.

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="Banner" width="100%"/>
</div>

## ✨ Características Principales

### 🎙️ Encuestas por Voz (Patient Experience)
- **Zero Typing**: El paciente responde a las preguntas simplemente hablando.
- **Transcripción Inteligente**: Utiliza Gemini para convertir audio a texto con alta precisión.
- **Análisis de Sentimiento Inmediato**: Cada respuesta se califica automáticamente (Muy positivo, Positivo, Neutral, Negativo, Muy negativo).

### 📊 Dashboard de Análisis (Hospital Backoffice)
- **Visualización en Tiempo Real**: Gráficos interactivos de distribución de satisfacción.
- **AI Insights**: Resúmenes automáticos generados por IA que condensan la opinión de múltiples pacientes.
- **Paginación y Rendimiento**: Capacidad para manejar grandes volúmenes de datos mediante carga bajo demanda.

### 🔒 Seguridad de Grado Médico
- **Reglas de Firestore Estrictas**: Validación robusta de esquemas de datos.
- **Control de Acceso**: Gestión de administradores a través de Firebase Authentication y colecciones seguras.

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

### 4. Configuración de Firebase
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

### Acceso Administrativo
1. Haga clic en **Admin Login** e inicie sesión con su cuenta de Google.
2. Para acceder al Dashboard, su usuario debe tener asignado el rol de `admin` en la colección `users` de Firestore.
   - *Nota: Por seguridad, el primer login registra al usuario, pero el rol de admin se asigna manualmente en la base de datos.*

## 🛡️ Reglas de Seguridad (Firestore)
El archivo `firestore.rules` garantiza que:
- Solo se creen encuestas que cumplan con el formato exacto.
- Solo los administradores verificados puedan leer o borrar datos.

---

Desarrollado con ❤️ para mejorar la atención médica mediante Inteligencia Artificial.
