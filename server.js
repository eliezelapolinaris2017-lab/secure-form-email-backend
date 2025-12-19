import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/* =========================
   CORS (tu GitHub Pages)
   ========================= */
const ALLOWED_ORIGIN = "https://eliezelapolinaris2017-lab.github.io";
app.use(cors({ origin: ALLOWED_ORIGIN }));

app.use(express.json());

/* =========================
   Health check (opcional)
   ========================= */
app.get("/", (req, res) => {
  res.status(200).send("OK - secure-form-email-backend");
});

/* =========================
   Helper: valida env
   ========================= */
function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

/* =========================
   SMTP Transport (Gmail)
   - Usa tus variables de Render
   ========================= */
function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);

  // Render te guarda "true"/"false" como string
  const secure = String(process.env.SMTP_SECURE ?? (port === 465)).toLowerCase() === "true";

  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    // Esto ayuda mucho en hosting cuando hay latencia
    tls: {
      servername: "smtp.gmail.com"
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000
  });
}

/* =========================
   reCAPTCHA v3 verify
   ========================= */
async function verifyRecaptcha(token) {
  const secret = requireEnv("RECAPTCHA_SECRET");

  const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token })
  });

  const data = await resp.json();

  // Ajusta el score si quieres más/menos estricto
  const ok = data.success === true && (typeof data.score !== "number" || data.score >= 0.5);
  return { ok, data };
}

/* =========================
   Endpoint principal
   ========================= */
app.post("/api/submit", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      details = "",
      recaptchaToken
    } = req.body || {};

    // Validación mínima
    if (!name || !email || !phone || !service) {
      return res.status(400).json({ error: "Campos requeridos incompletos" });
    }

    if (!recaptchaToken) {
      return res.status(400).json({ error: "reCAPTCHA faltante" });
    }

    // Verificar reCAPTCHA
    const { ok, data } = await verifyRecaptcha(recaptchaToken);
    if (!ok) {
      return res.status(403).json({
        error: "Bloqueado por seguridad (reCAPTCHA)",
        // útil para debug (puedes quitarlo luego)
        reason: { success: data.success, score: data.score, action: data.action }
      });
    }

    // SMTP
    const transporter = buildTransporter();

    const fromEmail = process.env.FROM_EMAIL || `"Formulario Web" <${process.env.SMTP_USER}>`;
    const toEmail = process.env.TO_EMAIL || process.env.SMTP_USER;

    const text = `
NUEVO CUESTIONARIO RECIBIDO

Nombre: ${name}
Email: ${email}
Teléfono: ${phone}
Servicio: ${service}

Detalles:
${details || "N/A"}

Origen: ${ALLOWED_ORIGIN}
`;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: `Nuevo formulario – ${name}`,
      text,
      replyTo: email
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("ERROR /api/submit:", err?.message || err, err?.stack || "");
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =========================
   Start
   ========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});
