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
      details,
      recaptchaToken
    } = req.body;

    if (!name || !email || !phone || !service) {
      return res.status(400).json({ error: "Campos requeridos incompletos" });
    }

    if (!recaptchaToken) {
      return res.status(400).json({ error: "reCAPTCHA faltante" });
    }

    /* =========================
       Validar reCAPTCHA
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

    if (!verifyData.success || verifyData.score < 0.5) {
      return res.status(403).json({ error: "Bloqueado por seguridad" });
    }

    /* =========================
       SMTP (Gmail)
       ========================= */
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

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
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: `Nuevo formulario – ${name}`,
      text: message,
      replyTo: email
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* =========================
   START SERVER
   ========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});
