import express from "express";
import cors from "cors";
import { Resend } from "resend";

const app = express();

/**
 * ORÍGENES PERMITIDOS (CORS)
 * - GitHub Pages (tu usuario)
 * - Localhost (pruebas)
 * - Render Static Site del formulario
 */
const allowed = [
  "https://eliezelapolinaris2017-lab.github.io",
  "https://prdresses-form.onrender.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite requests sin origin (Postman, server-to-server, etc.)
      if (!origin) return cb(null, true);

      if (allowed.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS bloqueado para: ${origin}`), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight explícito (evita dolores con navegadores)
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("OK - secure-form-email-backend"));

app.post("/api/submit", async (req, res) => {
  try {
    // ✅ Soporta el formato nuevo (campos separados) + el viejo (details)
    const {
      name,
      email,
      phone,
      service,

      // nuevos (opcionales)
      service_details,
      location,
      city,
      event_date,
      event_time,
      coordinator,

      // viejo (opcional)
      details,
    } = req.body;

    if (!name || !email || !phone || !service) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos requeridos (name, email, phone, service).",
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const TO_EMAIL = process.env.TO_EMAIL;

    if (!RESEND_API_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: "RESEND_API_KEY falta en Render" });
    }
    if (!TO_EMAIL) {
      return res
        .status(500)
        .json({ ok: false, error: "TO_EMAIL falta en Render" });
    }

    const resend = new Resend(RESEND_API_KEY);

    // FROM: usa tu variable si la tienes; si no, usa onboarding
    const from =
      process.env.FROM_EMAIL || "Formulario Web <onboarding@resend.dev>";

    // ✅ Construye “Detalles” limpio y en orden
    // 1) Si viene details viejo, lo respetamos
    // 2) Si no viene, lo armamos desde campos nuevos
    const builtDetails =
      (typeof details === "string" && details.trim() !== "")
        ? details.trim()
        : buildDetails({
            service_details,
            location,
            city,
            event_date,
            event_time,
            coordinator,
          });

    const html = `
      <h2>Nuevo formulario</h2>

      <p><b>Nombre:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Teléfono:</b> ${escapeHtml(phone)}</p>
      <p><b>Servicio:</b> ${escapeHtml(service)}</p>

      <hr/>

      <p><b>Detalles:</b></p>
      <div style="line-height:1.6">
        ${builtDetails
          ? builtDetails
              .split("\n")
              .map((line) => `<div>${escapeHtml(line)}</div>`)
              .join("")
          : `<div>N/A</div>`}
      </div>
    `;

    const result = await resend.emails.send({
      from,
      to: [TO_EMAIL],
      subject: `Nuevo formulario: ${service}`,
      html,
      replyTo: email,
    });

    return res.json({ ok: true, result });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});

/** Helpers */

function buildDetails({
  service_details,
  location,
  city,
  event_date,
  event_time,
  coordinator,
}) {
  const lines = [];

  // “¿Qué tipo de servicio desea?” (texto libre)
  if (service_details && String(service_details).trim()) {
    lines.push(`¿Qué tipo de servicio desea?: ${String(service_details).trim()}`);
  }

  if (location && String(location).trim()) {
    lines.push(`¿Dónde será su actividad?: ${String(location).trim()}`);
  }

  if (city && String(city).trim()) {
    lines.push(`Ciudad del evento: ${String(city).trim()}`);
  }

  if (event_date && String(event_date).trim()) {
    lines.push(`Día de su evento: ${String(event_date).trim()}`);
  }

  if (event_time && String(event_time).trim()) {
    lines.push(`Hora del evento: ${String(event_time).trim()}`);
  }

  if (coordinator && String(coordinator).trim()) {
    lines.push(`Coordinador: ${String(coordinator).trim()}`);
  }

  return lines.join("\n");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
