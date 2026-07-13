import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface Segment {
  id: string;
  nombre: string;
  porcentaje: number;
  color: string;
  descripcion?: string;
}

export interface UserConfig {
  segmentsEnabled: boolean;
  segments: Segment[];
}

export const DEFAULT_SEGMENTS: Segment[] = [
  { 
    id: "necesidades", 
    nombre: "Necesidades", 
    porcentaje: 50, 
    color: "#820ad1",
    descripcion: "Gastos indispensables como renta, servicios (agua, luz, internet), despensa básica, créditos y transporte." 
  },
  { 
    id: "deseos", 
    nombre: "Deseos", 
    porcentaje: 30, 
    color: "#f59e0b",
    descripcion: "Gastos discrecionales y de entretenimiento como restaurantes, salidas, cine, lujos, ropa y suscripciones." 
  },
  { 
    id: "ahorro", 
    nombre: "Ahorro", 
    porcentaje: 20, 
    color: "#10b981",
    descripcion: "Dinero destinado a inversiones, fondo de emergencia, ahorro para metas futuras o pagos de amortizaciones." 
  }
];

export function useUserConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<UserConfig>({
    segmentsEnabled: false,
    segments: DEFAULT_SEGMENTS,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, "user_configs", user.uid);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<UserConfig>;
          setConfig({
            segmentsEnabled: data.segmentsEnabled ?? false,
            segments: data.segments ?? DEFAULT_SEGMENTS,
          });
        } else {
          // Si no existe, dejamos los valores por defecto
          setConfig({
            segmentsEnabled: false,
            segments: DEFAULT_SEGMENTS,
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error al obtener la configuración del usuario:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateConfig = useCallback(
    async (newConfig: Partial<UserConfig>) => {
      if (!user) return;
      try {
        const docRef = doc(db, "user_configs", user.uid);
        await setDoc(docRef, newConfig, { merge: true });
      } catch (error) {
        console.error("Error al actualizar la configuración del usuario:", error);
        throw error;
      }
    },
    [user]
  );

  return { config, loading, updateConfig };
}
