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
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: "", monto: "", tipo: "egreso" as "ingreso" | "egreso" });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "movimientos_recurrentes"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setRecurrentes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Recurrente[]);
    });
    return () => unsub();
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
        userId: user.uid
      });
      setNuevo({ nombre: "", monto: "", tipo: "egreso" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "movimientos_recurrentes", id));
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
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Recurrente</p>
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
