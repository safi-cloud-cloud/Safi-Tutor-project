/* Subject Tutor Helper (offline, no API key) */

const STORAGE_KEYS = {
  theme: "sth_theme",
  profile: "sth_profile",
  chat: "sth_chat_v1",
};

const $ = (id) => document.getElementById(id);

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function nowTs() {
  return Date.now();
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(STORAGE_KEYS.theme, t);
  $("themeIcon").textContent = t === "dark" ? "☀" : "☾";
  $("themeLabel").textContent = t === "dark" ? "Light" : "Dark";
}

function loadTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  applyTheme(stored || getSystemTheme());
}

function getProfile() {
  const raw = localStorage.getItem(STORAGE_KEYS.profile);
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const subject = String(parsed.subject || "").trim();
  const gradeCourse = String(parsed.gradeCourse || "").trim();
  const category = String(parsed.category || "").trim();
  if (!subject || !gradeCourse || !category) return null;
  return { subject, gradeCourse, category };
}

function setProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

function renderProfileSummary(profile) {
  const el = $("profileSummary");
  if (!profile) {
    el.textContent = "Not set yet. Fill the form to personalize the tutor chatbot.";
    return;
  }

  const categoryLabel =
    profile.category === "exam"
      ? "Exams"
      : profile.category === "test"
        ? "Tests"
        : profile.category === "assignment"
          ? "Assignments"
          : profile.category;

  el.textContent = `${profile.subject} • ${profile.gradeCourse} • ${categoryLabel}`;
}

function fillProfileForm(profile) {
  if (!profile) return;
  $("subject").value = profile.subject;
  $("gradeCourse").value = profile.gradeCourse;
  $("category").value = profile.category;
}

function loadChat() {
  const raw = localStorage.getItem(STORAGE_KEYS.chat);
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string" &&
        // allow extra fields like kind/model, but keep payload sane
        (!m.kind || typeof m.kind === "string")
    )
    .slice(-200);
}

function saveChat(chat) {
  localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(chat.slice(-200)));
}

function clearMessagesUI() {
  $("messages").innerHTML = "";
}

function addMessageToUI(msg) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${msg.role}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${msg.role === "user" ? "You" : "Tutor"} • ${formatTime(msg.ts || nowTs())}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = msg.text;

  wrap.appendChild(meta);
  wrap.appendChild(bubble);
  $("messages").appendChild(wrap);
  $("messages").scrollTop = $("messages").scrollHeight;
  return { wrap, bubble };
}

function renderAllMessages(chat) {
  clearMessagesUI();
  for (const msg of chat) addMessageToUI(msg);
}

function suggestionTemplates(profile) {
  const subject = profile?.subject || "my subject";
  const gradeCourse = profile?.gradeCourse || "my grade/course";
  const category = profile?.category || "exam";

  const base = [
    `Explain this topic in simple words: [topic]`,
    `Make me a 7-day study plan for ${subject} (${gradeCourse})`,
    `Give me 5 practice questions for [topic] with answers`,
    `What are the most common mistakes in [topic] and how to avoid them?`,
  ];

  if (category === "assignment") {
    base.unshift(`Help me plan my ${subject} assignment on [topic] (outline + steps)`);
  } else if (category === "test") {
    base.unshift(`Help me prepare for a ${subject} test on [topic] (quick revision)`);
  } else {
    base.unshift(`Help me prepare for my ${subject} exam (high-yield revision plan)`);
  }

  return base;
}

function renderSuggestionChips(profile) {
  const wrap = $("suggestionChips");
  wrap.innerHTML = "";
  for (const text of suggestionTemplates(profile).slice(0, 6)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      $("chatInput").value = text;
      $("chatInput").focus();
    });
    wrap.appendChild(btn);
  }
}

function pickCategoryLabel(category) {
  if (category === "assignment") return "assignment";
  if (category === "test") return "test";
  return "exam";
}

function detectIntent(q) {
  const t = normalizeText(q);

  const ask = (words) => words.some((w) => t.includes(w));

  if (ask(["plan", "timetable", "schedule", "revision", "revise", "prepare", "study plan"])) return "plan";
  if (ask(["practice", "questions", "mcq", "quiz", "problems", "past paper", "worksheet"])) return "practice";
  if (ask(["define", "meaning", "what is", "explain", "concept", "summary", "in simple"])) return "explain";
  if (ask(["how do i", "how to", "steps", "method", "approach", "solve"])) return "steps";
  if (ask(["notes", "cheat sheet", "formula", "formulas", "key points"])) return "notes";
  return "general";
}

function subjectHint(profile) {
  const s = normalizeText(profile?.subject || "");
  if (s.includes("math")) return "math";
  if (s.includes("phys")) return "physics";
  if (s.includes("chem")) return "chemistry";
  if (s.includes("bio")) return "biology";
  if (s.includes("english")) return "english";
  if (s.includes("history")) return "history";
  if (s.includes("geography")) return "geography";
  if (s.includes("computer")) return "cs";
  if (s.includes("econom")) return "economics";
  if (s.includes("account")) return "accounting";
  if (s.includes("business")) return "business";
  if (s.includes("language")) return "languages";
  return "general";
}

async function generateReplyViaBackend({ question, profile, history }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, profile, history }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend request failed (${res.status}). ${text}`.trim());
  }

  const json = await res.json();
  const answer = typeof json?.answer === "string" ? json.answer.trim() : "";
  if (!answer) throw new Error("Backend returned an empty answer.");
  return answer;
}

function generateReply(question, profile) {
  const q = String(question || "").trim();
  const qn = normalizeText(q);

  if (!q) return "Ask me a question and I’ll help.";

  if (!profile) {
    return (
      "Before we start: please fill your setup on the left (Subject + Grade/Course + Category). " +
      "Then ask again so I can tailor the explanation and practice to your level."
    );
  }

  const subject = profile.subject;
  const level = profile.gradeCourse;
  const category = pickCategoryLabel(profile.category);
  const intent = detectIntent(q);
  const s = subjectHint(profile);

  const opener = `Here’s a helpful approach for ${subject} (${level}) focusing on your ${category}:`;

  // Short question guard
  if (qn.split(" ").length < 3 && intent === "general") {
    return (
      `${opener}\n\n` +
      "Tell me the exact topic (1–3 words) and what you want:\n" +
      "- Explain the concept\n" +
      "- Practice questions\n" +
      "- Step-by-step method\n" +
      "- Revision plan\n\n" +
      "Example: “Explain photosynthesis” or “5 quadratic equation questions with answers”."
    );
  }

  // Universal category guidance
  const categoryBlock =
    category === "exam"
      ? "Exam focus: high-yield topics, timed practice, and spaced revision.\n"
      : category === "test"
        ? "Test focus: quick recall + targeted practice on the exact chapters.\n"
        : "Assignment focus: clear structure, correct method, and strong explanation of steps.\n";

  // Subject-specific scaffolds
  const subjectBlocks = {
    math: {
      explain:
        "Math explanation template:\n" +
        "1) What the idea means (in 1–2 lines)\n" +
        "2) When to use it (signals in the question)\n" +
        "3) A tiny worked example\n" +
        "4) Common mistakes + quick checks\n",
      steps:
        "Step-by-step solving checklist:\n" +
        "1) Write what’s given + what’s asked\n" +
        "2) Pick the rule/formula and state why\n" +
        "3) Solve carefully (one line per step)\n" +
        "4) Substitute back / verify units / sanity-check\n",
      practice:
        "Practice set (tell me the chapter/topic to tailor it):\n" +
        "1) Easy: …\n2) Medium: …\n3) Medium: …\n4) Hard: …\n5) Timed: …\n\n" +
        "Reply with your topic (e.g., “linear equations”, “trigonometry”, “probability”) and I’ll generate real questions + answers.",
      notes: "Share the topic and I’ll make a mini formula sheet + 10 key points.",
    },
    physics: {
      explain:
        "Physics explanation template:\n" +
        "1) Concept in words (what’s happening physically)\n" +
        "2) Key quantities + units\n" +
        "3) Core equation(s) and meaning of each term\n" +
        "4) One small example + common traps\n",
      steps:
        "Problem-solving steps:\n" +
        "1) Sketch/diagram (even rough)\n" +
        "2) List knowns/unknowns with units\n" +
        "3) Choose equations + assumptions\n" +
        "4) Solve + check units + check magnitude\n",
      practice:
        "Tell me the topic (e.g., “kinematics”, “electric circuits”, “work-energy”) and I’ll generate 5 questions + answers (including units).",
      notes: "Tell me the chapter; I’ll summarize formulas + when to use them.",
    },
    chemistry: {
      explain:
        "Chemistry explanation template:\n" +
        "1) Big idea (particles/structure)\n" +
        "2) Key definitions\n" +
        "3) Typical question types + how to spot them\n" +
        "4) One worked example (moles/stoichiometry if needed)\n",
      steps:
        "Method checklist:\n" +
        "1) Write balanced equation (if relevant)\n" +
        "2) Convert to moles\n" +
        "3) Use ratios\n" +
        "4) Convert back (mass/volume/concentration)\n" +
        "5) Sanity-check significant figures/units\n",
      practice:
        "Tell me the topic (e.g., “moles”, “acids & bases”, “equilibrium”) and I’ll generate practice + answers.",
      notes: "Tell me the chapter; I’ll make a high-yield summary (definitions + common reactions).",
    },
    biology: {
      explain:
        "Biology explanation template:\n" +
        "1) Definition\n" +
        "2) Where it happens (organelle/organ/system)\n" +
        "3) Steps (as a simple flow)\n" +
        "4) Why it matters + common exam phrasing\n",
      steps:
        "Answer-writing method (great for exams):\n" +
        "1) Use correct key terms\n" +
        "2) Explain cause → effect\n" +
        "3) Mention location/enzymes/conditions if asked\n" +
        "4) Keep it in logical order\n",
      practice:
        "Tell me the topic (e.g., “photosynthesis”, “respiration”, “genetics”) and I’ll create exam-style questions + marking points.",
      notes: "Tell me the topic and I’ll generate a revision sheet + key diagrams to draw from memory.",
    },
    english: {
      explain:
        "English explanation template:\n" +
        "1) Define the term\n" +
        "2) Why it’s used (effect on reader)\n" +
        "3) One short example\n" +
        "4) How to write it in an answer (PEE/PEEL)\n",
      steps:
        "Essay/answer structure:\n" +
        "1) Thesis (1–2 lines)\n" +
        "2) 2–3 body paragraphs (Point → Evidence → Explain → Link)\n" +
        "3) Conclusion (restate thesis + big insight)\n",
      practice:
        "Tell me your text/topic and the question type (analysis / creative writing / letter / report). I’ll generate practice prompts + a model outline.",
      notes: "Tell me the topic and I’ll draft a vocabulary + techniques cheat-sheet.",
    },
    history: {
      explain:
        "History explanation template:\n" +
        "1) Background (what led to it)\n" +
        "2) Key events (timeline)\n" +
        "3) Causes vs consequences\n" +
        "4) Different perspectives (if relevant)\n",
      steps:
        "Essay method:\n" +
        "1) Answer the question directly (argument)\n" +
        "2) 2–3 paragraphs: claim + evidence + analysis\n" +
        "3) Weigh factors (most/least important)\n" +
        "4) Conclusion: judgement + why\n",
      practice:
        "Tell me your unit (e.g., “Cold War”, “WW1”) and I’ll create exam-style questions + a sample thesis.",
      notes: "Tell me the unit and I’ll make a timeline + key terms list.",
    },
    geography: {
      explain:
        "Geography explanation template:\n" +
        "1) Define the process/pattern\n" +
        "2) Where it happens + why there\n" +
        "3) Impacts (social/economic/environmental)\n" +
        "4) Case study angle (if required)\n",
      steps:
        "Structured response method:\n" +
        "1) Use key terms\n" +
        "2) Explain process → impact\n" +
        "3) Add data (percentages/figures) if you have it\n" +
        "4) Link to case study\n",
      practice:
        "Tell me the topic (e.g., “rivers”, “urbanization”, “climate hazards”) and I’ll generate exam-style questions + marking points.",
      notes: "Tell me the topic and I’ll create a case-study-ready summary.",
    },
    cs: {
      explain:
        "Computer Science explanation template:\n" +
        "1) What it is (simple definition)\n" +
        "2) Where it’s used\n" +
        "3) Core idea (data / control flow / complexity)\n" +
        "4) Tiny example (pseudocode)\n",
      steps:
        "Problem-solving steps:\n" +
        "1) Restate the problem + input/output\n" +
        "2) Choose data structures\n" +
        "3) Write algorithm (pseudocode)\n" +
        "4) Test with 2–3 cases\n" +
        "5) Consider time/space complexity\n",
      practice:
        "Tell me the topic (e.g., “arrays”, “recursion”, “SQL”, “OOP”) and I’ll generate 5 practice questions + short answers.",
      notes: "Tell me the chapter and I’ll create a quick cheat-sheet (definitions + common pitfalls).",
    },
    economics: {
      explain:
        "Economics explanation template:\n" +
        "1) Define key terms\n" +
        "2) Explain the mechanism (cause → effect)\n" +
        "3) Use a simple diagram idea (if applicable)\n" +
        "4) Give a real-world example\n",
      steps:
        "Answer method:\n" +
        "1) Define\n" +
        "2) Explain\n" +
        "3) Apply to scenario\n" +
        "4) Evaluate (pros/cons, short vs long run)\n",
      practice:
        "Tell me the topic (e.g., “elasticity”, “market failure”, “inflation”) and I’ll generate questions + model points.",
      notes: "Tell me the topic and I’ll create diagram notes + key definitions.",
    },
    accounting: {
      explain:
        "Accounting explanation template:\n" +
        "1) Define the concept\n" +
        "2) Where it appears in the statements\n" +
        "3) Typical journal entries (if relevant)\n" +
        "4) Common exam mistakes\n",
      steps:
        "Method checklist:\n" +
        "1) Identify accounts\n" +
        "2) Apply debit/credit rules\n" +
        "3) Post to ledger (if needed)\n" +
        "4) Balance and verify (trial balance logic)\n",
      practice:
        "Tell me the topic (e.g., “depreciation”, “inventory”, “journals”) and I’ll create practice questions + answers.",
      notes: "Tell me the topic and I’ll make a journal-entry cheat-sheet.",
    },
    business: {
      explain:
        "Business Studies explanation template:\n" +
        "1) Define the term\n" +
        "2) Why it matters to a business\n" +
        "3) Advantages vs disadvantages\n" +
        "4) Example scenario\n",
      steps:
        "Case-study answer method:\n" +
        "1) Identify the issue\n" +
        "2) Apply theory\n" +
        "3) Recommend + justify\n" +
        "4) Mention risks/limitations\n",
      practice:
        "Tell me the topic (e.g., “marketing mix”, “HR”, “finance”) and I’ll generate case questions + model points.",
      notes: "Tell me the topic and I’ll make concise notes + key definitions.",
    },
    languages: {
      explain:
        "Language learning template:\n" +
        "1) Meaning + usage\n" +
        "2) Example sentences\n" +
        "3) Common mistakes\n" +
        "4) Quick practice (fill-in / translation)\n",
      steps:
        "Study method:\n" +
        "1) Learn in phrases, not single words\n" +
        "2) Spaced repetition flashcards\n" +
        "3) Short daily listening + speaking practice\n" +
        "4) Weekly writing task + corrections\n",
      practice:
        "Tell me the language + the topic (e.g., “past tense”, “food vocabulary”) and I’ll generate practice.",
      notes: "Tell me the grammar topic and I’ll create a quick rule + examples sheet.",
    },
    general: {
      explain:
        "Explain it like this:\n" +
        "1) Simple definition\n" +
        "2) Key parts/steps\n" +
        "3) One example\n" +
        "4) What to memorize vs what to understand\n",
      steps:
        "Steps:\n" +
        "1) Clarify the goal\n" +
        "2) Break into smaller parts\n" +
        "3) Practice the hardest part first\n" +
        "4) Review mistakes and retry\n",
      practice: "Tell me the topic and I’ll generate practice questions and a marking checklist.",
      notes: "Tell me the topic and I’ll summarize the key points.",
    },
  };

  const block = subjectBlocks[s] || subjectBlocks.general;

  if (intent === "plan") {
    return (
      `${opener}\n\n` +
      categoryBlock +
      "\n7-day plan (adjust the time to your schedule):\n" +
      "Day 1: Learn key concepts + make short notes\n" +
      "Day 2: Easy practice + fix weak spots\n" +
      "Day 3: Medium practice + timed mini-set\n" +
      "Day 4: Mixed practice + review mistakes\n" +
      "Day 5: Past-paper style questions (timed)\n" +
      "Day 6: Re-test weak topics + flashcards/definitions\n" +
      "Day 7: Full timed set + final review\n\n" +
      "If you tell me your exact chapters/topics and how many days you have, I’ll personalize this plan."
    );
  }

  if (intent === "practice") {
    return `${opener}\n\n${categoryBlock}\n${block.practice}`;
  }

  if (intent === "notes") {
    return `${opener}\n\n${categoryBlock}\n${block.notes}`;
  }

  if (intent === "explain") {
    return `${opener}\n\n${categoryBlock}\n${block.explain}\nYour question: "${q}"\n\nIf you paste the exact textbook question (or a photo typed out), I can tailor it more.`;
  }

  if (intent === "steps") {
    return `${opener}\n\n${categoryBlock}\n${block.steps}\n\nShare the exact problem statement and I’ll guide you through it step-by-step.`;
  }

  // General fallback
  return (
    `${opener}\n\n` +
    categoryBlock +
    "\nTo help best, reply with:\n" +
    "1) The exact topic/chapter\n" +
    "2) The exact question (copy/paste)\n" +
    "3) What you’ve tried so far (even if it’s wrong)\n\n" +
    "Then I’ll explain + give practice + a quick checklist."
  );
}

function makeWelcomeMessage(profile) {
  if (!profile) {
    return (
      "Hi! I’m your Subject Tutor Helper.\n\n" +
      "Start by setting:\n" +
      "- Subject\n" +
      "- Grade / Course\n" +
      "- Category (Exams / Tests / Assignments)\n\n" +
      "Then ask me anything like: “Explain quadratic equations” or “Give me 5 photosynthesis questions”."
    );
  }

  const categoryLabel =
    profile.category === "exam" ? "Exams" : profile.category === "test" ? "Tests" : "Assignments";

  return (
    `Hi! Setup loaded: ${profile.subject} • ${profile.gradeCourse} • ${categoryLabel}\n\n` +
    "Ask a question (include the topic name), and I’ll reply with:\n" +
    "- an explanation\n" +
    "- a method\n" +
    "- practice ideas\n" +
    "- common mistakes\n"
  );
}

function boot() {
  loadTheme();

  let profile = getProfile();
  fillProfileForm(profile);
  renderProfileSummary(profile);
  renderSuggestionChips(profile);

  let chat = loadChat();
  if (chat.length === 0) {
    chat = [{ role: "assistant", text: makeWelcomeMessage(profile), ts: nowTs(), kind: "notice" }];
    saveChat(chat);
  }
  renderAllMessages(chat);

  $("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });


  $("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const next = {
      subject: $("subject").value.trim(),
      gradeCourse: $("gradeCourse").value.trim(),
      category: $("category").value.trim(),
    };
    setProfile(next);
    profile = next;
    renderProfileSummary(profile);
    renderSuggestionChips(profile);

    chat.push({
      role: "assistant",
      text: `Saved. I’ll tailor answers to: ${profile.subject} (${profile.gradeCourse}).`,
      ts: nowTs(),
      kind: "notice",
    });
    saveChat(chat);
    addMessageToUI(chat[chat.length - 1]);
  });

  $("resetProfile").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.profile);
    profile = null;
    $("profileForm").reset();
    renderProfileSummary(profile);
    renderSuggestionChips(profile);

    chat.push({
      role: "assistant",
      text: "Setup reset. Fill it again so I can personalize your tutoring.",
      ts: nowTs(),
      kind: "notice",
    });
    saveChat(chat);
    addMessageToUI(chat[chat.length - 1]);
  });

  $("newChat").addEventListener("click", () => {
    chat = [{ role: "assistant", text: makeWelcomeMessage(profile), ts: nowTs(), kind: "notice" }];
    saveChat(chat);
    renderAllMessages(chat);
  });

  $("clearChat").addEventListener("click", () => {
    chat = [];
    saveChat(chat);
    renderAllMessages(chat);
  });

  $("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("chatInput");
    const text = input.value.trim();
    if (!text) return;

    const sendBtn = $("sendBtn");
    input.disabled = true;
    sendBtn.disabled = true;

    const userMsg = { role: "user", text, ts: nowTs() };
    chat.push(userMsg);
    addMessageToUI(userMsg);
    input.value = "";

    const pending = addMessageToUI({ role: "assistant", text: "Thinking…", ts: nowTs(), kind: "pending" });

    try {
      // Always use Gemini via backend. If backend isn't running, fall back to offline mode.
      const replyText = await generateReplyViaBackend({
        question: text,
        profile,
        history: chat,
      });

      pending.bubble.textContent = replyText;

      const botMsg = { role: "assistant", text: replyText, ts: nowTs() };
      chat.push(botMsg);
      saveChat(chat);
    } catch (err) {
      const fallback = generateReply(text, profile);
      const msg =
        "Backend Gemini is not available (server not running or missing API key). Falling back to offline tutor mode.\n\n" +
        `Error: ${String(err?.message || err)}\n\n` +
        "Offline answer:\n" +
        fallback;

      pending.bubble.textContent = msg;

      const botMsg = { role: "assistant", text: msg, ts: nowTs(), kind: "notice" };
      chat.push(botMsg);
      saveChat(chat);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });

  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("sendBtn").click();
    }
  });
}

document.addEventListener("DOMContentLoaded", boot);

