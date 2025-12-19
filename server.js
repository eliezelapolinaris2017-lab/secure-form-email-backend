import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();

/* =========================
   CORS (GitHub Pages)
   ========================= */
app.use(cors({
  origin: "https://eliezelapolinaris2017-lab.github.io"
}));

app.use(express.json());

/* =========================
   ENDPOINT
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
    } = req.body;

    if (!name || !email || !phone || !service) {
      return res.status(400).json({ error: "Campos requeridos incompletos" });
    }

    if (!recaptchaToken) {
      return res.status(400).json({ error: "reCAPTCHA faltante" });
    }

    if (!process.env.RECAPTCHA_SECRET) {
      return res.status(500).json({ error: "RECAPTCHA_SECRET no configurado en Render" });
    }

    /* =========================
       Validar reCAPTCHA v3
       ========================= */
    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET,
          response: recaptchaToken
        })
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.success || (typeof verifyData.score === "number" && verifyData.score < 0.5)) {
      return res.status(403).json({ error: "Bloqueado por seguridad (reCAPTCHA)" });
    }

    /* =========================
       SMTP GMAIL (Render)
       - Config fija para evitar timeouts
       ========================= */
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000
    });

    const fromEmail = process.env.FROM_EMAIL || `"Oasis Form" <${process.env.SMTP_USER}>`;
    const toEmail = process.env.TO_EMAIL || process.env.SMTP_USER;

    const message = `
NUEVO CUESTIONARIO RECIBIDO

Nombre: ${name}
Email: ${email}
Teléfono: ${phone}
Servicio: ${service}

Detalles:
${details || "N/A"}
`;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: `Nuevo formulario – ${name}`,
      text: message,
      replyTo: email
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =========================
   START SERVER
   ========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});
