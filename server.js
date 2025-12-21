import express from "express";

const app = express();
app.use(express.json());

app.post("/api/submit", async (req, res) => {
  try {
    const { nombre, email, telefono, servicio, mensaje } = req.body;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Formulario Web <onboarding@resend.dev>",
        to: [process.env.TO_EMAIL],
        subject: "Nuevo formulario recibido",
        html: `
          <h3>Nuevo formulario</h3>
          <p><b>Nombre:</b> ${nombre}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Teléfono:</b> ${telefono}</p>
          <p><b>Servicio:</b> ${servicio}</p>
          <p><b>Mensaje:</b> ${mensaje}</p>
        `,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR:", error.message);
    res.status(500).json({ error: "Error enviando formulario" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor activo en puerto", PORT);
});

