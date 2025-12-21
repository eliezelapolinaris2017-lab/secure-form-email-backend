import express from "express";
import cors from "cors";
import "dotenv/config";
import { Resend } from "resend";

const app = express();

// CORS: permite tu GitHub Pages (y localhost por si acaso)
const allowed = [
  "https://eliezelapolinaris2017-lab.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite llamadas sin origin (ej: health checks)
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado para: ${origin}`), false);
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const resend = new Resend(process.env.RESEND_API_KEY);

// Health check para Render
app.get("/", (req, res) => res.send("OK - secure-form-email-backend"));

app.post("/api/submit", async (req, res) => {
  try {
    // 👇 ESTO CUADRA 1:1 con tu HTML
    const { name, email, phone, service, details } = req.body;

    if (!name || !email || !phone || !service) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos requeridos (name, email, phone, service).",
      });
    }

    const from =
      process.env.FROM_EMAIL || "Formulario Web <onboarding@resend.dev>";

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
      to: [process.env.TO_EMAIL],
      subject: `Nuevo formulario: ${service}`,
      html,
      replyTo: email, // para que le des "Reply" y responda al cliente
    });

    return res.json({ ok: true, result });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Render usa PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});

// helper anti-inyección HTML en emails
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
