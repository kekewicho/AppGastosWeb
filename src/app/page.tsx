"use client";

import { useState, useEffect } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
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
  Timestamp
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  LogOut, 
  Plus, 
  Trash2, 
  Wallet, 
  LogIn,
  Loader2,
  Calendar
} from "lucide-react";

interface Gasto {
  id: string;
  nombre: string;
  monto: number;
  fecha: Timestamp;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [nuevoGasto, setNuevoGasto] = useState({ nombre: "", monto: "" });
  const [isAdding, setIsAdding] = useState(false);

  // Escuchar cambios en Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "gastos"), 
      orderBy("fecha", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Gasto[];
      setGastos(data);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión", error);
    }
  };

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !user) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, "gastos"), {
        nombre: nuevoGasto.nombre,
        monto: parseFloat(nuevoGasto.monto),
        fecha: Timestamp.now(),
        userId: user.uid
      });
      setNuevoGasto({ nombre: "", monto: "" });
    } catch (error) {
      console.error("Error al añadir gasto", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    try {
      await deleteDoc(doc(db, "gastos", id));
    } catch (error) {
      console.error("Error al eliminar gasto", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/20">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">GastosApp</h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-red-400"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-slate-200 transition-all shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión
          </button>
        )}
      </header>

      {!user ? (
        <section className="text-center py-20">
          <h2 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Controla tus gastos con facilidad.
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Una aplicación minimalista y potente para llevar el registro de tus finanzas personales sincronizada en tiempo real.
          </p>
          <button 
            onClick={handleLogin}
            className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-xl shadow-blue-900/40"
          >
            Comenzar Gratis con Google
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Formulario */}
          <section className="md:col-span-1">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm sticky top-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                Nuevo Gasto
              </h3>
              <form onSubmit={handleAddGasto} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Supermercado"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={nuevoGasto.nombre}
                    onChange={(e) => setNuevoGasto({...nuevoGasto, nombre: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monto ($)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={nuevoGasto.monto}
                    onChange={(e) => setNuevoGasto({...nuevoGasto, monto: e.target.value})}
                    required
                  />
                </div>
                <button 
                  disabled={isAdding}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : "Añadir Gasto"}
                </button>
              </form>
            </div>
          </section>

          {/* Lista de Gastos */}
          <section className="md:col-span-2 space-y-4">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Actividad Reciente
            </h3>
            
            {gastos.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500">
                No hay gastos registrados todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {gastos.map((gasto) => (
                  <div 
                    key={gasto.id}
                    className="group bg-slate-900/30 hover:bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between transition-all"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-200">{gasto.nombre}</h4>
                      <p className="text-xs text-slate-500">
                        {gasto.fecha?.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-lg text-emerald-400">
                        ${gasto.monto.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => handleDeleteGasto(gasto.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
