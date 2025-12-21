import express from "express";
import cors from "cors";
import { Resend } from "resend";

const app = express();

/**
 * CORS: Permite
 * - GitHub Pages (tu usuario)
 * - Localhost (dev)
 * - Render Static Site del formulario (cualquier *.onrender.com)
 *
 * Nota: Esto no “abre el backend al mundo” porque SOLO permite esos orígenes.
 */
const allowedExact = new Set([
  "https://eliezelapolinaris2017-lab.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function isAllowedOrigin(origin) {
  if (!origin) return true; // Postman / server-to-server
  if (allowedExact.has(origin)) return true;

  // Permite tu Static Site y/o cualquier subdominio .onrender.com
  // Ej: https://prdresses-form.onrender.com
  // Ej: https://prdresses-form-xyz.onrender.com (preview)
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") return false;

    if (hostname.endsWith(".onrender.com")) return true;

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para: ${origin}`), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 86400, // cachea preflight 24h
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight con la MISMA config

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (req, res) => res.send("OK - secure-form-email-backend"));

app.post("/api/submit", async (req, res) => {
  try {
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
      return res.status(500).json({ ok: false, error: "RESEND_API_KEY falta en Render" });
    }
    if (!TO_EMAIL) {
      return res.status(500).json({ ok: false, error: "TO_EMAIL falta en Render" });
    }

    const resend = new Resend(RESEND_API_KEY);

    const from = process.env.FROM_EMAIL || "Formulario Web <onboarding@resend.dev>";

    // Detalles: prioridad al formato viejo si viene lleno
    const builtDetails =
      typeof details === "string" && details.trim()
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
      <div style="line-height:1.7">
        ${
          builtDetails
            ? builtDetails
                .split("\n")
                .map((line) => `<div>${escapeHtml(line)}</div>`)
                .join("")
            : `<div>N/A</div>`
        }
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

function buildDetails({ service_details, location, city, event_date, event_time, coordinator }) {
  const lines = [];

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
