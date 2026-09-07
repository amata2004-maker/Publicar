# MyActif Social Agent

Agente que redacta un post diario (rotando las 7 categorías de riesgo de MyActif),
genera una tarjeta de marca navy/gold con el gancho del día, te lo envía por correo
para aprobar, y al aprobar lo publica en Facebook (e Instagram si está configurado).

## Flujo
1. Cron diario (8am Cancún) → genera borrador con Claude API.
2. Te llega un correo con el post y un botón "Revisar y aprobar".
3. Al confirmar, publica la tarjeta de marca + caption en Facebook (y en Instagram
   si configuraste `IG_USER_ID`).
4. Si no apruebas en 3 días, el borrador expira solo.

La imagen se genera al vuelo en el Worker (`src/image.js`, con `workers-og`) a
partir del GANCHO del post — no depende de un modelo de imagen por publicación.

## Setup

```bash
npm install
```

### 1. Crear el KV namespace
```bash
npx wrangler kv namespace create POSTS_KV
```
Copia el `id` que te devuelve y pégalo en `wrangler.toml`.

### 2. Configurar secretos
```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL          # ej. posts@myactif.net
npx wrangler secret put APPROVER_EMAIL      # tu correo
npx wrangler secret put FB_PAGE_ID
npx wrangler secret put FB_PAGE_ACCESS_TOKEN
npx wrangler secret put WORKER_URL          # ej. https://myactif-social-agent.tu-cuenta.workers.dev
npx wrangler secret put IG_USER_ID          # opcional — id de tu cuenta de Instagram Business/Creator
```

`IG_USER_ID` es opcional: si no lo configuras, el agente solo publica en Facebook.
Para publicar también en Instagram necesitas:
- Que tu cuenta de Instagram sea de tipo Business o Creator y esté vinculada a tu página de Facebook.
- Los permisos `instagram_basic` e `instagram_content_publish` activados en el caso de uso "Administrar páginas" de tu app de Meta (mismo lugar donde activaste `pages_manage_posts`).
- El ID de la cuenta de Instagram: en Meta Business Suite → Configuración → Cuentas de Instagram, o vía Graph API Explorer con `GET /{page-id}?fields=instagram_business_account`.

`FB_PAGE_ACCESS_TOKEN` sale de Meta for Developers → tu app → Graph API Explorer,
con permisos `pages_manage_posts` y `pages_read_engagement`, convertido a token
de larga duración (60 días, renovable).

### 3. Desplegar
```bash
npx wrangler deploy
```

### 4. Probar sin esperar al cron
Visita `https://TU-WORKER.workers.dev/trigger-test` — genera y envía un post de prueba.

## Pendiente
- Notificación de aprobación por WhatsApp en vez de correo, cuando esté lista
  la integración de WhatsApp Business API.
