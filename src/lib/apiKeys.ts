import { createHmac, randomBytes } from "crypto";

const KEY_PREFIX = "mypocket_key_";

/**
 * Calcula el hash de una API Key usando HMAC-SHA256 con un "pepper" secreto
 * que solo vive en el servidor (`API_KEY_HASH_SECRET`). A diferencia de un
 * hash simple (p. ej. SHA-256 plano), esto evita que alguien con acceso de
 * solo lectura a la base de datos pueda precalcular hashes de claves
 * candidatas fuera de línea, ya que necesitaría también el secreto del
 * servidor.
 */
export function hashApiKey(rawKey: string): string {
  const secret = process.env.API_KEY_HASH_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno API_KEY_HASH_SECRET.");
  }
  return createHmac("sha256", secret).update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; preview: string } {
  const rawKey = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { rawKey, preview: rawKey.slice(-4) };
}
