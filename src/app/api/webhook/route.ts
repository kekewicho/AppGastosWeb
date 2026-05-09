import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

/**
 * Webhook API para MyPocket
 * 
 * Este endpoint permite insertar movimientos de forma remota.
 * 
 * Headers requeridos:
 * - x-webhook-secret: El secreto definido en .env.local
 * 
 * Payload (JSON):
 * {
 *   "userId": "ID_DEL_USUARIO",
 *   "nombre": "Descripción del gasto",
 *   "monto": 123.45,
 *   "tipo": "ingreso" | "egreso"
 * }
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secret = request.headers.get("x-webhook-secret");

    // 1. Validar secreto
    const APP_SECRET = process.env.WEBHOOK_SECRET;
    if (!APP_SECRET || secret !== APP_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Validar campos obligatorios
    const { userId, nombre, monto, tipo } = body;
    if (!userId || !nombre || !monto || !tipo) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // 3. Insertar en Firestore
    const docRef = await addDoc(collection(db, "movimientos"), {
      userId,
      nombre,
      monto: parseFloat(monto),
      tipo,
      fecha: Timestamp.now(),
      source: "webhook"
    });

    return NextResponse.json({ 
      success: true, 
      id: docRef.id 
    });

  } catch (error) {
    console.error("Error en Webhook:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
