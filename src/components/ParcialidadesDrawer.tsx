"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  writeBatch, 
  doc, 
  Timestamp,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Loader2, 
  CreditCard,
  Calculator,
  CalendarDays
} from "lucide-react";
import BottomDrawer from "@/components/BottomDrawer";
import { QuincenaRange, getNextNQuincenas, getQuincenaRange } from "@/lib/dateUtils";
import { useUserConfig } from "@/hooks/useUserConfig";

interface ParcialidadesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRange: QuincenaRange;
}

interface Agrupador {
  id: string;
  nombre: string;
}

export default function ParcialidadesDrawer({ isOpen, onClose, currentRange }: ParcialidadesDrawerProps) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState("");
  const [inputMode, setInputMode] = useState<"total" | "parcial">("total");
  const [montoTotal, setMontoTotal] = useState("");
  const [montoParcial, setMontoParcial] = useState("");
  const [numParcialidades, setNumParcialidades] = useState("12");
  const [agrupadorId, setAgrupadorId] = useState("");
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { config } = useUserConfig();
  const [segmentoId, setSegmentoId] = useState("");

  useEffect(() => {
    if (!user || !isOpen) return;
    const q = query(collection(db, "agrupadores"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAgrupadores(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Agrupador[]);
    });
    return () => unsub();
  }, [user, isOpen]);

  const calculatedParcial = inputMode === "total" && montoTotal && numParcialidades 
    ? (parseFloat(montoTotal) / parseInt(numParcialidades)).toFixed(2)
    : montoParcial;

  const calculatedTotal = inputMode === "parcial" && montoParcial && numParcialidades
    ? (parseFloat(montoParcial) * parseInt(numParcialidades)).toFixed(2)
    : montoTotal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nombre || !numParcialidades) return;
    
    const finalMontoParcial = parseFloat(calculatedParcial);
    const n = parseInt(numParcialidades);
    if (isNaN(finalMontoParcial) || isNaN(n) || n <= 0) return;

    const todayRange = getQuincenaRange(new Date());
    const isCurrentQuincena =
      currentRange.start.getTime() === todayRange.start.getTime() &&
      currentRange.end.getTime() === todayRange.end.getTime();

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const planId = `plan_${Date.now()}`;
      const ranges = getNextNQuincenas(currentRange, n);

      ranges.forEach((range, index) => {
        const docRef = doc(collection(db, "movimientos"));
        
        // Para la primera parcialidad, si es la quincena actual, usamos "ahora"
        // Para las demás o si es quincena futura, usamos el inicio del rango
        const fechaParcialidad = (index === 0 && isCurrentQuincena)
          ? Timestamp.now()
          : Timestamp.fromDate(range.start);

        batch.set(docRef, {
          nombre: `${nombre} (${index + 1}/${n})`,
          monto: finalMontoParcial,
          tipo: "egreso",
          fecha: fechaParcialidad,
          userId: user.uid,
          planId: planId,
          planIndex: index + 1,
          planTotal: n,
          agrupadorId: agrupadorId || null,
          segmentoId: config.segmentsEnabled ? (segmentoId || null) : null
        });
      });

      await batch.commit();
      alert(`Plan de ${n} parcialidades creado con éxito en ${isCurrentQuincena ? "esta quincena" : currentRange.label}`);
      onClose();
      // Reset form
      setNombre("");
      setMontoTotal("");
      setMontoParcial("");
      setSegmentoId("");
    } catch (err) {
      console.error(err);
      alert("Error al crear el plan de parcialidades");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomDrawer isOpen={isOpen} onClose={onClose} title="Plan de Parcialidades">
      <div className="space-y-8">
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
          <CalendarDays className="w-5 h-5 text-amber-600 mt-0.5" />
          <p className="text-xs font-medium text-amber-800 leading-relaxed">
            Este plan creará múltiples registros automáticos comenzando desde el periodo seleccionado: 
            <span className="font-black block mt-1 uppercase">{currentRange.label}</span>
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Descripción del Gasto</label>
            <input 
              type="text" 
              placeholder="Ej: Compra de Laptop"
              className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] px-6 py-5 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                type="button"
                onClick={() => setInputMode("total")}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${inputMode === "total" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"}`}
              >
                Monto Total
              </button>
              <button 
                type="button"
                onClick={() => setInputMode("parcial")}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${inputMode === "parcial" ? "bg-white text-nu-purple shadow-sm" : "text-slate-500"}`}
              >
                Por Quincena
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  {inputMode === "total" ? "Monto Total" : "Monto Quincenal"}
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-10 pr-5 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800"
                    value={inputMode === "total" ? montoTotal : montoParcial}
                    onChange={(e) => inputMode === "total" ? setMontoTotal(e.target.value) : setMontoParcial(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Quincenas</label>
                <input 
                  type="number" 
                  placeholder="12"
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-5 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-black text-slate-800"
                  value={numParcialidades}
                  onChange={(e) => setNumParcialidades(e.target.value)}
                  required
                />
              </div>
            </div>

            {agrupadores.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Agrupador (Opcional)</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 appearance-none"
                  value={agrupadorId}
                  onChange={(e) => setAgrupadorId(e.target.value)}
                >
                  <option value="">Sin Agrupador</option>
                  {agrupadores.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {config && config.segmentsEnabled && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Segmento de Egreso</label>
                <select 
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 focus:border-nu-purple focus:bg-white outline-none transition-all font-bold text-slate-800 appearance-none"
                  value={segmentoId}
                  onChange={(e) => setSegmentoId(e.target.value)}
                >
                  <option value="">Sin Clasificar (Libre)</option>
                  {config.segments.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre} ({s.porcentaje}%)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Resumen Informativo */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Resultado:</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-800">
                  {inputMode === "total" 
                    ? `$${calculatedParcial} x ${numParcialidades} pagos`
                    : `$${calculatedTotal} total`
                  }
                </p>
              </div>
            </div>
          </div>

          <button 
            disabled={isSaving}
            className="w-full bg-nu-purple text-white font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl text-lg shadow-nu-purple/30"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <CreditCard className="w-5 h-5" />
                Crear Plan
              </>
            )}
          </button>
        </form>
      </div>
    </BottomDrawer>
  );
}
