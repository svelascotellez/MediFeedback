import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, MessageCircle, Trash2, CheckSquare, Square, AlertCircle, X, FileSpreadsheet, Download, RefreshCw, Filter, Calendar } from 'lucide-react';
import { db } from './firebase';
import { doc, deleteDoc, writeBatch, collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface FullDataTableProps {
  surveys: any[];
}

export const FullDataTable = ({ surveys }: FullDataTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; type: 'one' | 'selected' | 'all'; id?: string }>({
    show: false,
    type: 'one'
  });

  const filteredSurveys = surveys.filter(s => {
    const matchesSearch = s.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || (s.overallSentiment || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (startDate || endDate) {
      const surveyDate = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
      if (startDate && surveyDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (surveyDate > end) return false;
      }
    }
    
    return matchesSearch;
  });

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      // Obtenemos documentos filtrados para el reporte
      let q = query(collection(db, 'surveys'), orderBy('timestamp', 'desc'));
      
      const constraints: any[] = [orderBy('timestamp', 'desc')];
      if (startDate) constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(startDate))));
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        constraints.push(where('timestamp', '<=', Timestamp.fromDate(end)));
      }
      
      const qFiltered = query(collection(db, 'surveys'), ...constraints);
      const snapshot = await getDocs(qFiltered);
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const exportData = allData.map(s => ({
        "ID": s.id,
        "Paciente": s.patientName,
        "Fecha": s.timestamp?.toDate().toLocaleString() || 'N/A',
        "Sentimiento General": s.overallSentiment || 'N/A',
        "Puntaje General": s.overallScore || 0,
        "Tipo": s.type || 'Standard',
        "Análisis IA": s.insights || '',
        "Conversación Completa": s.responses?.map((r: any) => `P: ${r.questionText}\nR: ${r.transcript}`).join("\n\n---\n\n") || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte_Filtros");
      
      const fileName = `MediFeedback_Reporte_${startDate || 'Inicio'}_a_${endDate || 'Fin'}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      alert("No se pudo generar el archivo de Excel filtrado.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSurveys.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSurveys.map(s => s.id));
    }
  };

  // Sync selectedIds with available surveys to prevent stale selections
  React.useEffect(() => {
    const availableIds = new Set(surveys.map(s => s.id));
    setSelectedIds(prev => prev.filter(id => availableIds.has(id)));
  }, [surveys]);

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      if (confirmModal.type === 'one' && confirmModal.id) {
        await deleteDoc(doc(db, 'surveys', confirmModal.id));
      } else if (confirmModal.type === 'selected') {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          batch.delete(doc(db, 'surveys', id));
        });
        await batch.commit();
        setSelectedIds([]);
      } else if (confirmModal.type === 'all') {
        const batch = writeBatch(db);
        const snapshot = await getDocs(collection(db, 'surveys'));
        snapshot.docs.forEach(d => {
          batch.delete(doc(db, 'surveys', d.id));
        });
        await batch.commit();
        setSelectedIds([]);
      }
    } catch (error) {
      console.error("Error deleting records:", error);
    } finally {
      setIsDeleting(false);
      setConfirmModal({ show: false, type: 'one' });
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-10">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-slate-900">Registro Completo de Encuestas</h3>
          {surveys.length > 0 && (
            <button 
              onClick={() => setConfirmModal({ show: true, type: 'all' })}
              className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider flex items-center gap-1 bg-red-50 px-3 py-1 rounded-lg border border-red-100 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Borrar Todo
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {/* Date Selection */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date" 
                value={startDate} 
                title="Fecha de inicio"
                aria-label="Fecha de inicio"
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-8 pr-2 py-1.5 bg-transparent text-xs font-semibold focus:outline-none text-slate-600"
              />
            </div>
            <span className="text-slate-300">|</span>
            <div className="relative">
              <input 
                type="date" 
                value={endDate} 
                title="Fecha de fin"
                aria-label="Fecha de fin"
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-2 pr-8 py-1.5 bg-transparent text-xs font-semibold focus:outline-none text-slate-600"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }} 
                title="Limpiar filtros de fecha"
                aria-label="Limpiar filtros de fecha"
                className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button 
            onClick={exportToExcel}
            disabled={isExporting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {isExporting ? 'Generando...' : 'Exportar Excel'}
          </button>
          
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setConfirmModal({ show: true, type: 'selected' })}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" /> Borrar Seleccionados ({selectedIds.length})
            </button>
          )}

          <div className="relative w-full md:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 w-10">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                  {selectedIds.length === filteredSurveys.length && filteredSurveys.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Paciente</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Fecha y Hora</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Sentimiento</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm">Puntaje</th>
              <th className="px-6 py-4 font-semibold text-slate-500 text-sm text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSurveys.map((s) => (
              <React.Fragment key={s.id}>
                <tr className={`group transition-colors ${expandedId === s.id ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleSelect(s.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                      {selectedIds.includes(s.id) ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{s.patientName}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {s.timestamp?.toDate ? s.timestamp.toDate().toLocaleString() : 'Reciente'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      s.overallSentiment?.toLowerCase() === 'muy positivo' ? 'bg-emerald-200 text-emerald-800' :
                      s.overallSentiment?.toLowerCase() === 'positivo' ? 'bg-emerald-100 text-emerald-700' :
                      s.overallSentiment?.toLowerCase() === 'muy negativo' ? 'bg-red-200 text-red-800' :
                      s.overallSentiment?.toLowerCase() === 'negativo' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {s.overallSentiment}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-700">{s.overallScore}</span>
                      <span className="text-slate-300 text-xs">/ 5</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => toggleExpand(s.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1"
                      >
                        {expandedId === s.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{expandedId === s.id ? 'Ocultar' : 'Detalles'}</span>
                      </button>
                      <button 
                        onClick={() => setConfirmModal({ show: true, type: 'one', id: s.id })}
                        className="p-2 text-slate-300 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Borrar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 bg-indigo-50/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-indigo-600" />
                            Transcripciones por Pregunta
                          </h4>
                          <div className="space-y-3">
                            {s.responses?.map((r: any, idx: number) => (
                              <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                <p className="text-xs font-bold text-slate-400 mb-1">{r.questionText}</p>
                                <p className="text-sm text-slate-700 leading-relaxed">"{r.transcript}"</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    r.sentiment?.toLowerCase() === 'muy positivo' ? 'bg-emerald-200 text-emerald-800' :
                                    r.sentiment?.toLowerCase() === 'positivo' ? 'bg-emerald-100 text-emerald-700' :
                                    r.sentiment?.toLowerCase() === 'muy negativo' ? 'bg-red-200 text-red-800' :
                                    r.sentiment?.toLowerCase() === 'negativo' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {r.sentiment}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Score: {r.score}/5</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm h-fit">
                          <h4 className="text-sm font-bold text-slate-900 mb-3">Resumen de IA</h4>
                          <p className="text-sm text-slate-600 leading-relaxed italic">
                            {s.insights || "No hay insights adicionales para esta encuesta."}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredSurveys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
                  No se encontraron resultados para "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <button 
                  onClick={() => setConfirmModal({ show: false, type: 'one' })}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <h4 className="text-xl font-bold text-slate-900 mb-2">
                {confirmModal.type === 'one' ? '¿Borrar este registro?' : 
                 confirmModal.type === 'selected' ? `¿Borrar ${selectedIds.length} registros?` : 
                 '¿Borrar TODOS los registros?'}
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Esta acción no se puede deshacer. Los datos del paciente y sus respuestas se eliminarán permanentemente del sistema.
              </p>
            </div>
            
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setConfirmModal({ show: false, type: 'one' })}
                className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isDeleting ? 'Borrando...' : 'Confirmar Borrado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
