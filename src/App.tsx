import React, { useState, useEffect } from 'react';
import { SurveyFlow } from './components/SurveyFlow';
import { Dashboard } from './components/Dashboard';
import { auth, initAnonymousAuth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn, LogOut, LayoutDashboard, ClipboardList, AlertTriangle, Loader2, Cpu, Sparkles } from 'lucide-react';
import { getAIProvider, setAIProvider, AIProvider } from './services/gemini';

export default function App() {
  const [view, setView] = useState<'patient' | 'admin'>('patient');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(getAIProvider());

  const toggleProvider = () => {
    const next = provider === 'gemini' ? 'lmstudio' : 'gemini';
    setProvider(next);
    setAIProvider(next);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initAnonymousAuth();
      } catch (err) {
        // Non-blocking error, we allowed unauthenticated creates in rules as fallback
        console.warn("Anonymous auth could not be initialized, proceeding as unauthenticated.");
      }
    };
    init();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Registrar al usuario en la colección 'users' de forma segura
      if (result.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          lastLogin: serverTimestamp(),
        }, { merge: true });
        
        // El rol 'admin' debe ser asignado manualmente en la base de datos por seguridad
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError("La solicitud de inicio de sesión fue cancelada.");
      } else {
        setAuthError(error.message || "Error al iniciar sesión.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">MediFeedback</span>
          </div>

          <button 
            onClick={toggleProvider}
            title={`Usando ${provider}. Clic para cambiar.`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              provider === 'gemini' 
                ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' 
                : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100'
            }`}
          >
            {provider === 'gemini' ? <Sparkles className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
            {provider === 'gemini' ? 'Gemini AI' : 'LM Studio'}
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('patient')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              view === 'patient' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Paciente
          </button>
          
          <button 
            onClick={() => setView('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              view === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-3">
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-slate-200" />
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Admin Login
              </button>
              {authError && <p className="text-[10px] text-red-500 mt-1 max-w-[200px] text-right">{authError}</p>}
            </div>
          )}
        </div>
      </nav>

      <main className="py-10">
        {view === 'patient' ? (
          <SurveyFlow />
        ) : (
          user && !user.isAnonymous ? <Dashboard /> : (
            <div className="max-w-md mx-auto text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100 mt-20">
              <LayoutDashboard className="w-16 h-16 text-slate-200 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Acceso Restringido</h2>
              <p className="text-slate-500 mb-8">Por favor inicie sesión como administrador para ver el dashboard de análisis.</p>
              {authError && <p className="text-sm text-red-500 mb-4">{authError}</p>}
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isLoggingIn ? "Iniciando sesión..." : "Iniciar Sesión con Google"}
              </button>
            </div>
          )
        )}
      </main>
    </div>
  );
}
