This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Automatizaciones (API Key personal)

Desde `Configuración` → `Automatizaciones` cada usuario puede generar una API Key
personal para conectar automatizaciones de terceros (Zapier, Make, atajos,
scripts propios, etc.) y registrar gastos vía `POST /api/webhook` enviando el
header `x-api-key`.

Buenas prácticas de almacenamiento aplicadas:

- La clave en texto plano **nunca** se guarda, solo se devuelve una vez en la
  respuesta del endpoint `/api/automation-key` al generarla.
- La generación y revocación se realizan exclusivamente en el servidor
  (`/api/automation-key`), autenticado con el ID Token de Firebase Auth del
  usuario (verificado con Firebase Admin SDK). El cliente nunca escribe
  directamente las colecciones sensibles de Firestore.
- En Firestore solo se persiste un hash HMAC-SHA256 de la clave (con un
  secreto que solo conoce el servidor), en la colección `api_key_lookup/{hash}`
  (`{ userId, revoked, createdAt, lastUsedAt }`), usada para resolver al dueño
  de la clave sin poder reconstruirla ni precalcular hashes fuera de línea.
- En `user_configs/{uid}.apiKeyMeta` solo se guarda metadata no sensible
  (`hash`, `preview` de 4 caracteres y `createdAt`) para poder mostrar el
  estado de la clave en la UI.
- Al regenerar o revocar, el documento anterior en `api_key_lookup` se elimina,
  invalidando inmediatamente la clave anterior.

Reglas de seguridad recomendadas para Firestore (tanto `/api/webhook` como
`/api/automation-key` usan Firebase Admin SDK, por lo que el cliente no
necesita ningún permiso sobre `api_key_lookup`):

```
match /user_configs/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  // Las escrituras del campo apiKeyMeta las hace el servidor con Admin SDK;
  // el cliente solo necesita poder editar el resto de su configuración.
  allow write: if request.auth != null && request.auth.uid == userId;
}

match /api_key_lookup/{hash} {
  // Solo el backend (Firebase Admin SDK) accede a esta colección.
  allow read, write: if false;
}
```

Variables de entorno necesarias (credenciales de una cuenta de servicio de
Firebase y un secreto propio, **sin** el prefijo `NEXT_PUBLIC_` para que nunca
se envíen al navegador):

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
API_KEY_HASH_SECRET=una-cadena-aleatoria-larga-y-secreta
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
