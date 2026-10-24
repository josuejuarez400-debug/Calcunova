// Función de Netlify: tutor con IA (Gemini).
// La clave NO va en el código: se guarda en Netlify como variable de entorno GEMINI_API_KEY.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const SYSTEM =
  "Eres un tutor de Precálculo y Cálculo para estudiantes universitarios. " +
  "Responde en español, con pasos cortos y lenguaje sencillo, máximo 180 palabras. " +
  "Si recibes un resultado de la calculadora, es el resultado oficial: no lo contradigas, solo explícalo. " +
  "Si no estás seguro de algo, dilo. No pidas ni uses datos personales.";

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  const reply = (code, obj) => ({ statusCode: code, headers, body: JSON.stringify(obj) });

  if (event.httpMethod !== "POST") return reply(405, { error: "Método no permitido." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(500, { error: "El tutor aún no está configurado (falta la clave)." });

  let q = "", ctx = "";
  try {
    const b = JSON.parse(event.body || "{}");
    q = String(b.question || "").slice(0, 800).trim();
    ctx = String(b.context || "").slice(0, 2500).trim();
  } catch (e) {
    return reply(400, { error: "Solicitud inválida." });
  }
  if (!q) return reply(400, { error: "Escribe una pregunta." });

  const text = (ctx ? "Resultado de la calculadora (oficial):\n" + ctx + "\n\n" : "") + "Pregunta del estudiante: " + q;
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
        }),
      }
    );
    if (r.status === 429) return reply(429, { error: "El tutor está ocupado (límite gratuito). Intenta en un minuto." });
    if (!r.ok) return reply(502, { error: "El tutor no pudo responder (código " + r.status + ")." });
    const d = await r.json();
    const parts = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
    const out = (parts || []).map((p) => p.text || "").join("").trim();
    if (!out) return reply(502, { error: "El tutor no devolvió respuesta." });
    return reply(200, { answer: out });
  } catch (e) {
    return reply(502, { error: "No se pudo contactar al tutor." });
  }
};
