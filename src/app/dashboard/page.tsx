"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { 
  ArrowLeft,
  CreditCard,
  PieChart,
  Bell,
  Settings,
  ShieldCheck,
  ChevronRight,
  Zap,
  Plus,
  Trash2,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Brain,
  Sparkles,
  Check,
  AlertCircle,
  KeyRound,
  Copy,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  where 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGeminiKey } from "@/hooks/useGeminiKey";
import { useAutomationApiKey } from "@/hooks/useAutomationApiKey";
import { useUserConfig, Segment } from "@/hooks/useUserConfig";

interface Recurrente {
  id: string;
  nombre: string;
  monto: number;
  tipo: "ingreso" | "egreso";
  userId: string;
  agrupadorId?: string;
}

interface Agrupador {
  id: string;
  nombre: string;
  userId: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: "", monto: "", tipo: "egreso" as "ingreso" | "egreso", agrupadorId: "" });
  const [nuevoAgrupador, setNuevoAgrupador] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAgrupador, setIsAddingAgrupador] = useState(false);

  const { getKey, setKey, clearKey, hasKey } = useGeminiKey();
  const { config, loading: loadingConfig, updateConfig } = useUserConfig();
  const {
    hasKey: hasApiKey,
    preview: apiKeyPreview,
    generateKey: generateApiKey,
    revokeKey: revokeApiKey,
  } = useAutomationApiKey();

  const [geminiInput, setGeminiInput] = useState("");
  const [segmentsEnabled, setSegmentsEnabled] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  useEffect(() => {
    if (config) {
      setSegmentsEnabled(config.segmentsEnabled);
      setSegments(config.segments);
    }
  }, [config]);

  useEffect(() => {
    const key = getKey();
    if (key) {
      setGeminiInput(key);
    }
  }, [getKey]);

  const handleSegmentChange = (index: number, field: keyof Segment, value: string | number) => {
    setSegments((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleAddSegment = () => {
    if (segments.length >= 5) return;
    const newId = `custom_${Date.now()}`;
    const colors = ["#820ad1", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6"];
    const color = colors[segments.length % colors.length];
    setSegments((prev) => [
      ...prev,
      { id: newId, nombre: `Nuevo Segmento`, porcentaje: 0, color }
    ]);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 2) return;
    setSegments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const sumOfPercentages = segments.reduce((sum, s) => sum + s.porcentaje, 0);

  const handleSaveConfig = async () => {
    if (sumOfPercentages !== 100 && segmentsEnabled) {
      alert("La suma de los porcentajes debe ser exactamente 100%.");
      return;
    }
    setIsSavingConfig(true);
    try {
      await updateConfig({
        segmentsEnabled,
        segments
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al guardar la configuración.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (hasApiKey) {
      const confirmRegen = confirm(
        "Ya tienes una API Key activa. Generar una nueva invalidará la anterior y las automatizaciones que la usen dejarán de funcionar. ¿Deseas continuar?"
      );
      if (!confirmRegen) return;
    }
    setIsGeneratingApiKey(true);
    try {
      const newKey = await generateApiKey();
      setGeneratedApiKey(newKey);
      setApiKeyCopied(false);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al generar la API Key.");
    } finally {
      setIsGeneratingApiKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!confirm("¿Estás seguro de revocar tu API Key? Las automatizaciones conectadas dejarán de funcionar.")) return;
    try {
      await revokeApiKey();
      setGeneratedApiKey(null);
      setApiKeyCopied(false);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al revocar la API Key.");
    }
  };

  const handleCopyApiKey = async () => {
    if (!generatedApiKey) return;
    try {
      await navigator.clipboard.writeText(generatedApiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert("No se pudo copiar la API Key automáticamente. Selecciónala y cópiala manualmente.");
    }
  };

  useEffect(() => {
    if (!user) return;
    
    // Suscripción a movimientos recurrentes
    const qRec = query(collection(db, "movimientos_recurrentes"), where("userId", "==", user.uid));
    const unsubRec = onSnapshot(qRec, (snap) => {
      setRecurrentes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Recurrente[]);
    });

    // Suscripción a agrupadores
    const qAgr = query(collection(db, "agrupadores"), where("userId", "==", user.uid));
    const unsubAgr = onSnapshot(qAgr, (snap) => {
      setAgrupadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Agrupador[]);
    });

    return () => {
      unsubRec();
      unsubAgr();
    };
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nuevo.nombre || !nuevo.monto) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, "movimientos_recurrentes"), {
        nombre: nuevo.nombre,
        monto: parseFloat(nuevo.monto),
        tipo: nuevo.tipo,
        userId: user.uid,
        agrupadorId: nuevo.agrupadorId || null
      });
      setNuevo({ nombre: "", monto: "", tipo: "egreso", agrupadorId: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "movimientos_recurrentes", id));
  };

  const handleAddAgrupador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nuevoAgrupador.trim()) return;
    setIsAddingAgrupador(true);
    try {
      await addDoc(collection(db, "agrupadores"), {
        nombre: nuevoAgrupador.trim(),
        userId: user.uid
      });
      setNuevoAgrupador("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingAgrupador(false);
    }
  };

  const handleDeleteAgrupador = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este agrupador?")) {
      await deleteDoc(doc(db, "agrupadores", id));
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background flex flex-col items-center">
        {/* Mobile Wrapper */}
        <div className="w-full max-w-[500px] flex flex-col min-h-screen p-6">
          
          {/* Header Compacto */}
          <header className="mb-8 py-4">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-nu-purple font-bold mb-8 hover:opacity-70 transition-opacity"
            >
              <ArrowLeft className="w-5 h-5" />
              Inicio
            </Link>
            <div className="space-y-2">
               <h1 className="text-3xl font-black tracking-tight">Configuración</h1>
               <p className="text-slate-500 font-medium">Gestiona tus movimientos recurrentes</p>
            </div>
          </header>

          <div className="space-y-8 flex-1 pb-20">
            
            {/* Sección: Agregar Nuevo Recurrente */}
            <section className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 ml-2">Nuevo Recurrente</h2>
              
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                <button 
                  onClick={() => setNuevo({...nuevo, tipo: "egreso"})}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${nuevo.tipo === "egreso" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"}`}
                >
                  Egreso
                </button>
                <button 
                  onClick={() => setNuevo({...nuevo, tipo: "ingreso"})}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${nuevo.tipo === "ingreso" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"}`}
                >
                  Ingreso
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Ej: Pago de Internet"
                  className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-nu-purple transition-all font-bold text-slate-800"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({...nuevo, nombre: e.target.value})}
                  required
                />
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-nu-purple transition-all font-black text-slate-800"
                    value={nuevo.monto}
                    onChange={(e) => setNuevo({...nuevo, monto: e.target.value})}
                    required
                  />
                </div>

                {nuevo.tipo === "egreso" && agrupadores.length > 0 && (
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-nu-purple transition-all font-bold text-slate-800 appearance-none"
                    value={nuevo.agrupadorId}
                    onChange={(e) => setNuevo({...nuevo, agrupadorId: e.target.value})}
                  >
                    <option value="">Sin Agrupador (Opcional)</option>
                    {agrupadores.map(a => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                )}

                <button 
                  disabled={isAdding}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Plus className="w-4 h-4" />
                      Guardar en la lista
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Sección: Agrupadores (NUEVO) */}
            <section className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 ml-2">Agrupadores de Gasto</h2>
              
              <form onSubmit={handleAddAgrupador} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="Ej: Comida, Transporte..."
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-nu-purple transition-all font-bold text-slate-800"
                  value={nuevoAgrupador}
                  onChange={(e) => setNuevoAgrupador(e.target.value)}
                  required
                />
                <button 
                  disabled={isAddingAgrupador}
                  className="bg-nu-purple text-white p-4 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-lg"
                >
                  {isAddingAgrupador ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {agrupadores.map((a) => (
                  <div key={a.id} className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-700">{a.nombre}</span>
                    <button 
                      onClick={() => handleDeleteAgrupador(a.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {agrupadores.length === 0 && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center w-full py-4">No hay agrupadores creados</p>
                )}
              </div>
            </section>

            {/* Sección: Inteligencia Artificial y Segmentación */}
            <section className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-8">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2 ml-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-nu-purple" />
                  Inteligencia Artificial
                </h2>
                <p className="text-xs text-slate-500 font-medium ml-2">Configura tu API Key de Gemini para clasificar tus gastos automáticamente.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Gemini API Key</label>
                  <input 
                    type="password" 
                    placeholder={hasKey ? "••••••••••••••••••••••••" : "Ingresa tu API Key de Gemini"}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-sm"
                    value={geminiInput}
                    onChange={(e) => setGeminiInput(e.target.value)}
                  />
                  {(geminiInput.trim() || hasKey) && (
                    <div className="flex gap-2 justify-end pt-1">
                      {geminiInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setKey(geminiInput);
                            alert("¡API Key guardada localmente con éxito!");
                          }}
                          className="flex-1 bg-nu-purple text-white py-3.5 px-5 rounded-2xl font-bold active:scale-95 transition-transform text-xs shadow-md"
                        >
                          Guardar Llave
                        </button>
                      )}
                      {hasKey && (
                        <button
                          type="button"
                          onClick={() => {
                            clearKey();
                            setGeminiInput("");
                            alert("API Key de Gemini eliminada.");
                          }}
                          className="flex-1 bg-red-50 text-red-500 border border-red-100 py-3.5 px-5 rounded-2xl font-bold active:scale-95 transition-transform text-xs"
                        >
                          Eliminar Llave
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 ml-4 flex items-center gap-1 font-medium pt-1">
                    <Sparkles className="w-3 text-nu-purple" />
                    Tu clave se guarda localmente en tu navegador de forma segura.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-nu-purple" />
                      Guía de Segmentos (50-30-20)
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">Establece límites ideales para tus gastos quincenales.</p>
                  </div>
                  <button
                    onClick={() => setSegmentsEnabled(!segmentsEnabled)}
                    className={`w-14 h-8 rounded-full transition-all relative flex items-center ${segmentsEnabled ? "bg-nu-purple" : "bg-slate-200"}`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute transition-all ${segmentsEnabled ? "left-7" : "left-1"}`} />
                  </button>
                </div>

                {segmentsEnabled && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {segments.map((seg, idx) => (
                        <div key={seg.id || idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                          <div className="flex gap-3">
                            <div className="flex-1 space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Nombre del Segmento</label>
                              <input
                                type="text"
                                value={seg.nombre}
                                onChange={(e) => handleSegmentChange(idx, "nombre", e.target.value)}
                                className="w-full bg-white border-2 border-transparent rounded-xl px-3 py-2.5 focus:border-nu-purple outline-none transition-all font-bold text-slate-800 text-sm"
                                placeholder="Ej: Necesidades"
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Meta (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={seg.porcentaje}
                                  onChange={(e) => handleSegmentChange(idx, "porcentaje", parseInt(e.target.value) || 0)}
                                  className="w-full bg-white border-2 border-transparent rounded-xl pl-3 pr-7 py-2.5 focus:border-nu-purple outline-none transition-all font-black text-slate-800 text-sm"
                                  placeholder="50"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Descripción y Ejemplos (Ayuda a la IA)</label>
                            <input
                              type="text"
                              value={seg.descripcion || ""}
                              onChange={(e) => handleSegmentChange(idx, "descripcion", e.target.value)}
                              className="w-full bg-white border-2 border-transparent rounded-xl px-3 py-2.5 focus:border-nu-purple outline-none transition-all font-medium text-slate-600 text-xs"
                              placeholder="Ej: Renta, comida básica, servicios, transporte..."
                            />
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Color:</span>
                              <div className="flex gap-1">
                                {["#820ad1", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6"].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => handleSegmentChange(idx, "color", color)}
                                    className={`w-5 h-5 rounded-full border transition-all ${seg.color === color ? "border-slate-900 scale-110 shadow-sm" : "border-transparent opacity-60"}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                            {segments.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSegment(idx)}
                                className="text-xs text-red-500 font-bold hover:underline"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {segments.length < 5 && (
                      <button
                        type="button"
                        onClick={handleAddSegment}
                        className="w-full border-2 border-dashed border-slate-200 text-slate-500 font-bold py-3.5 rounded-2xl text-xs active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir Nuevo Segmento
                      </button>
                    )}

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Porcentajes</span>
                        <p className={`text-base font-black ${sumOfPercentages === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                          {sumOfPercentages}% / 100%
                        </p>
                      </div>
                      {sumOfPercentages !== 100 && (
                        <p className="text-[9px] font-bold text-amber-600 max-w-[200px] text-right">
                          La suma de los porcentajes debe ser exactamente 100% para poder guardar.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig || (segmentsEnabled && sumOfPercentages !== 100)}
                    className="w-full bg-nu-purple text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSavingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        {saveSuccess ? <Check className="w-4 h-4" /> : null}
                        {saveSuccess ? "¡Configuración Guardada!" : "Guardar Segmentos"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* Sección: Automatizaciones (API Key personal) */}
            <section className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2 ml-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-nu-purple" />
                  Automatizaciones
                </h2>
                <p className="text-xs text-slate-500 font-medium ml-2">
                  Genera una API Key personal para conectar automatizaciones de terceros (Zapier, Make, atajos, scripts propios, etc.)
                  y registrar gastos automáticamente en tu cuenta.
                </p>
              </div>

              {generatedApiKey ? (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-amber-700">
                      Copia y guarda esta clave ahora. Por seguridad, no volveremos a mostrarla completa.
                    </p>
                  </div>
                  <div className="bg-slate-50 border-2 border-nu-purple rounded-2xl px-5 py-4 flex items-center justify-between gap-2">
                    <code className="text-xs font-bold text-slate-800 break-all">{generatedApiKey}</code>
                    <button
                      type="button"
                      onClick={handleCopyApiKey}
                      className="shrink-0 bg-nu-purple text-white p-2.5 rounded-xl active:scale-95 transition-transform"
                    >
                      {apiKeyCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-4 font-medium">
                    Envíala en el header <code className="font-bold">x-api-key</code> al endpoint <code className="font-bold">/api/webhook</code>.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {hasApiKey ? "Tienes una API Key activa" : "No tienes ninguna API Key generada"}
                    </p>
                    {hasApiKey && apiKeyPreview && (
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Termina en •••• {apiKeyPreview}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateApiKey}
                  disabled={isGeneratingApiKey}
                  className="flex-1 bg-nu-purple text-white py-3.5 px-5 rounded-2xl font-bold active:scale-95 transition-transform text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingApiKey ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : hasApiKey ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  {hasApiKey ? "Regenerar Llave" : "Generar Llave"}
                </button>
                {hasApiKey && (
                  <button
                    type="button"
                    onClick={handleRevokeApiKey}
                    className="flex-1 bg-red-50 text-red-500 border border-red-100 py-3.5 px-5 rounded-2xl font-bold active:scale-95 transition-transform text-xs"
                  >
                    Revocar Llave
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 ml-4 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 text-nu-purple" />
                Solo almacenamos un hash de tu clave; nunca guardamos el valor original.
              </p>
            </section>

            {/* Sección: Lista de Recurrentes */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Tus Movimientos Fijos</h2>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              
              <div className="space-y-3">
                {recurrentes.map((r) => (
                  <div 
                    key={r.id}
                    className="bg-white border border-slate-50 p-5 rounded-[2rem] flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.tipo === "ingreso" ? "bg-emerald-100 text-emerald-600" : "bg-nu-purple-light text-nu-purple"}`}>
                        {r.tipo === "ingreso" ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">{r.nombre}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Recurrente</p>
                          {r.agrupadorId && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">
                              {agrupadores.find(a => a.id === r.agrupadorId)?.nombre || "Agrupado"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-black text-base ${r.tipo === "ingreso" ? "text-emerald-600" : "text-slate-900"}`}>
                        ${r.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                      <button 
                        onClick={() => handleDelete(r.id)}
                        className="p-2 text-slate-200 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {recurrentes.length === 0 && (
                  <div className="py-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center">
                    <p className="text-slate-400 font-medium">No tienes movimientos fijos aún</p>
                  </div>
                )}
              </div>
            </section>

            {/* Footer de Seguridad */}
            <div className="mt-auto pt-10 pb-6 opacity-30 flex flex-col items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-nu-purple" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">MyPocket Secure Config</p>
            </div>

          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
