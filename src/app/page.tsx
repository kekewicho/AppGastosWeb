"use client";

import { useState, useEffect, useMemo } from "react";
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
  where,
  updateDoc,
  writeBatch
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
  Zap,
  FileText,
  SlidersHorizontal,
  X,
  Sparkles,
  Brain,
  CheckSquare,
  Check,
  CalendarDays,
  MoveRight
} from "lucide-react";
import Link from "next/link";
import { 
  getQuincenaRange, 
  getNextQuincena, 
  getPreviousQuincena,
  getNextNQuincenas,
  QuincenaRange 
} from "@/lib/dateUtils";
import BottomDrawer from "@/components/BottomDrawer";
import ParcialidadesDrawer from "@/components/ParcialidadesDrawer";
import Navbar from "@/components/Navbar";
import { CreditCard as CardIcon, PiggyBank, HandCoins } from "lucide-react";
import { useUserConfig } from "@/hooks/useUserConfig";
import { useGeminiKey } from "@/hooks/useGeminiKey";
import { suggestSegment } from "@/lib/gemini";

interface Movimiento {
  id: string;
  nombre: string;
  monto: number;
  tipo: "ingreso" | "egreso";
  fecha: Timestamp;
  userId: string;
  agrupadorId?: string;
  segmentoId?: string;
  prestamoId?: string;
}

interface Agrupador {
  id: string;
  nombre: string;
  userId: string;
}

interface PrestamoSimple {
  id: string;
  deudor: string;
  montoOriginal: number;
  montoPagado: number;
}

type NuevoMovimiento = Omit<Movimiento, "id" | "fecha" | "userId" | "monto"> & {
  monto: string;
};

export default function Home() {
  const { user, loading } = useAuth();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([]);
  const [prestamosActivos, setPrestamosActivos] = useState<PrestamoSimple[]>([]);
  const [nuevoMovimiento, setNuevoMovimiento] = useState<NuevoMovimiento>({ nombre: "", monto: "", tipo: "egreso" as const, agrupadorId: "", segmentoId: "", prestamoId: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isParcialidadesOpen, setIsParcialidadesOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoadingRecurrentes, setIsLoadingRecurrentes] = useState(false);

  // Configuración de segmentos y Gemini
  const { config } = useUserConfig();
  const { getKey } = useGeminiKey();
  const [isClassifying, setIsClassifying] = useState(false);
  const [showAiBadge, setShowAiBadge] = useState(false);
  const [lastClassifiedName, setLastClassifiedName] = useState("");

  // Filtros locales
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [filterAgrupadorId, setFilterAgrupadorId] = useState("");

  // Selección múltiple y acciones por lote
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMoveDrawerOpen, setIsMoveDrawerOpen] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  
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

    // Suscripción a agrupadores
    const qAgr = query(collection(db, "agrupadores"), where("userId", "==", user.uid));
    const unsubAgr = onSnapshot(qAgr, (snap) => {
      setAgrupadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Agrupador[]);
    });

    // Suscripción a préstamos pendientes/parciales
    const qPrest = query(collection(db, "prestamos"), where("userId", "==", user.uid));
    const unsubPrest = onSnapshot(qPrest, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as any)
        .filter(p => p.estado !== "pagado")
        .map(p => ({ id: p.id, deudor: p.deudor, montoOriginal: p.montoOriginal, montoPagado: p.montoPagado }));
      setPrestamosActivos(data);
    });

    return () => {
      unsubscribe();
      unsubAgr();
      unsubPrest();
    };
  }, [user, currentRange]);

  const handleDescriptionBlur = async () => {
    // Si la descripción está vacía, no es egreso, o es igual a la última clasificada, salimos temprano
    if (!config.segmentsEnabled || !nuevoMovimiento.nombre.trim() || nuevoMovimiento.nombre === lastClassifiedName || nuevoMovimiento.tipo !== "egreso") return;
    const key = getKey();
    if (!key) return;

    setIsClassifying(true);
    try {
      const suggestedId = await suggestSegment(
        nuevoMovimiento.nombre,
        config.segments,
        key
      );
      if (suggestedId) {
        setNuevoMovimiento(prev => ({
          ...prev,
          segmentoId: suggestedId
        }));
        setLastClassifiedName(nuevoMovimiento.nombre);
        setShowAiBadge(true);
      }
    } catch (err) {
      console.error("Error al clasificar con Gemini:", err);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmitMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMovimiento.nombre || !nuevoMovimiento.monto || !user) return;
    setIsAdding(true);
    try {
      const montoNum = parseFloat(nuevoMovimiento.monto);
      const movementData = {
        nombre: nuevoMovimiento.nombre,
        monto: montoNum,
        tipo: nuevoMovimiento.tipo,
        userId: user.uid,
        agrupadorId: nuevoMovimiento.agrupadorId || null,
        segmentoId: config.segmentsEnabled && nuevoMovimiento.tipo === "egreso" ? (nuevoMovimiento.segmentoId || null) : null,
        prestamoId: nuevoMovimiento.tipo === "ingreso" && nuevoMovimiento.prestamoId ? nuevoMovimiento.prestamoId : null
      };

      const todayRange = getQuincenaRange(new Date());
      const isCurrentQuincena =
        currentRange.start.getTime() === todayRange.start.getTime() &&
        currentRange.end.getTime() === todayRange.end.getTime();
      
      const fechaMovimiento = isCurrentQuincena 
        ? Timestamp.now() 
        : Timestamp.fromDate(currentRange.start);

      if (editingId) {
        await updateDoc(doc(db, "movimientos", editingId), movementData);
      } else {
        const movRef = await addDoc(collection(db, "movimientos"), {
          ...movementData,
          fecha: fechaMovimiento,
        });

        // Si se vinculó a un préstamo al crear un ingreso
        if (nuevoMovimiento.tipo === "ingreso" && nuevoMovimiento.prestamoId) {
          const targetPrestamo = prestamosActivos.find(p => p.id === nuevoMovimiento.prestamoId);
          if (targetPrestamo) {
            await addDoc(collection(db, "prestamo_pagos"), {
              userId: user.uid,
              prestamoId: targetPrestamo.id,
              monto: montoNum,
              fecha: fechaMovimiento,
              nota: `Abono desde ingreso quincenal: ${nuevoMovimiento.nombre}`,
              movimientoId: movRef.id
            });

            const nuevoMontoPagado = targetPrestamo.montoPagado + montoNum;
            const nuevoEstado = nuevoMontoPagado >= targetPrestamo.montoOriginal ? "pagado" : "parcial";
            await updateDoc(doc(db, "prestamos", targetPrestamo.id), {
              montoPagado: nuevoMontoPagado,
              estado: nuevoEstado
            });
          }
        }
      }
      
      resetForm();
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Error al procesar movimiento", error);
    } finally {
      setIsAdding(false);
    }
  };

  const resetForm = () => {
    setNuevoMovimiento({ nombre: "", monto: "", tipo: "egreso", agrupadorId: "", segmentoId: "", prestamoId: "" });
    setEditingId(null);
    setShowAiBadge(false);
    setLastClassifiedName("");
  };

  const handleEditClick = (mov: Movimiento) => {
    setNuevoMovimiento({
      nombre: mov.nombre,
      monto: mov.monto.toString(),
      tipo: mov.tipo,
      agrupadorId: mov.agrupadorId || "",
      segmentoId: mov.segmentoId || "",
      prestamoId: mov.prestamoId || ""
    });
    setEditingId(mov.id);
    setIsDrawerOpen(true);
    setShowAiBadge(false);
    setLastClassifiedName(mov.nombre);
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

  const navNext = () => {
    setSelectedIds(new Set());
    setCurrentRange(getNextQuincena(currentRange));
  };
  const navPrev = () => {
    setSelectedIds(new Set());
    setCurrentRange(getPreviousQuincena(currentRange));
  };
  const navToday = () => {
    setSelectedIds(new Set());
    setCurrentRange(getQuincenaRange(new Date()));
  };

  const toggleSelectMode = () => {
    if (isSelectingMode) {
      setSelectedIds(new Set());
    }
    setIsSelectingMode(!isSelectingMode);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMovimientos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMovimientos.map(m => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !user) return;
    if (!confirm(`¿Estás seguro de eliminar los ${selectedIds.size} movimientos seleccionados?`)) return;

    setIsProcessingBulk(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "movimientos", id));
      });
      await batch.commit();
      setSelectedIds(new Set());
      setIsSelectingMode(false);
    } catch (err) {
      console.error("Error al eliminar movimientos en lote", err);
      alert("Hubo un error al eliminar los movimientos.");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkMoveQuincena = async (targetRange: QuincenaRange) => {
    if (selectedIds.size === 0 || !user) return;
    setIsProcessingBulk(true);
    try {
      const batch = writeBatch(db);
      const targetTimestamp = Timestamp.fromDate(targetRange.start);
      selectedIds.forEach(id => {
        batch.update(doc(db, "movimientos", id), {
          fecha: targetTimestamp
        });
      });
      await batch.commit();
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setIsSelectingMode(false);
      setIsMoveDrawerOpen(false);
      alert(`✓ ${count} ${count === 1 ? "movimiento movido" : "movimientos movidos"} a ${targetRange.label}`);
    } catch (err) {
      console.error("Error al mover movimientos de quincena", err);
      alert("Hubo un error al mover los movimientos.");
    } finally {
      setIsProcessingBulk(false);
    }
  };

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

      // Determinar la fecha a usar:
      // Si el usuario está posicionado en la quincena actual → Timestamp.now()
      // Si está en otra quincena (planeando con anticipación) → inicio del rango seleccionado
      const todayRange = getQuincenaRange(new Date());
      const isCurrentQuincena =
        currentRange.start.getTime() === todayRange.start.getTime() &&
        currentRange.end.getTime() === todayRange.end.getTime();
      const fechaMovimiento = isCurrentQuincena
        ? Timestamp.now()
        : Timestamp.fromDate(currentRange.start);

      const { writeBatch: wb, doc: fsDoc, collection: fsColl } = await import("firebase/firestore");
      const batch = wb(db);
      snap.docs.forEach(recDoc => {
        const data = recDoc.data();
        const ref = fsDoc(fsColl(db, "movimientos"));
        batch.set(ref, {
          nombre: data.nombre,
          monto: data.monto,
          tipo: data.tipo,
          fecha: fechaMovimiento,
          userId: user.uid,
          recurrente: true,
          agrupadorId: data.agrupadorId || null
        });
      });
      await batch.commit();
      alert(`✓ ${snap.size} movimientos recurrentes cargados en ${isCurrentQuincena ? "esta quincena" : currentRange.label}`);
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

  // Cálculos para la selección múltiple
  const selectedMovimientos = useMemo(() => {
    return movimientos.filter(m => selectedIds.has(m.id));
  }, [movimientos, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedMovimientos.reduce((acc, m) => acc + m.monto, 0);
  }, [selectedMovimientos]);

  const selectedEgresos = useMemo(() => {
    return selectedMovimientos
      .filter(m => m.tipo === "egreso")
      .reduce((acc, m) => acc + m.monto, 0);
  }, [selectedMovimientos]);

  const selectedIngresos = useMemo(() => {
    return selectedMovimientos
      .filter(m => m.tipo === "ingreso")
      .reduce((acc, m) => acc + m.monto, 0);
  }, [selectedMovimientos]);

  // Si los movimientos seleccionados salieran de esta quincena (al moverlos o eliminarlos)
  const balanceProyectado = balance - selectedIngresos + selectedEgresos;
  const deficitActual = balance < 0 ? Math.abs(balance) : 0;
  const restanteExcedente = deficitActual > 0 ? deficitActual - selectedEgresos : 0;

  const segmentCalculations = useMemo(() => {
    if (!config || !config.segmentsEnabled) return [];

    const baseAmount = totalIngresos > 0 ? totalIngresos : totalEgresos;

    return config.segments.map(s => {
      const actualSpend = movimientos
        .filter(m => m.tipo === "egreso" && m.segmentoId === s.id)
        .reduce((sum, m) => sum + m.monto, 0);

      const metaMonto = baseAmount * (s.porcentaje / 100);
      const progressPercent = metaMonto > 0 ? (actualSpend / metaMonto) * 100 : 0;
      const shareOfTotalSpend = totalEgresos > 0 ? (actualSpend / totalEgresos) * 100 : 0;

      return {
        ...s,
        actualSpend,
        metaMonto,
        progressPercent,
        shareOfTotalSpend
      };
    });
  }, [movimientos, config, totalIngresos, totalEgresos]);

  // Filtrado local sin refetch
  const filteredMovimientos = useMemo(() => {
    return movimientos.filter(m => {
      if (filterFechaDesde) {
        const desde = new Date(filterFechaDesde + "T00:00:00");
        if (m.fecha.toDate() < desde) return false;
      }
      if (filterFechaHasta) {
        const hasta = new Date(filterFechaHasta + "T23:59:59");
        if (m.fecha.toDate() > hasta) return false;
      }
      if (filterAgrupadorId) {
        if (m.agrupadorId !== filterAgrupadorId) return false;
      }
      return true;
    });
  }, [movimientos, filterFechaDesde, filterFechaHasta, filterAgrupadorId]);

  const hasActiveFilters = filterFechaDesde || filterFechaHasta || filterAgrupadorId;

  const clearFilters = () => {
    setFilterFechaDesde("");
    setFilterFechaHasta("");
    setFilterAgrupadorId("");
  };

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
                  onClick={() => {
                    resetForm();
                    setIsDrawerOpen(true);
                  }}
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

                <button 
                  onClick={() => setIsReportOpen(true)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-active:scale-90 transition-transform text-nu-purple hover:border-nu-purple/20 transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Reporte</span>
                </button>
              </div>
            </section>

            {/* Bottom Drawer para Nuevo Movimiento */}
            <BottomDrawer 
              isOpen={isDrawerOpen} 
              onClose={() => {
                setIsDrawerOpen(false);
                resetForm();
              }} 
              title={editingId ? "Editar Movimiento" : "Nuevo Movimiento"}
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

                <form onSubmit={handleSubmitMovimiento} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Descripción</label>
                    <input 
                      type="text" 
                      placeholder="¿En qué gastaste?"
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg"
                      value={nuevoMovimiento.nombre}
                      onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, nombre: e.target.value})}
                      onBlur={handleDescriptionBlur}
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

                  {nuevoMovimiento.tipo === "egreso" && agrupadores.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Agrupador (Opcional)</label>
                      <select 
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg appearance-none"
                        value={nuevoMovimiento.agrupadorId}
                        onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, agrupadorId: e.target.value})}
                      >
                        <option value="">Sin Agrupador</option>
                        {agrupadores.map(a => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {nuevoMovimiento.tipo === "ingreso" && prestamosActivos.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Vincular a Préstamo (Opcional)</label>
                      <select 
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg appearance-none"
                        value={nuevoMovimiento.prestamoId || ""}
                        onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, prestamoId: e.target.value})}
                      >
                        <option value="">Sin Vincular a Préstamo</option>
                        {prestamosActivos.map(p => (
                          <option key={p.id} value={p.id}>Abonar a: {p.deudor} (Pend: ${(p.montoOriginal - p.montoPagado).toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {nuevoMovimiento.tipo === "egreso" && config && config.segmentsEnabled && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-4 mr-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Segmento de Egreso
                        </label>
                        {isClassifying && (
                          <span className="text-[9px] font-bold text-nu-purple animate-pulse flex items-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Clasificando con IA...
                          </span>
                        )}
                        {showAiBadge && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100 animate-bounce">
                            <Sparkles className="w-2.5 h-2.5" /> Sugerido por IA ✨
                          </span>
                        )}
                      </div>
                      <select 
                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg appearance-none"
                        value={nuevoMovimiento.segmentoId || ""}
                        onChange={(e) => {
                          setNuevoMovimiento({...nuevoMovimiento, segmentoId: e.target.value});
                          setLastClassifiedName(nuevoMovimiento.nombre);
                          setShowAiBadge(false);
                        }}
                      >
                        <option value="">Sin Clasificar (Libre)</option>
                        {config.segments.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre} ({s.porcentaje}%)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button 
                    disabled={isAdding}
                    className={`w-full text-white font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl text-lg ${nuevoMovimiento.tipo === "egreso" ? "bg-nu-purple shadow-nu-purple/30" : "bg-emerald-600 shadow-emerald-900/20"}`}
                  >
                    {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        {editingId ? "Actualizar" : "Guardar"} Registro
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

            <BottomDrawer
              isOpen={isReportOpen}
              onClose={() => setIsReportOpen(false)}
              title="Distribución de Gastos"
            >
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">Total Egresos</p>
                  <h3 className="text-3xl font-black text-slate-800 text-center">
                    ${totalEgresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Gastos Agrupados */}
                  {Object.entries(
                    movimientos
                      .filter(m => m.tipo === "egreso" && m.agrupadorId)
                      .reduce((acc, m) => {
                        const name = agrupadores.find(a => a.id === m.agrupadorId)?.nombre || "Agrupado";
                        acc[name] = (acc[name] || 0) + m.monto;
                        return acc;
                      }, {} as Record<string, number>)
                  ).map(([nombre, monto]) => (
                    <div key={nombre} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-nu-purple rounded-full" />
                        <span className="font-bold text-slate-700">{nombre}</span>
                      </div>
                      <span className="font-black text-slate-900">${monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}

                  {/* Gastos Individuales (Sin Agrupador) */}
                  {movimientos
                    .filter(m => m.tipo === "egreso" && !m.agrupadorId)
                    .map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl border-dashed">
                        <span className="font-medium text-slate-500 text-sm italic">{m.nombre}</span>
                        <span className="font-bold text-slate-600 text-sm">${m.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  
                  {movimientos.filter(m => m.tipo === "egreso").length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-slate-400 text-sm">No hay egresos en esta quincena</p>
                    </div>
                  )}
                </div>

                {/* Guía de Segmentos 50-30-20 */}
                {config && config.segmentsEnabled && segmentCalculations.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Metas por Segmento ({totalIngresos > 0 ? "Presupuesto Real vs Meta" : "Distribución de Gastos"})
                    </h4>
                    <div className="space-y-4">
                      {segmentCalculations.map((calc) => {
                        const isOverspent = calc.actualSpend > calc.metaMonto && totalIngresos > 0;
                        return (
                          <div key={calc.id} className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: calc.color }} />
                                <span>{calc.nombre}</span>
                                <span className="text-[9px] text-slate-400 font-medium">({calc.porcentaje}%)</span>
                              </div>
                              <span className="font-black text-slate-900">
                                ${calc.actualSpend.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                {totalIngresos > 0 && (
                                  <span className="text-[10px] text-slate-400 font-medium ml-1">
                                    / ${calc.metaMonto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </span>
                            </div>
                            
                            {/* Barra de progreso */}
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden relative">
                              <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${Math.min(totalIngresos > 0 ? calc.progressPercent : calc.shareOfTotalSpend, 100)}%`,
                                  backgroundColor: isOverspent ? "#ef4444" : calc.color
                                }}
                              />
                            </div>

                            <div className="flex justify-between items-center text-[9px] font-bold">
                              <span className={isOverspent ? "text-red-500 font-black" : "text-slate-400"}>
                                {totalIngresos > 0 
                                  ? `${calc.progressPercent.toFixed(0)}% del límite presupuestado`
                                  : `${calc.shareOfTotalSpend.toFixed(0)}% del gasto total`
                                }
                              </span>
                              {isOverspent && (
                                <span className="text-red-500 font-black animate-pulse flex items-center gap-0.5">
                                  ⚠️ Límite excedido
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cerrar Reporte
                </button>
              </div>
            </BottomDrawer>

            {/* Lista Mobile */}
            <section className="space-y-4 pb-32">
              {/* Botón de filtros y selección múltiple */}
              <div className="flex items-center justify-between px-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Actividad de la Quincena</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectMode}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                      isSelectingMode 
                        ? "bg-nu-purple text-white shadow-md shadow-nu-purple/20" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {isSelectingMode ? "Cancelar" : "Seleccionar"}
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-50 px-2 py-1 rounded-full"
                    >
                      <X className="w-3 h-3" />
                      Limpiar
                    </button>
                  )}
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className={`p-1.5 rounded-xl transition-colors ${hasActiveFilters ? "bg-nu-purple text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-bar para Selección Múltiple */}
              {isSelectingMode && (
                <div className="bg-purple-50/80 border border-purple-100 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs font-black text-nu-purple flex items-center gap-2 active:scale-95 transition-transform"
                    >
                      <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${selectedIds.size === filteredMovimientos.length && filteredMovimientos.length > 0 ? "bg-nu-purple border-nu-purple text-white" : "border-slate-300 bg-white"}`}>
                        {selectedIds.size === filteredMovimientos.length && filteredMovimientos.length > 0 && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      {selectedIds.size === filteredMovimientos.length && filteredMovimientos.length > 0 ? "Desmarcar todos" : "Seleccionar todos"}
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedIds.size} de {filteredMovimientos.length} seleccionados
                    </span>
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="pt-2 border-t border-purple-100/90 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">Suma seleccionada:</span>
                      <span className="font-black text-nu-purple text-sm">
                        ${selectedTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Drawer para Filtros */}
              <BottomDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filtrar Movimientos"
              >
                <div className="space-y-8 pb-4">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Rango de Fechas</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-4">Desde</label>
                        <input
                          type="date"
                          value={filterFechaDesde}
                          onChange={e => setFilterFechaDesde(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-700 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-4">Hasta</label>
                        <input
                          type="date"
                          value={filterFechaHasta}
                          onChange={e => setFilterFechaHasta(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {agrupadores.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Agrupador</label>
                      <select
                        value={filterAgrupadorId}
                        onChange={e => setFilterAgrupadorId(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 text-lg appearance-none"
                      >
                        <option value="">Todos los agrupadores</option>
                        {agrupadores.map(a => (
                          <option key={a.id} value={a.id}>{a.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400">
                      {filteredMovimientos.length} resultados encontrados
                    </p>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="px-8 py-4 bg-nu-purple text-white font-black rounded-2xl shadow-lg shadow-nu-purple/20 active:scale-95 transition-transform"
                    >
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </BottomDrawer>
              <div className="space-y-3">
                {filteredMovimientos.map((m) => (
                  <div 
                    key={m.id}
                    onClick={() => {
                      if (isSelectingMode) {
                        toggleSelectItem(m.id);
                      } else {
                        handleEditClick(m);
                      }
                    }}
                    className={`group border p-5 rounded-2xl flex items-center justify-between shadow-sm active:bg-slate-50 transition-all cursor-pointer ${
                      isSelectingMode && selectedIds.has(m.id)
                        ? "bg-purple-50/60 border-nu-purple/40 ring-1 ring-nu-purple/30"
                        : "bg-white border-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {isSelectingMode && (
                        <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center shrink-0 ${
                          selectedIds.has(m.id) 
                            ? "bg-nu-purple border-nu-purple text-white shadow-sm" 
                            : "border-slate-300 bg-white"
                        }`}>
                          {selectedIds.has(m.id) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      )}
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
                          {m.agrupadorId && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">
                              {agrupadores.find(a => a.id === m.agrupadorId)?.nombre || "Agrupado"}
                            </span>
                          )}
                          {config && config.segmentsEnabled && m.segmentoId && (
                            <span 
                              className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase text-white"
                              style={{ backgroundColor: config.segments.find(s => s.id === m.segmentoId)?.color || "#820ad1" }}
                            >
                              {config.segments.find(s => s.id === m.segmentoId)?.nombre || "Segmento"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-black text-base ${m.tipo === "ingreso" ? "text-emerald-600" : "text-slate-900"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}${m.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMovimiento(m);
                        }}
                        className="p-2 text-slate-200 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredMovimientos.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-slate-400 font-medium">
                      {hasActiveFilters ? "Sin resultados para los filtros aplicados" : "No hay registros en este periodo"}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Floating Action Bar para Selección Múltiple */}
        {isSelectingMode && selectedIds.size > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[460px] z-[95] bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-3xl shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-5">
            {/* Encabezado: Monto seleccionado y proyección en el presupuesto */}
            <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Seleccionado</span>
                  <span className="bg-nu-purple text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {selectedIds.size}
                  </span>
                </div>
                <div className="text-xl font-black text-white leading-none">
                  ${selectedTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </div>
                {selectedEgresos > 0 && selectedIngresos > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    Egresos: -${selectedEgresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} · Ingresos: +${selectedIngresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              {/* Indicador de presupuesto / balance de la quincena */}
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  {deficitActual > 0 ? "Excedente Quincenal" : "Balance Proyectado"}
                </span>

                {deficitActual > 0 ? (
                  <div>
                    {restanteExcedente > 0 ? (
                      <span className="inline-block text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                        Falta: ${restanteExcedente.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="inline-block text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                        ✓ Excedente cubierto
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1 font-medium">
                      ${balance.toLocaleString('es-ES', { minimumFractionDigits: 0 })} → <span className={balanceProyectado >= 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>${balanceProyectado.toLocaleString('es-ES', { minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className={`text-base font-black ${balanceProyectado >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      ${balanceProyectado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      (actual: ${balance.toLocaleString('es-ES', { minimumFractionDigits: 0 })})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Fila de botones */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMoveDrawerOpen(true)}
                disabled={isProcessingBulk}
                className="flex-1 bg-nu-purple hover:bg-nu-purple/90 text-white py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-nu-purple/30"
              >
                <CalendarDays className="w-4 h-4" />
                Mover de quincena
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={isProcessingBulk}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                title="Eliminar seleccionados"
              >
                {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="hidden sm:inline">Eliminar</span>
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors active:scale-95"
                title="Limpiar selección"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Drawer para Mover de Quincena */}
        <BottomDrawer
          isOpen={isMoveDrawerOpen}
          onClose={() => setIsMoveDrawerOpen(false)}
          title="Mover Movimientos de Quincena"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Movimientos seleccionados:</span>
                <span className="text-xs font-black text-slate-800">{selectedIds.size}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Suma total a mover:</span>
                <span className="text-base font-black text-nu-purple">
                  ${selectedTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {selectedEgresos > 0 && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Balance resultante de esta quincena:</span>
                  <span className={`font-black ${balanceProyectado >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    ${balanceProyectado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Opción 1: Siguiente quincena */}
              <button
                onClick={() => handleBulkMoveQuincena(getNextQuincena(currentRange))}
                disabled={isProcessingBulk}
                className="w-full bg-white border-2 border-slate-100 hover:border-nu-purple p-4 rounded-2xl flex items-center justify-between text-left transition-all group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-nu-purple-light text-nu-purple rounded-xl group-hover:bg-nu-purple group-hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Siguiente Quincena</span>
                    <h4 className="font-bold text-slate-800 text-sm capitalize">{getNextQuincena(currentRange).label}</h4>
                  </div>
                </div>
                <MoveRight className="w-5 h-5 text-slate-300 group-hover:text-nu-purple transition-colors" />
              </button>

              {/* Opción 2: Quincena anterior */}
              <button
                onClick={() => handleBulkMoveQuincena(getPreviousQuincena(currentRange))}
                disabled={isProcessingBulk}
                className="w-full bg-white border-2 border-slate-100 hover:border-nu-purple p-4 rounded-2xl flex items-center justify-between text-left transition-all group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl group-hover:bg-nu-purple group-hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quincena Anterior</span>
                    <h4 className="font-bold text-slate-800 text-sm capitalize">{getPreviousQuincena(currentRange).label}</h4>
                  </div>
                </div>
                <MoveRight className="w-5 h-5 text-slate-300 group-hover:text-nu-purple transition-colors" />
              </button>

              {/* Opción 3: Próximas quincenas */}
              <div className="pt-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-2 block">
                  Otras Quincenas Futuras
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getNextNQuincenas(currentRange, 6).slice(2).map((qRange, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleBulkMoveQuincena(qRange)}
                      disabled={isProcessingBulk}
                      className="w-full bg-slate-50 hover:bg-white border border-slate-100 hover:border-nu-purple p-3.5 rounded-xl flex items-center justify-between text-left transition-all text-xs font-bold text-slate-700 capitalize"
                    >
                      <span>{qRange.label}</span>
                      <span className="text-[10px] text-nu-purple font-bold">Mover aquí →</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsMoveDrawerOpen(false)}
              className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </BottomDrawer>

        <Navbar />
      </div>
    </main>
  );
}
