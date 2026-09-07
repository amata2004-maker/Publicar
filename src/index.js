export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      handleDailyPost(env).catch((err) => {
        console.error("handleDailyPost failed:", err);
      })
    );
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/approve") {
      if (request.method === "POST") {
        return handleApproveConfirm(request, env);
      }
      return handleApprovePreview(request, env);
    }
    if (url.pathname === "/trigger-test") {
      try {
        await handleDailyPost(env);
        return new Response("Post de prueba generado y enviado a tu correo.");
      } catch (err) {
        console.error("trigger-test failed:", err);
        return new Response(`Error generando el post de prueba: ${err.message}`, { status: 500 });
      }
    }
    return new Response("MyActif Social Agent activo.");
  }
};

// Categorías de riesgo canónicas de MyActif, una por día (0 = domingo)
const CATEGORIES = [
  {
    day: 0,
    name: "Cumplimiento LFPDPPP",
    hook: "Poner a un mal inquilino en el grupo de WhatsApp de asesores no te protege. Te expone.",
    dato: "Compartir datos personales fuera de una plataforma con estructura legal viola la LFPDPPP, sin importar que la información sea cierta."
  },
  {
    day: 1,
    name: "Deudas de servicios impagas",
    hook: "Tu inquilino se fue. La deuda de luz y agua se queda con tu nombre.",
    dato: "CFE y organismos de agua pueden generar reportes de cobro a tu domicilio aunque el contrato ya haya terminado."
  },
  {
    day: 2,
    name: "Abuso de propietarios a inquilinos",
    hook: "No todo mal trato viene del inquilino. A veces el propietario cruza la línea.",
    dato: "Retener depósitos sin causa justificada o entrar a la propiedad sin aviso puede constituir violación a derechos del arrendatario."
  },
  {
    day: 3,
    name: "Comisiones no pagadas al asesor",
    hook: "Cerraste el trato. El propietario se saltó al asesor para no pagar comisión.",
    dato: "Es una práctica común en el sector inmobiliario mexicano, y sin registro formal es casi imposible reclamarla."
  },
  {
    day: 4,
    name: "Identidades falsas",
    hook: "La INE se ve perfecta. La persona detrás, no es quien dice ser.",
    dato: "La suplantación de identidad en rentas va en aumento; la validación biométrica reduce el riesgo desde el primer filtro."
  },
  {
    day: 5,
    name: "Blacklist de inquilinos y compradores",
    hook: "Ese \"buen inquilino\" ya dejó tres propiedades con adeudos en otras zonas.",
    dato: "Sin un registro compartido entre asesores, cada propietario descubre el problema solo, y tarde."
  },
  {
    day: 6,
    name: "Seguridad del asesor en visitas",
    hook: "Ir solo a mostrar una propiedad a un desconocido es un riesgo que el sector normalizó.",
    dato: "Los asesores inmobiliarios están entre los perfiles más expuestos a agresión en citas de trabajo."
  }
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function handleDailyPost(env) {
  const today = new Date();
  const dayOfWeek = today.getUTCDay();
  const category = CATEGORIES.find((c) => c.day === dayOfWeek);

  const draft = await generateDraft(env, category);
  const token = crypto.randomUUID();

  await env.POSTS_KV.put(
    `draft:${token}`,
    JSON.stringify({
      text: draft,
      category: category.name,
      status: "pending",
      createdAt: today.toISOString()
    }),
    { expirationTtl: 60 * 60 * 24 * 3 } // expira en 3 días si no se aprueba
  );

  await sendApprovalEmail(env, draft, category.name, token);
}

async function generateDraft(env, category) {
  const systemPrompt = `Eres el redactor de contenido de MyActif, plataforma PropTech mexicana de verificación de inquilinos y cumplimiento KYC/LFPDPPP. Tono directo, sin rodeos, sin emojis, orientado a generar urgencia real (no alarmismo vacío) en propietarios y asesores inmobiliarios.

Cada post sigue esta estructura exacta, con estas etiquetas:
GANCHO: 1-2 líneas planteando el riesgo real de forma concreta.
DATO: un hecho o consecuencia legal/práctica verificable, sin exagerar.
CTA: invitación breve a MyActif o al diagnóstico gratuito.

Responde solo con el post en ese formato, sin explicaciones adicionales.`;

  const userPrompt = `Categoría de hoy: ${category.name}
Gancho de referencia (varía la redacción, no lo repitas literal): ${category.hook}
Dato de referencia (varía la redacción, no lo repitas literal): ${category.dato}

Escribe el post de hoy.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status}): ${data.error?.message || JSON.stringify(data)}`);
  }

  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("Respuesta de Anthropic sin bloque de texto utilizable.");
  }
  return textBlock.text.trim();
}

async function sendApprovalEmail(env, draft, categoryName, token) {
  const approveUrl = `${env.WORKER_URL}/approve?token=${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.APPROVER_EMAIL,
      subject: `Post de hoy — ${categoryName}`,
      html: `
        <h2>Categoría: ${escapeHtml(categoryName)}</h2>
        <p style="white-space:pre-line;font-family:sans-serif">${escapeHtml(draft)}</p>
        <p><a href="${approveUrl}" style="background:#2F69D5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Revisar y aprobar</a></p>
        <p style="color:#888;font-size:12px">Si no apruebas en 3 días, el post expira.</p>
      `
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Resend API error (${response.status}): ${data.message || JSON.stringify(data)}`);
  }
}

async function getDraft(env, token) {
  if (!token) return null;
  const raw = await env.POSTS_KV.get(`draft:${token}`);
  return raw ? JSON.parse(raw) : null;
}

function htmlPage(body) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px;">${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

// GET /approve — muestra una vista previa y pide confirmación explícita antes de publicar.
// No publica en este paso: algunos clientes de correo (Outlook Safe Links, escáneres
// corporativos) siguen automáticamente los links de un email por seguridad, y si el GET
// publicara directamente el post se publicaría solo sin que nadie hiciera clic.
async function handleApprovePreview(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Falta token", { status: 400 });

  const draft = await getDraft(env, token);
  if (!draft) return new Response("Post no encontrado o expirado", { status: 404 });

  if (draft.status === "published") {
    return htmlPage(`<p>Este post ya fue publicado el ${escapeHtml(draft.publishedAt)}.</p>`);
  }

  return htmlPage(`
    <h2>Categoría: ${escapeHtml(draft.category)}</h2>
    <p style="white-space:pre-line">${escapeHtml(draft.text)}</p>
    <form method="POST" action="/approve?token=${encodeURIComponent(token)}">
      <button type="submit" style="background:#2F69D5;color:white;padding:10px 20px;border:none;border-radius:6px;font-size:16px;cursor:pointer;">Confirmar y publicar en Facebook</button>
    </form>
  `);
}

// POST /approve — publica de verdad, solo tras confirmación explícita del usuario.
async function handleApproveConfirm(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Falta token", { status: 400 });

  const draft = await getDraft(env, token);
  if (!draft) return new Response("Post no encontrado o expirado", { status: 404 });

  if (draft.status === "published") {
    return htmlPage(`<p>Este post ya fue publicado.</p>`);
  }

  try {
    await publishToFacebook(env, draft.text);
  } catch (err) {
    console.error("publishToFacebook failed:", err);
    return htmlPage(`<p>No se pudo publicar en Facebook: ${escapeHtml(err.message)}</p><p>El post sigue pendiente, puedes intentar de nuevo.</p>`);
  }

  draft.status = "published";
  draft.publishedAt = new Date().toISOString();
  await env.POSTS_KV.put(`draft:${token}`, JSON.stringify(draft));

  return htmlPage(`<p>Post publicado en MyActif. Ya puedes cerrar esta pestaña.</p>`);
}

async function publishToFacebook(env, message) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${env.FB_PAGE_ID}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: env.FB_PAGE_ACCESS_TOKEN
    })
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API error (${res.status})`);
  }

  return data;
}
