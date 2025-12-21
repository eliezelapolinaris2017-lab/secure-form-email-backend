import express from "express";
import cors from "cors";
import { Resend } from "resend";

const app = express();

// ✅ ORÍGENES PERMITIDOS (añadí el Static Site de Render)
const allowed = [
  "https://eliezelapolinaris2017-lab.github.io",
  "https://prdresses-form.onrender.com", // ✅ tu static site
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite requests sin origin (ej: curl, server-to-server)
      if (!origin) return cb(null, true);

      if (allowed.includes(origin)) return cb(null, true);

      // ✅ No rompas el backend: responde “bloqueado” limpio
      return cb(new Error(`CORS bloqueado para: ${origin}`), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ✅ Opcional pero recomendado: responde preflight rápido
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("OK - secure-form-email-backend"));

app.post("/api/submit", async (req, res) => {
  try {
    const { name, email, phone, service, details } = req.body;

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

    const html = `
      <h2>Nuevo formulario</h2>
      <p><b>Nombre:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Teléfono:</b> ${escapeHtml(phone)}</p>
      <p><b>Servicio:</b> ${escapeHtml(service)}</p>
      <p><b>Detalles:</b><br/>${escapeHtml(details || "")}</p>
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
