import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { hashApiKey } from "@/lib/apiKeys";

/**
 * Webhook API para MyPocket
 *
 * Este endpoint permite a automatizaciones de terceros (Zapier, Make, IFTTT,
 * scripts propios, etc.) insertar movimientos de forma remota, autenticándose
 * con la API Key personal generada por el usuario en su pantalla de
 * Configuración (sección "Automatizaciones").
 *
 * Headers requeridos:
 * - x-api-key: La API Key personal del usuario.
 *
 * Payload (JSON):
 * {
 *   "nombre": "Descripción del gasto",
 *   "monto": 123.45,
 *   "tipo": "ingreso" | "egreso"
 * }
 *
 * Nota de seguridad: el usuario NO se envía en el payload. Se resuelve en el
 * servidor a partir del hash de la API Key (usando Firebase Admin SDK, que
 * omite las reglas de seguridad de Firestore), para evitar que cualquiera
 * con una clave válida pueda registrar movimientos a nombre de otro usuario.
 */

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "Falta el header x-api-key" }, { status: 401 });
    }

    // 1. Resolver el usuario dueño de la API Key a partir de su hash.
    const db = getAdminDb();
    const hash = hashApiKey(apiKey.trim());
    const lookupRef = db.collection("api_key_lookup").doc(hash);
    const lookupSnap = await lookupRef.get();

    if (!lookupSnap.exists || lookupSnap.data()?.revoked) {
      return NextResponse.json({ error: "API Key inválida o revocada" }, { status: 401 });
    }

    const userId = lookupSnap.data()?.userId;
    if (!userId) {
      return NextResponse.json({ error: "API Key inválida" }, { status: 401 });
    }

    // 2. Validar campos obligatorios del movimiento.
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "El cuerpo de la petición debe ser JSON válido" }, { status: 400 });
    }
    const { nombre, monto, tipo } = body;
    if (!nombre || monto === undefined || monto === null || !tipo) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (tipo !== "ingreso" && tipo !== "egreso") {
      return NextResponse.json({ error: "El campo 'tipo' debe ser 'ingreso' o 'egreso'" }, { status: 400 });
    }
    const montoNum = parseFloat(monto as string);
    if (Number.isNaN(montoNum)) {
      return NextResponse.json({ error: "El campo 'monto' debe ser numérico" }, { status: 400 });
    }

    // 3. Insertar en Firestore.
    const docRef = await db.collection("movimientos").add({
      userId,
      nombre,
      monto: montoNum,
      tipo,
      fecha: Timestamp.now(),
      source: "webhook"
    });

    // 4. Registrar el último uso de la API Key (sin bloquear la respuesta si falla).
    lookupRef.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch((err) =>
      console.error("No se pudo actualizar lastUsedAt de la API Key:", err)
    );

    return NextResponse.json({
      success: true,
      id: docRef.id
    });

  } catch (error) {
    console.error("Error en Webhook:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
