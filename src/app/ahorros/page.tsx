"use client";

import { useState, useEffect, useMemo } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc, 
  Timestamp, 
  where, 
  updateDoc 
} from "firebase/firestore";
import { 
  PiggyBank, 
  Plus, 
  Minus, 
  HandCoins, 
  TrendingUp, 
  History, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Trash2, 
  ChevronRight, 
  Info, 
  Sparkles,
  DollarSign
} from "lucide-react";
import BottomDrawer from "@/components/BottomDrawer";
import Navbar from "@/components/Navbar";
import Link from "next/link";

interface AhorroMovimiento {
  id: string;
  monto: number;
  tipo: "deposito" | "retiro";
  concepto: string;
  fecha: Timestamp;
  userId: string;
}

interface Prestamo {
  id: string;
  deudor: string;
  montoOriginal: number;
  montoPagado: number;
  estado: "pendiente" | "parcial" | "pagado";
  fechaPrestamo: Timestamp;
  fechaEstimadaPago?: Timestamp;
  notas?: string;
  userId: string;
}

interface PrestamoPago {
  id: string;
  prestamoId: string;
  monto: number;
  fecha: Timestamp;
  nota?: string;
  userId: string;
}

export default function AhorrosPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"prestamos" | "base" | "proyecciones">("prestamos");

  // Estado Firestore
  const [ahorroMovs, setAhorroMovs] = useState<AhorroMovimiento[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [prestamoPagos, setPrestamoPagos] = useState<PrestamoPago[]>([]);

  // Drawers
  const [isAhorroDrawerOpen, setIsAhorroDrawerOpen] = useState(false);
  const [isPrestamoDrawerOpen, setIsPrestamoDrawerOpen] = useState(false);
  const [isAbonoDrawerOpen, setIsAbonoDrawerOpen] = useState(false);

  // Forms
  const [nuevoAhorro, setNuevoAhorro] = useState({ monto: "", concepto: "", tipo: "deposito" as "deposito" | "retiro" });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ deudor: "", monto: "", fechaEstimada: "", notas: "" });
  const [nuevoAbono, setNuevoAbono] = useState({ prestamoId: "", monto: "", nota: "", registrarComoIngreso: true });

  const [selectedPrestamoDetail, setSelectedPrestamoDetail] = useState<Prestamo | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Suscripción Movimientos Ahorro Base
    const qAhorro = query(
      collection(db, "ahorro_movimientos"),
      where("userId", "==", user.uid),
      orderBy("fecha", "desc")
    );
    const unsubAhorro = onSnapshot(qAhorro, (snap) => {
      setAhorroMovs(snap.docs.map(d => ({ id: d.id, ...d.data() })) as AhorroMovimiento[]);
    });

    // Suscripción Préstamos
    const qPrestamos = query(
      collection(db, "prestamos"),
      where("userId", "==", user.uid),
      orderBy("fechaPrestamo", "desc")
    );
    const unsubPrestamos = onSnapshot(qPrestamos, (snap) => {
      setPrestamos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Prestamo[]);
    });

    // Suscripción Abonos
    const qPagos = query(
      collection(db, "prestamo_pagos"),
      where("userId", "==", user.uid),
      orderBy("fecha", "desc")
    );
    const unsubPagos = onSnapshot(qPagos, (snap) => {
      setPrestamoPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PrestamoPago[]);
    });

    return () => {
      unsubAhorro();
      unsubPrestamos();
      unsubPagos();
    };
  }, [user]);

  // Métricas Calculadas
  const ahorroBaseTotal = useMemo(() => {
    return ahorroMovs.reduce((acc, curr) => {
      return curr.tipo === "deposito" ? acc + curr.monto : acc - curr.monto;
    }, 0);
  }, [ahorroMovs]);

  const prestamosActivos = useMemo(() => {
    return prestamos.filter(p => p.estado !== "pagado");
  }, [prestamos]);

  const prestamosPendientesTotal = useMemo(() => {
    return prestamosActivos.reduce((acc, curr) => acc + (curr.montoOriginal - curr.montoPagado), 0);
  }, [prestamosActivos]);

  const ahorroDisponible = useMemo(() => {
    return ahorroBaseTotal - prestamosPendientesTotal;
  }, [ahorroBaseTotal, prestamosPendientesTotal]);

  const porcentajePrestado = useMemo(() => {
    if (ahorroBaseTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (prestamosPendientesTotal / ahorroBaseTotal) * 100));
  }, [ahorroBaseTotal, prestamosPendientesTotal]);

  // Handlers para Ahorro Base
  const handleSaveAhorro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nuevoAhorro.monto || !nuevoAhorro.concepto) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "ahorro_movimientos"), {
        userId: user.uid,
        monto: parseFloat(nuevoAhorro.monto),
        tipo: nuevoAhorro.tipo,
        concepto: nuevoAhorro.concepto.trim(),
        fecha: Timestamp.now()
      });
      setNuevoAhorro({ monto: "", concepto: "", tipo: "deposito" });
      setIsAhorroDrawerOpen(false);
    } catch (err) {
      console.error("Error al guardar movimiento de ahorro:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAhorroMov = async (id: string) => {
    if (!confirm("¿Eliminar este registro de movimiento de ahorro?")) return;
    try {
      await deleteDoc(doc(db, "ahorro_movimientos", id));
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers para Préstamos
  const handleSavePrestamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nuevoPrestamo.deudor || !nuevoPrestamo.monto) return;
    setIsSubmitting(true);
    try {
      const fechaEst = nuevoPrestamo.fechaEstimada 
        ? Timestamp.fromDate(new Date(nuevoPrestamo.fechaEstimada + "T12:00:00")) 
        : null;

      await addDoc(collection(db, "prestamos"), {
        userId: user.uid,
        deudor: nuevoPrestamo.deudor.trim(),
        montoOriginal: parseFloat(nuevoPrestamo.monto),
        montoPagado: 0,
        estado: "pendiente",
        fechaPrestamo: Timestamp.now(),
        fechaEstimadaPago: fechaEst,
        notas: nuevoPrestamo.notas.trim() || null
      });

      setNuevoPrestamo({ deudor: "", monto: "", fechaEstimada: "", notas: "" });
      setIsPrestamoDrawerOpen(false);
    } catch (err) {
      console.error("Error al registrar préstamo:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers para Abonos
  const handleSaveAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nuevoAbono.prestamoId || !nuevoAbono.monto) return;
    setIsSubmitting(true);
    try {
      const montoAbono = parseFloat(nuevoAbono.monto);
      const targetPrestamo = prestamos.find(p => p.id === nuevoAbono.prestamoId);
      if (!targetPrestamo) return;

      // 1. Guardar pago de préstamo
      const abonoRef = await addDoc(collection(db, "prestamo_pagos"), {
        userId: user.uid,
        prestamoId: nuevoAbono.prestamoId,
        monto: montoAbono,
        fecha: Timestamp.now(),
        nota: nuevoAbono.nota.trim() || `Abono de ${targetPrestamo.deudor}`
      });

      // 2. Si el usuario eligió registrar como ingreso en quincena actual
      if (nuevoAbono.registrarComoIngreso) {
        await addDoc(collection(db, "movimientos"), {
          userId: user.uid,
          nombre: `Pago préstamo: ${targetPrestamo.deudor}`,
          monto: montoAbono,
          tipo: "ingreso",
          fecha: Timestamp.now(),
          prestamoId: targetPrestamo.id,
          agrupadorId: null,
          segmentoId: null
        });
      }

      // 3. Actualizar préstamo (montoPagado y estado)
      const nuevoMontoPagado = targetPrestamo.montoPagado + montoAbono;
      const nuevoEstado: "pendiente" | "parcial" | "pagado" = 
        nuevoMontoPagado >= targetPrestamo.montoOriginal ? "pagado" : "parcial";

      await updateDoc(doc(db, "prestamos", targetPrestamo.id), {
        montoPagado: nuevoMontoPagado,
        estado: nuevoEstado
      });

      setNuevoAbono({ prestamoId: "", monto: "", nota: "", registrarComoIngreso: true });
      setIsAbonoDrawerOpen(false);
    } catch (err) {
      console.error("Error al registrar abono:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrestamo = async (p: Prestamo) => {
    if (!confirm(`¿Eliminar el préstamo a ${p.deudor}? Se borrarán también los abonos registrados.`)) return;
    try {
      // Eliminar abonos asociados
      const pagosAsociados = prestamoPagos.filter(pag => pag.prestamoId === p.id);
      for (const pag of pagosAsociados) {
        await deleteDoc(doc(db, "prestamo_pagos", pag.id));
      }
      await deleteDoc(doc(db, "prestamos", p.id));
      if (selectedPrestamoDetail?.id === p.id) {
        setSelectedPrestamoDetail(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background flex flex-col items-center pb-28">
        <div className="w-full max-w-[500px] flex flex-col min-h-screen p-6">
          
          {/* Header */}
          <header className="flex justify-between items-center py-6 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-nu-purple rounded-2xl shadow-lg shadow-nu-purple/20">
                <PiggyBank className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mis Ahorros</h1>
                <p className="text-xs font-bold text-slate-400">Control de Fondo & Préstamos</p>
              </div>
            </div>
            <button
              onClick={() => setIsAhorroDrawerOpen(true)}
              className="p-3 bg-nu-purple-light text-nu-purple rounded-2xl hover:bg-nu-purple/20 transition-colors"
              title="Aportar o retirar ahorro base"
            >
              <Plus className="w-5 h-5" />
            </button>
          </header>

          {/* Tarjeta Nu de Balance de Ahorros */}
          <section className="bg-gradient-to-br from-nu-purple to-[#5a0695] p-7 rounded-[2.5rem] text-white shadow-2xl shadow-nu-purple/30 relative overflow-hidden space-y-6 mb-6">
            {/* Círculo decorativo */}
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-200 opacity-90">
                  Ahorro Total Acumulado
                </span>
                <h2 className="text-4xl font-black tracking-tight mt-1">
                  ${ahorroBaseTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/15 px-3 py-1 rounded-full text-white backdrop-blur-md border border-white/10">
                Base Real
              </span>
            </div>

            {/* Sub-métricas: Préstamos Activos y Disponible */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/15">
              <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <HandCoins className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-200">En Préstamos</span>
                </div>
                <p className="text-lg font-black text-amber-300">
                  ${prestamosPendientesTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-200">Disponible Libres</span>
                </div>
                <p className="text-lg font-black text-emerald-300">
                  ${ahorroDisponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Barra de Liquidez */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[9px] font-black text-purple-200">
                <span>Liquidez Efectiva: {(100 - porcentajePrestado).toFixed(0)}%</span>
                <span>Prestado: {porcentajePrestado.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, 100 - porcentajePrestado)}%` }}
                />
              </div>
            </div>
          </section>

          {/* Botones Rápidos de Acción */}
          <section className="grid grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => setIsPrestamoDrawerOpen(true)}
              className="flex items-center justify-center gap-2.5 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-nu-purple/30 transition-all group active:scale-95"
            >
              <div className="w-10 h-10 bg-nu-purple-light rounded-xl flex items-center justify-center text-nu-purple group-hover:scale-105 transition-transform">
                <HandCoins className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-black text-slate-800">Nuevo Préstamo</span>
                <span className="block text-[9px] font-bold text-slate-400">Prestar dinero</span>
              </div>
            </button>

            <button
              onClick={() => {
                if (prestamosActivos.length === 0) {
                  alert("No tienes préstamos pendientes para abonar.");
                  return;
                }
                setNuevoAbono(prev => ({ ...prev, prestamoId: prestamosActivos[0].id }));
                setIsAbonoDrawerOpen(true);
              }}
              className="flex items-center justify-center gap-2.5 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-500/30 transition-all group active:scale-95"
            >
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-black text-slate-800">Registrar Abono</span>
                <span className="block text-[9px] font-bold text-slate-400">Recuperar dinero</span>
              </div>
            </button>
          </section>

          {/* Selector de Pestañas */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
            <button
              onClick={() => setActiveTab("prestamos")}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                activeTab === "prestamos" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"
              }`}
            >
              Préstamos ({prestamosActivos.length})
            </button>
            <button
              onClick={() => setActiveTab("base")}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                activeTab === "base" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"
              }`}
            >
              Fondo Base
            </button>
            <button
              onClick={() => setActiveTab("proyecciones")}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${
                activeTab === "proyecciones" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"
              }`}
            >
              Proyecciones
            </button>
          </div>

          {/* CONTENIDO DE PESTAÑAS */}

          {/* Tab 1: Préstamos */}
          {activeTab === "prestamos" && (
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Seguimiento de Préstamos
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {prestamos.length} registrado(s)
                </span>
              </div>

              {prestamos.map((p) => {
                const porcentaje = p.montoOriginal > 0 ? (p.montoPagado / p.montoOriginal) * 100 : 0;
                const esPagado = p.estado === "pagado";
                const saldoPendiente = p.montoOriginal - p.montoPagado;

                return (
                  <div
                    key={p.id}
                    className={`bg-white border p-5 rounded-[2rem] shadow-sm transition-all space-y-4 ${
                      esPagado ? "border-emerald-100 opacity-75" : "border-slate-100 hover:border-nu-purple/20"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm ${
                          esPagado ? "bg-emerald-100 text-emerald-600" : "bg-purple-100 text-nu-purple"
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-base leading-tight">{p.deudor}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {p.fechaPrestamo?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            </span>
                            {p.fechaEstimadaPago && !esPagado && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Cobrar: {p.fechaEstimadaPago?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          esPagado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                        }`}>
                          {esPagado ? "Pagado ✓" : `Pend: $${saldoPendiente.toLocaleString()}`}
                        </span>
                        <p className="text-xs font-bold text-slate-400 mt-1">
                          Total: ${p.montoOriginal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Barra de progreso del préstamo */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Recuperado: ${p.montoPagado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        <span>{porcentaje.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            esPagado ? "bg-emerald-500" : "bg-nu-purple"
                          }`}
                          style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        />
                      </div>
                    </div>

                    {p.notas && (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        "{p.notas}"
                      </p>
                    )}

                    {/* Acciones de la tarjeta de préstamo */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <button
                        onClick={() => setSelectedPrestamoDetail(p)}
                        className="text-xs font-bold text-slate-500 hover:text-nu-purple flex items-center gap-1"
                      >
                        Ver abonos ({prestamoPagos.filter(pag => pag.prestamoId === p.id).length})
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        {!esPagado && (
                          <button
                            onClick={() => {
                              setNuevoAbono(prev => ({ ...prev, prestamoId: p.id }));
                              setIsAbonoDrawerOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-transform"
                          >
                            + Abono
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePrestamo(p)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                          title="Eliminar préstamo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {prestamos.length === 0 && (
                <div className="py-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center space-y-3">
                  <HandCoins className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-slate-400 font-medium text-sm">No tienes préstamos registrados</p>
                  <button
                    onClick={() => setIsPrestamoDrawerOpen(true)}
                    className="px-5 py-2.5 bg-nu-purple text-white rounded-2xl text-xs font-bold shadow-md"
                  >
                    Registrar Primer Préstamo
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Fondo Base (Aportes y Retiros) */}
          {activeTab === "base" && (
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Movimientos del Fondo Base
                </h3>
                <button
                  onClick={() => setIsAhorroDrawerOpen(true)}
                  className="text-xs font-bold text-nu-purple flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Nuevo Registro
                </button>
              </div>

              <div className="space-y-3">
                {ahorroMovs.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        m.tipo === "deposito" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                      }`}>
                        {m.tipo === "deposito" ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{m.concepto}</h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {m.fecha?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`font-black text-base ${
                        m.tipo === "deposito" ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {m.tipo === "deposito" ? "+" : "-"}${m.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => handleDeleteAhorroMov(m.id)}
                        className="text-slate-200 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {ahorroMovs.length === 0 && (
                  <div className="py-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center">
                    <p className="text-slate-400 font-medium text-sm">No hay registros de depósitos ni retiros</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tab 3: Proyecciones e Histórico */}
          {activeTab === "proyecciones" && (
            <section className="space-y-6">
              {/* Tarjeta Resumen Proyección */}
              <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-nu-purple" />
                  Análisis de Recuperación de Préstamos
                </h3>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      Monto Total Prestado
                    </span>
                    <p className="text-xl font-black text-slate-800">
                      ${prestamos.reduce((a, c) => a + c.montoOriginal, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      Recuperado a la Fecha
                    </span>
                    <p className="text-xl font-black text-emerald-600">
                      ${prestamos.reduce((a, c) => a + c.montoPagado, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-nu-purple">Tasa de Recuperación Global</span>
                    <span className="text-xs font-black text-nu-purple">
                      {prestamos.reduce((a, c) => a + c.montoOriginal, 0) > 0 
                        ? ((prestamos.reduce((a, c) => a + c.montoPagado, 0) / prestamos.reduce((a, c) => a + c.montoOriginal, 0)) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-purple-200/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nu-purple rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          prestamos.reduce((a, c) => a + c.montoOriginal, 0) > 0
                            ? Math.min(100, (prestamos.reduce((a, c) => a + c.montoPagado, 0) / prestamos.reduce((a, c) => a + c.montoOriginal, 0)) * 100)
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Gráfico SVG de la Curva de Saldos */}
              <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Evolución: Ahorro Base vs Disponible
                  </h3>
                </div>

                {/* Visual SVG Micro Chart */}
                <div className="relative h-44 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-nu-purple inline-block"/> Base Total (${ahorroBaseTotal.toLocaleString()})</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Disponible (${ahorroDisponible.toLocaleString()})</span>
                  </div>

                  <svg className="w-full h-24 overflow-visible" viewBox="0 0 300 80">
                    {/* Líneas de referencia */}
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />

                    {/* Curva Ahorro Base */}
                    <path
                      d="M 10 60 Q 75 45, 150 30 T 290 20"
                      fill="none"
                      stroke="#820ad1"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* Curva Ahorro Disponible */}
                    <path
                      d={`M 10 70 Q 75 60, 150 45 T 290 ${Math.max(20, 70 - (ahorroDisponible / (ahorroBaseTotal || 1)) * 50)}`}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray="4 2"
                      strokeLinecap="round"
                    />

                    {/* Puntos destacados */}
                    <circle cx="290" cy="20" r="5" fill="#820ad1" />
                    <circle cx="290" cy={Math.max(20, 70 - (ahorroDisponible / (ahorroBaseTotal || 1)) * 50)} r="5" fill="#10b981" />
                  </svg>

                  <p className="text-[10px] text-center font-bold text-slate-400">
                    Al cobrarse los préstamos pendientes (+${prestamosPendientesTotal.toLocaleString()}), tu disponible alcanzará el 100% de la base.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* DRAWERS Y MODALES */}

          {/* Drawer 1: Aportar / Retirar Ahorro Base */}
          <BottomDrawer
            isOpen={isAhorroDrawerOpen}
            onClose={() => setIsAhorroDrawerOpen(false)}
            title="Movimiento de Fondo Base"
          >
            <form onSubmit={handleSaveAhorro} className="space-y-6">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setNuevoAhorro({ ...nuevoAhorro, tipo: "deposito" })}
                  className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all ${
                    nuevoAhorro.tipo === "deposito" ? "bg-white text-emerald-600 shadow-md" : "text-slate-500"
                  }`}
                >
                  + Depósito / Aporte
                </button>
                <button
                  type="button"
                  onClick={() => setNuevoAhorro({ ...nuevoAhorro, tipo: "retiro" })}
                  className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all ${
                    nuevoAhorro.tipo === "retiro" ? "bg-white text-red-600 shadow-md" : "text-slate-500"
                  }`}
                >
                  - Retiro Definitivo
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Concepto / Detalle
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ahorro de aguinaldo, Aporte mensual..."
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800"
                  value={nuevoAhorro.concepto}
                  onChange={(e) => setNuevoAhorro({ ...nuevoAhorro, concepto: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Monto</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-12 pr-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800 text-2xl"
                    value={nuevoAhorro.monto}
                    onChange={(e) => setNuevoAhorro({ ...nuevoAhorro, monto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button
                disabled={isSubmitting}
                className={`w-full text-white font-black py-5 rounded-[1.5rem] shadow-xl text-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
                  nuevoAhorro.tipo === "deposito" ? "bg-emerald-600 shadow-emerald-900/20" : "bg-red-600 shadow-red-900/20"
                }`}
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Guardar Movimiento de Ahorro"}
              </button>
            </form>
          </BottomDrawer>

          {/* Drawer 2: Nuevo Préstamo */}
          <BottomDrawer
            isOpen={isPrestamoDrawerOpen}
            onClose={() => setIsPrestamoDrawerOpen(false)}
            title="Registrar Nuevo Préstamo"
          >
            <form onSubmit={handleSavePrestamo} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  ¿A quién le prestas? (Deudor)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Hermano, Mamá, Auto-préstamo quincenal..."
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800"
                  value={nuevoPrestamo.deudor}
                  onChange={(e) => setNuevoPrestamo({ ...nuevoPrestamo, deudor: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Monto Prestado</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-12 pr-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800 text-2xl"
                    value={nuevoPrestamo.monto}
                    onChange={(e) => setNuevoPrestamo({ ...nuevoPrestamo, monto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Fecha Estimada de Pago (Opcional)
                </label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-sm"
                  value={nuevoPrestamo.fechaEstimada}
                  onChange={(e) => setNuevoPrestamo({ ...nuevoPrestamo, fechaEstimada: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Notas / Recordatorio (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Lo repondrá el día 15..."
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-medium text-slate-700 text-sm"
                  value={nuevoPrestamo.notas}
                  onChange={(e) => setNuevoPrestamo({ ...nuevoPrestamo, notas: e.target.value })}
                />
              </div>

              <button
                disabled={isSubmitting}
                className="w-full bg-nu-purple text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-nu-purple/30 text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Guardar Préstamo"}
              </button>
            </form>
          </BottomDrawer>

          {/* Drawer 3: Registrar Abono */}
          <BottomDrawer
            isOpen={isAbonoDrawerOpen}
            onClose={() => setIsAbonoDrawerOpen(false)}
            title="Registrar Abono a Préstamo"
          >
            <form onSubmit={handleSaveAbono} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Seleccionar Préstamo
                </label>
                <select
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-base appearance-none"
                  value={nuevoAbono.prestamoId}
                  onChange={(e) => setNuevoAbono({ ...nuevoAbono, prestamoId: e.target.value })}
                  required
                >
                  <option value="">Selecciona a quién te abonaron</option>
                  {prestamosActivos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.deudor} — Pendiente: ${(p.montoOriginal - p.montoPagado).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Monto del Abono
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] pl-12 pr-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800 text-2xl"
                    value={nuevoAbono.monto}
                    onChange={(e) => setNuevoAbono({ ...nuevoAbono, monto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Nota / Observación (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial en efectivo"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-sm"
                  value={nuevoAbono.nota}
                  onChange={(e) => setNuevoAbono({ ...nuevoAbono, nota: e.target.value })}
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-[1.5rem] flex items-center justify-between cursor-pointer"
                onClick={() => setNuevoAbono({ ...nuevoAbono, registrarComoIngreso: !nuevoAbono.registrarComoIngreso })}
              >
                <div className="pr-2">
                  <span className="block text-xs font-black text-emerald-900">Vincular con Quincena Actual</span>
                  <span className="block text-[10px] text-emerald-700 font-medium">Registra también un ingreso en la lista de movimientos de tu quincena</span>
                </div>
                <input
                  type="checkbox"
                  checked={nuevoAbono.registrarComoIngreso}
                  onChange={() => {}} // controlado por div
                  className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <button
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-emerald-900/20 text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar Abono"}
              </button>
            </form>
          </BottomDrawer>

          {/* Drawer 4: Historial de Abonos por Préstamo */}
          {selectedPrestamoDetail && (
            <BottomDrawer
              isOpen={!!selectedPrestamoDetail}
              onClose={() => setSelectedPrestamoDetail(null)}
              title={`Historial: ${selectedPrestamoDetail.deudor}`}
            >
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Prestado</span>
                  <p className="text-3xl font-black text-slate-900">
                    ${selectedPrestamoDetail.montoOriginal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs font-bold text-emerald-600">
                    Pagado: ${selectedPrestamoDetail.montoPagado.toLocaleString('es-ES', { minimumFractionDigits: 2 })} | Pendiente: ${(selectedPrestamoDetail.montoOriginal - selectedPrestamoDetail.montoPagado).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abonos Recibidos</h4>
                  {prestamoPagos
                    .filter(pag => pag.prestamoId === selectedPrestamoDetail.id)
                    .map(pag => (
                      <div key={pag.id} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-2xl">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{pag.nota || "Abono a préstamo"}</p>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {pag.fecha?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <span className="font-black text-emerald-600 text-base">
                          +${pag.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}

                  {prestamoPagos.filter(pag => pag.prestamoId === selectedPrestamoDetail.id).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">Aún no hay abonos para este préstamo</p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPrestamoDetail(null)}
                  className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </BottomDrawer>
          )}

          {/* Navegación Inferior */}
          <Navbar />
        </div>
      </main>
    </ProtectedRoute>
  );
}
