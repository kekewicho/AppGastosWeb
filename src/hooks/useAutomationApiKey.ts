import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface AutomationApiKeyMeta {
  hash: string;
  preview: string;
  createdAt?: unknown;
}

/**
 * Administra la API Key personal que un usuario puede usar para conectar
 * automatizaciones de terceros (Zapier, Make, IFTTT, scripts propios, etc.)
 * y registrar gastos en el endpoint /api/webhook.
 *
 * Buenas prácticas aplicadas:
 * - La generación/revocación ocurre en el servidor (`/api/automation-key`),
 *   autenticado con el ID Token de Firebase Auth del usuario, usando Firebase
 *   Admin SDK. El cliente nunca escribe directamente las colecciones
 *   sensibles de Firestore.
 * - La clave en texto plano NUNCA se persiste en Firebase, solo se muestra
 *   una vez al generarla, como respuesta directa de la API.
 * - En Firestore únicamente se guarda un hash HMAC-SHA256 de la clave (en
 *   `api_key_lookup/{hash}`, con un secreto que solo conoce el servidor), que
 *   sirve para validar el header `x-api-key` sin poder reconstruir la clave original.
 * - En `user_configs/{uid}` solo se guarda metadata no sensible (hash, preview
 *   de 4 caracteres y fecha) para que la UI sepa que existe una clave activa.
 * - Al regenerar o revocar, el documento anterior en `api_key_lookup` se
 *   elimina para invalidar la clave vieja.
 */
const AUTH_SCHEME = "Bearer";

function authHeaderValue(idToken: string): string {
  return `${AUTH_SCHEME} ${idToken}`;
}

export function useAutomationApiKey() {
  const { user } = useAuth();
  const [meta, setMeta] = useState<AutomationApiKeyMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const configRef = doc(db, "user_configs", user.uid);
    const unsubscribe = onSnapshot(
      configRef,
      (snap) => {
        const data = snap.data();
        const apiKeyMeta = data?.apiKeyMeta as AutomationApiKeyMeta | undefined;
        setMeta(apiKeyMeta ?? null);
        setLoading(false);
      },
      (error) => {
        console.error("Error al obtener la API Key de automatización:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const generateKey = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Usuario no autenticado");

    const idToken = await user.getIdToken();
    const response = await fetch("/api/automation-key", {
      method: "POST",
      headers: {
        Authorization: authHeaderValue(idToken),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "No se pudo generar la API Key.");
    }

    const data = await response.json();
    return data.apiKey as string;
  }, [user]);

  const revokeKey = useCallback(async () => {
    if (!user) return;

    const idToken = await user.getIdToken();
    const response = await fetch("/api/automation-key", {
      method: "DELETE",
      headers: {
        Authorization: authHeaderValue(idToken),
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "No se pudo revocar la API Key.");
    }
  }, [user]);

  return {
    hasKey: !!meta,
    preview: meta?.preview ?? null,
    loading,
    generateKey,
    revokeKey,
  };
}
