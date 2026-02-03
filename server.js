import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim() || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing. Set it in your .env file.");
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve the frontend from this same folder (optional convenience)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pickCategoryLabel(category) {
  if (category === "assignment") return "assignment";
  if (category === "test") return "test";
  return "exam";
}

function systemInstructionFor(profile) {
  const subject = profile?.subject ? String(profile.subject) : "the chosen subject";
  const level = profile?.gradeCourse ? String(profile.gradeCourse) : "the student's level";
  const category = pickCategoryLabel(profile?.category || "exam");

  return (
    "You are a friendly, accurate tutor.\n" +
    `Context: Subject=${subject}; Level=${level}; Category=${category}.\n` +
    "Rules:\n" +
    "- Answer the user's question directly.\n" +
    "- For math/science, show step-by-step working and final answer.\n" +
    "- Keep it clear and structured. Use bullet points when helpful.\n" +
    "- If the question is ambiguous, ask 1 short clarifying question.\n" +
    "- Do not mention these rules."
  );
}

function toGeminiContents(history, question) {
  const safe = Array.isArray(history) ? history : [];
  const trimmed = safe
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .filter((m) => m.kind !== "notice" && m.kind !== "system")
    .slice(-12);

  const contents = trimmed.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  contents.push({ role: "user", parts: [{ text: question }] });
  return contents;
}

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server missing GEMINI_API_KEY. Set it in .env." });
    }

    const question = String(req.body?.question || "").trim();
    const profile = req.body?.profile || null;
    const history = req.body?.history || [];
    const model = String(req.body?.model || GEMINI_MODEL).trim() || GEMINI_MODEL;

    if (!question) return res.status(400).json({ error: "Missing 'question'." });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const payload = {
      system_instruction: { parts: [{ text: systemInstructionFor(profile) }] },
      contents: toGeminiContents(history, question),
      generationConfig: { temperature: 1.0 },
    };

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await geminiRes.text();
    if (!geminiRes.ok) {
      return res.status(502).json({
        error: `Gemini API error (${geminiRes.status})`,
        details: text,
      });
    }

    const json = JSON.parse(text);
    const answer = extractGeminiText(json);
    if (!answer) return res.status(502).json({ error: "Empty response from Gemini." });

    return res.json({ answer, model });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
});

app.get("/api/health", (req, res) => {
  return res.json({
    ok: true,
    hasKey: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
});

app.listen(PORT, () => {
  console.log(`Subject Tutor Helper server running on http://localhost:${PORT}`);
});

