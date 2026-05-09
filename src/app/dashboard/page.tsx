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
  ArrowDownCircle
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
