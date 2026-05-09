"use client";

import { useState, useEffect } from "react";
import { 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy,
  deleteDoc,
  doc,
  Timestamp,
  where
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  LogOut, 
  Trash2, 
  Wallet, 
  Loader2, 
  Calendar,
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap
} from "lucide-react";
import Link from "next/link";
import { 
  getQuincenaRange, 
  getNextQuincena, 
  getPreviousQuincena,
  QuincenaRange 
} from "@/lib/dateUtils";
import BottomDrawer from "@/components/BottomDrawer";
import ParcialidadesDrawer from "@/components/ParcialidadesDrawer";
import { CreditCard as CardIcon } from "lucide-react";

interface Movimiento {
  id: string;
  nombre: string;
  monto: number;
  tipo: "ingreso" | "egreso";
  fecha: Timestamp;
  userId: string;
}

type NuevoMovimiento = Omit<Movimiento, "id" | "fecha" | "userId" | "monto"> & {
  monto: string;
};

export default function Home() {
  const { user, loading } = useAuth();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [nuevoMovimiento, setNuevoMovimiento] = useState<NuevoMovimiento>({ nombre: "", monto: "", tipo: "egreso" as const });
  const [isAdding, setIsAdding] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isParcialidadesOpen, setIsParcialidadesOpen] = useState(false);
  const [isLoadingRecurrentes, setIsLoadingRecurrentes] = useState(false);
  
  // Estado para la quincena actual
  const [currentRange, setCurrentRange] = useState<QuincenaRange>(getQuincenaRange(new Date()));

  useEffect(() => {
    if (!user) return;

    // Consulta filtrada por rango de quincena
    const q = query(
      collection(db, "movimientos"), 
      where("userId", "==", user.uid),
      where("fecha", ">=", Timestamp.fromDate(currentRange.start)),
      where("fecha", "<=", Timestamp.fromDate(currentRange.end)),
      orderBy("fecha", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Movimiento[];
      setMovimientos(data);
    });

    return () => unsubscribe();
  }, [user, currentRange]);

  const handleAddMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMovimiento.nombre || !nuevoMovimiento.monto || !user) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        nombre: nuevoMovimiento.nombre,
        monto: parseFloat(nuevoMovimiento.monto),
        tipo: nuevoMovimiento.tipo,
        fecha: Timestamp.now(),
        userId: user.uid
      });
      setNuevoMovimiento({ nombre: "", monto: "", tipo: "egreso" });
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Error al añadir movimiento", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMovimiento = async (mov: Movimiento) => {
    const planId = (mov as any).planId;
    
    if (planId) {
      if (confirm("Este gasto es parte de un plan de parcialidades. ¿Quieres eliminar TODO el plan o solo este movimiento?\n\nAceptar: Eliminar TODO el plan\nCancelar: Eliminar solo este pago")) {
        try {
          const { getDocs, query: fsQuery, collection: fsColl, where: fsWhere, writeBatch: fsBatch, doc: fsDoc } = await import("firebase/firestore");
          const snap = await getDocs(fsQuery(fsColl(db, "movimientos"), fsWhere("planId", "==", planId)));
          const batch = fsBatch(db);
          snap.docs.forEach(d => batch.delete(fsDoc(db, "movimientos", d.id)));
          await batch.commit();
          return;
        } catch (err) {
          console.error(err);
        }
      }
    }

    try {
      await deleteDoc(doc(db, "movimientos", mov.id));
    } catch (error) {
      console.error("Error al eliminar movimiento", error);
    }
  };

  const navNext = () => setCurrentRange(getNextQuincena(currentRange));
  const navPrev = () => setCurrentRange(getPreviousQuincena(currentRange));
  const navToday = () => setCurrentRange(getQuincenaRange(new Date()));

  const handleCargarRecurrentes = async () => {
    if (!user) return;
    setIsLoadingRecurrentes(true);
    try {
      const { getDocs, query: fsQuery, collection: fsCollection, where: fsWhere } = await import("firebase/firestore");
      const snap = await getDocs(fsQuery(fsCollection(db, "movimientos_recurrentes"), fsWhere("userId", "==", user.uid)));
      if (snap.empty) {
        alert("No tienes movimientos recurrentes configurados. Agrégalos en el Dashboard.");
        return;
      }
      const { writeBatch: wb, doc: fsDoc, collection: fsColl } = await import("firebase/firestore");
      const batch = wb(db);
      snap.docs.forEach(recDoc => {
        const data = recDoc.data();
        const ref = fsDoc(fsColl(db, "movimientos"));
        batch.set(ref, {
          nombre: data.nombre,
          monto: data.monto,
          tipo: data.tipo,
          fecha: Timestamp.now(),
          userId: user.uid,
          recurrente: true
        });
      });
      await batch.commit();
      alert(`✓ ${snap.size} movimientos recurrentes cargados en esta quincena`);
    } catch (err) {
      console.error(err);
      alert("Error al cargar los movimientos recurrentes");
    } finally {
      setIsLoadingRecurrentes(false);
    }
  };

  const totalIngresos = movimientos.filter(m => m.tipo === "ingreso").reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === "egreso").reduce((acc, m) => acc + m.monto, 0);
  const balance = totalIngresos - totalEgresos;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-nu-purple" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center">
      <div className="w-full max-w-[500px] flex flex-col min-h-screen p-6">
        
        <header className="flex justify-between items-center py-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-nu-purple rounded-xl shadow-lg shadow-nu-purple/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-nu-purple tracking-tighter">MyPocket</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="p-2.5 bg-slate-100 rounded-full text-slate-600 hover:text-nu-purple transition-colors">
                <LayoutDashboard className="w-5 h-5" />
              </Link>
              <button 
                onClick={() => signOut(auth)}
                className="p-2.5 bg-nu-purple-light text-nu-purple rounded-full"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        {!user ? (
          <section className="flex-1 flex flex-col justify-center items-center text-center space-y-12 py-10">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold leading-tight tracking-tight">
                Controla tus <br/>
                <span className="text-nu-purple">gastos hoy.</span>
              </h2>
              <p className="text-slate-500 font-medium px-4">
                La simplicidad de MyPocket en la palma de tu mano.
              </p>
            </div>
            <Link 
              href="/login"
              className="w-full py-5 bg-nu-purple text-white text-lg font-bold rounded-[2rem] shadow-xl shadow-nu-purple/30 active:scale-95 transition-transform text-center"
            >
              Comenzar ahora
            </Link>
          </section>
        ) : (
          <div className="space-y-8 flex-1">
            
            {/* Navegación de Quincenas */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-2xl shadow-sm">
                <button onClick={navPrev} className="p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>
                <button onClick={navToday} className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-nu-purple mb-0.5">Periodo Actual</span>
                  <span className="text-sm font-bold text-slate-800 capitalize">{currentRange.label}</span>
                </button>
                <button onClick={navNext} className="p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Balance Card Mejorada */}
            <div className="bg-nu-purple p-8 rounded-[2.5rem] text-white shadow-2xl shadow-nu-purple/20 relative overflow-hidden">
               <div className="relative z-10 text-center">
                 <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Balance de la Quincena</p>
                 <h3 className="text-4xl font-black">
                   ${balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                 </h3>
               </div>
               {/* Decoración abstracta tipo Nu */}
               <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </div>

            {/* Fila de Botones Utilitarios */}
            <section className="flex justify-center items-center px-2">
              <div className="flex gap-8 pb-2">
                <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform text-nu-purple hover:border-nu-purple/20 transition-all">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Añadir</span>
                </button>

                <button 
                  onClick={() => setIsParcialidadesOpen(true)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform text-nu-purple hover:border-nu-purple/20 transition-all">
                    <CardIcon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Parcialidades</span>
                </button>

                <button
                  onClick={handleCargarRecurrentes}
                  disabled={isLoadingRecurrentes}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform text-nu-purple hover:border-nu-purple/20 transition-all">
                    {isLoadingRecurrentes
                      ? <Loader2 className="w-6 h-6 animate-spin text-nu-purple" />
                      : <Zap className="w-6 h-6" />
                    }
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Fijos</span>
                </button>
              </div>
            </section>

            {/* Bottom Drawer para Nuevo Movimiento */}
            <BottomDrawer 
              isOpen={isDrawerOpen} 
              onClose={() => setIsDrawerOpen(false)} 
              title="Nuevo Movimiento"
            >
              <div className="space-y-8">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setNuevoMovimiento({...nuevoMovimiento, tipo: "egreso"})}
                    className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all ${nuevoMovimiento.tipo === "egreso" ? "bg-white text-nu-purple shadow-md" : "text-slate-500"}`}
                  >
                    Egreso
                  </button>
                  <button 
                    onClick={() => setNuevoMovimiento({...nuevoMovimiento, tipo: "ingreso"})}
                    className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all ${nuevoMovimiento.tipo === "ingreso" ? "bg-white text-emerald-600 shadow-md" : "text-slate-500"}`}
                  >
                    Ingreso
                  </button>
                </div>

                <form onSubmit={handleAddMovimiento} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Descripción</label>
                    <input 
                      type="text" 
                      placeholder="¿En qué gastaste?"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg"
                      value={nuevoMovimiento.nombre}
                      onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, nombre: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Monto</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        step="0.01"
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-12 pr-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800 text-2xl"
                        value={nuevoMovimiento.monto}
                        onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, monto: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    disabled={isAdding}
                    className={`w-full text-white font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl text-lg ${nuevoMovimiento.tipo === "egreso" ? "bg-nu-purple shadow-nu-purple/30" : "bg-emerald-600 shadow-emerald-900/20"}`}
                  >
                    {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <Plus className="w-5 h-5" />
                        Guardar Registro
                      </>
                    )}
                  </button>
                </form>
              </div>
            </BottomDrawer>

            <ParcialidadesDrawer 
              isOpen={isParcialidadesOpen} 
              onClose={() => setIsParcialidadesOpen(false)} 
              currentRange={currentRange}
            />

            {/* Lista Mobile */}
            <section className="space-y-4 pb-32">
              <div className="flex items-center justify-between px-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Actividad de la Quincena</h4>
                <Calendar className="w-4 h-4 text-nu-purple" />
              </div>
              <div className="space-y-3">
                {movimientos.map((m) => (
                  <div 
                    key={m.id}
                    className="group bg-white border border-slate-50 p-5 rounded-2xl flex items-center justify-between shadow-sm active:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.tipo === "ingreso" ? "bg-emerald-100 text-emerald-600" : "bg-nu-purple-light text-nu-purple"}`}>
                        {m.tipo === "ingreso" ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">{m.nombre}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            {m.fecha?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </p>
                          {(m as any).planId && (
                            <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-black uppercase">Plan</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-black text-base ${m.tipo === "ingreso" ? "text-emerald-600" : "text-slate-900"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}${m.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                      <button 
                        onClick={() => handleDeleteMovimiento(m)}
                        className="p-2 text-slate-200 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {movimientos.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-slate-400 font-medium">No hay registros en este periodo</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
