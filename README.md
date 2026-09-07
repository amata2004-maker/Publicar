# MyActif Social Agent

Agente que redacta un post diario (rotando las 7 categorías de riesgo de MyActif),
te lo envía por correo para aprobar, y al aprobar lo publica en la página de Facebook.

## Flujo
1. Cron diario (8am Cancún) → genera borrador con Claude API.
2. Te llega un correo con el post y un botón "Aprobar y publicar".
3. Al hacer clic, publica en tu página de Facebook.
4. Si no apruebas en 3 días, el borrador expira solo.

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
```

`FB_PAGE_ACCESS_TOKEN` sale de Meta for Developers → tu app → Graph API Explorer,
con permisos `pages_manage_posts` y `pages_read_engagement`, convertido a token
de larga duración (60 días, renovable).

### 3. Desplegar
```bash
npx wrangler deploy
```

### 4. Probar sin esperar al cron
Visita `https://TU-WORKER.workers.dev/trigger-test` — genera y envía un post de prueba.

## Pendiente (fase 2)
- Instagram requiere imagen/video, no solo texto — se puede generar una gráfica
  de marca (navy/gold) automáticamente antes de publicar.
- Notificación de aprobación por WhatsApp en vez de correo, cuando esté lista
  la integración de WhatsApp Business API.
