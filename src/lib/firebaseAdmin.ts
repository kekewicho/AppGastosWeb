import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Inicializa el Firebase Admin SDK, exclusivo para uso en el servidor
 * (API routes). A diferencia del SDK de cliente (`src/lib/firebase.ts`), este
 * SDK se autentica con una cuenta de servicio y por lo tanto **omite** las
 * reglas de seguridad de Firestore. Esto permite validar la API Key de
 * automatización de un usuario sin necesidad de exponer lecturas públicas de
 * la colección `api_key_lookup` a través de las reglas de seguridad del
 * cliente.
 *
 * Requiere las siguientes variables de entorno (nunca con prefijo
 * NEXT_PUBLIC_, para que no se incluyan en el bundle del navegador):
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 */
function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Las variables de entorno suelen escapar los saltos de línea de la clave privada.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan credenciales de Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let adminDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

let adminAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}
