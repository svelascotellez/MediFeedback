import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Star, MessageSquare, TrendingUp, Calendar, RefreshCw, ChevronDown } from 'lucide-react';

import { FullDataTable } from './FullDataTable';
import { DashboardSkeleton } from './Skeleton';

const COLORS = ['#059669', '#34d399', '#fbbf24', '#f87171', '#dc2626'];

export const Dashboard = () => {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setIsSyncing(true);
    // Pedimos uno más del límite para saber si hay más páginas
    const q = query(collection(db, 'surveys'), orderBy('timestamp', 'desc'), limit(pageSize + 1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs;
      setHasMore(docs.length > pageSize);
      
      const data = docs.slice(0, pageSize).map(doc => ({ id: doc.id, ...doc.data() }));
      setSurveys(data);
      setLoading(false);
      setIsSyncing(false);
    }, (error) => {
      console.error("Snapshot error:", error);
      setLoading(false);
      setIsSyncing(false);
    });
    return () => unsubscribe();
  }, [pageSize]);

  const stats = {
    total: surveys.length,
    avgScore: surveys.reduce((acc, s) => acc + (s.overallScore || 0), 0) / (surveys.length || 1),
    veryPositiveCount: surveys.filter(s => s.overallSentiment?.toLowerCase() === 'muy positivo').length,
    positiveCount: surveys.filter(s => s.overallSentiment?.toLowerCase() === 'positivo').length,
    neutralCount: surveys.filter(s => s.overallSentiment?.toLowerCase() === 'neutral').length,
    negativeCount: surveys.filter(s => s.overallSentiment?.toLowerCase() === 'negativo').length,
    veryNegativeCount: surveys.filter(s => s.overallSentiment?.toLowerCase() === 'muy negativo').length,
  };

  const sentimentData = [
    { name: 'Muy Positivo', value: stats.veryPositiveCount },
    { name: 'Positivo', value: stats.positiveCount },
    { name: 'Neutral', value: stats.neutralCount },
    { name: 'Negativo', value: stats.negativeCount },
    { name: 'Muy Negativo', value: stats.veryNegativeCount },
  ];

  const recentActivity = surveys.slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Hospital Backoffice</h1>
            <p className="text-slate-500 mt-1">Análisis de satisfacción del paciente en tiempo real</p>
          </div>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sincronizando...
              </div>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard icon={<Users className="text-blue-600" />} label="Total Encuestas" value={stats.total} />
          <StatCard icon={<Star className="text-amber-500" />} label="Puntaje Promedio" value={stats.avgScore.toFixed(1)} />
          <StatCard icon={<TrendingUp className="text-emerald-600" />} label="Satisfacción Alta" value={`${(((stats.veryPositiveCount + stats.positiveCount) / (stats.total || 1)) * 100).toFixed(0)}%`} />
          <StatCard icon={<MessageSquare className="text-indigo-600" />} label="Comentarios Recientes" value={surveys.length > 0 ? surveys.slice(0, 5).length : '0'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Charts */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Distribución de Sentimientos</h3>
              <div className="h-80 flex flex-col items-center justify-center">
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-300 flex flex-col items-center gap-2">
                    <TrendingUp className="w-12 h-12 opacity-20" />
                    <p className="text-sm italic">Sin datos suficientes para graficar</p>
                  </div>
                )}
              </div>
              {stats.total > 0 && (
                <div className="flex justify-center gap-8 mt-4">
                  {sentimentData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-sm font-medium text-slate-600">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Últimas Encuestas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 font-semibold text-slate-500 text-sm">Paciente</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm">Sentimiento</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm">Puntaje</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentActivity.map((s) => (
                      <tr key={s.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-medium text-slate-900">{s.patientName}</td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            s.overallSentiment?.toLowerCase() === 'muy positivo' ? 'bg-emerald-200 text-emerald-800' :
                            s.overallSentiment?.toLowerCase() === 'positivo' ? 'bg-emerald-100 text-emerald-700' :
                            s.overallSentiment?.toLowerCase() === 'muy negativo' ? 'bg-red-200 text-red-800' :
                            s.overallSentiment?.toLowerCase() === 'negativo' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {s.overallSentiment}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-slate-600">{s.overallScore}</td>
                        <td className="py-4 text-slate-400 text-sm">
                          {s.timestamp?.toDate().toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">AI Insights</h3>
            <div className="space-y-6">
              {surveys.slice(0, 3).map((s, i) => (
                <div key={i} className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Análisis de {s.patientName}</span>
                  </div>
                  <p className="text-sm text-slate-700 italic">"{s.insights || 'Analizando respuestas...'}"</p>
                </div>
              ))}
              {surveys.length === 0 && (
                <p className="text-slate-400 text-sm italic">Esperando datos de encuestas para generar insights...</p>
              )}
            </div>
          </div>
        </div>

        {/* Full Data Table Section */}
        <FullDataTable surveys={surveys} />

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-8 flex justify-center pb-10">
            <button 
              onClick={() => setPageSize(prev => prev + 10)}
              className="flex items-center gap-2 bg-white text-indigo-600 px-8 py-3 rounded-2xl font-bold border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all group"
            >
              <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              Cargar más registros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    key={`${label}-${value}`}
    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4"
  >
    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <motion.p 
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="text-2xl font-bold text-slate-900"
      >
        {value}
      </motion.p>
    </div>
  </motion.div>
);
