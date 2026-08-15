import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generateApiKey, hashApiKey } from "@/lib/apiKeys";

/**
 * Endpoint para que un usuario autenticado administre su propia API Key de
 * automatización (usada por /api/webhook para registrar gastos).
 *
 * Requiere un header Authorization tipo portador (RFC 6750) con el ID Token
 * de Firebase Auth del usuario. El servidor verifica el token con Firebase
 * Admin SDK para resolver el uid de forma confiable, evitando que el cliente
 * pueda generar/revocar claves a nombre de otro usuario.
 *
 * Nota de diseño: el hash de la clave nunca se guarda en `user_configs/{uid}`
 * (que el cliente sí puede leer), sino en `automation_keys/{uid}` (accesible
 * solo desde el servidor vía Admin SDK). Así el cliente solo puede ver la
 * metadata no sensible (`preview`, `createdAt`) necesaria para la UI.
 */
async function getAuthenticatedUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (error) {
    console.error("Token de autenticación inválido:", error);
    return null;
  }
}

export async function POST(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const userConfigRef = db.collection("user_configs").doc(uid);
    const automationKeyRef = db.collection("automation_keys").doc(uid);
    const { rawKey, preview } = generateApiKey();
    const hash = hashApiKey(rawKey);

    // Se ejecuta en una transacción para evitar condiciones de carrera si el
    // usuario dispara dos generaciones concurrentes (p. ej. doble clic).
    await db.runTransaction(async (tx) => {
      const automationKeySnap = await tx.get(automationKeyRef);
      const previousHash = automationKeySnap.data()?.hash as string | undefined;

      // Invalida cualquier clave anterior antes de crear una nueva.
      if (previousHash) {
        tx.delete(db.collection("api_key_lookup").doc(previousHash));
      }

      tx.set(db.collection("api_key_lookup").doc(hash), {
        userId: uid,
        revoked: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(automationKeyRef, {
        hash,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        userConfigRef,
        {
          apiKeyMeta: {
            preview,
            createdAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, apiKey: rawKey, preview });
  } catch (error) {
    console.error("Error al generar la API Key:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const uid = await getAuthenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const userConfigRef = db.collection("user_configs").doc(uid);
    const automationKeyRef = db.collection("automation_keys").doc(uid);

    await db.runTransaction(async (tx) => {
      const automationKeySnap = await tx.get(automationKeyRef);
      const previousHash = automationKeySnap.data()?.hash as string | undefined;

      if (previousHash) {
        tx.delete(db.collection("api_key_lookup").doc(previousHash));
      }

      tx.delete(automationKeyRef);
      tx.set(userConfigRef, { apiKeyMeta: FieldValue.delete() }, { merge: true });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al revocar la API Key:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
