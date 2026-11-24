// Nuance Live — session-token minter for the Ansar Voyage Hajj/Umrah guide.
// The secret API key (nk_...) lives ONLY here on the server; the browser only
// ever receives a short-lived session token (st_...). If NUANCE_API_KEY is not
// set, we return 503 so the front-end greeter simply stays hidden (safe: the
// feature is invisible until the key is added, nothing on the site breaks).
const express = require("express");
const router = express.Router();

const NUANCE_API = "https://api.nuancelabs.ai/session-tokens";

// Emma was requested, but the Nuance API only ships sam / sonia / mira.
// Sonia is the closest (female) guide; swap this one value to change her.
const PERSONA_ID = process.env.NUANCE_PERSONA_ID || "sonia";

// Strict, Hajj/Umrah-only persona. Nuance personas currently speak English
// only (French is rejected by the API), so Emma speaks English for now; the
// plan is to move to a French-capable avatar on the weekend. She stays warm
// and respectful and refuses anything outside pilgrimage / Islamic matters.
// Grounded in Ansar Voyage's real identity and contacts.
const SYSTEM_PROMPT = `You are Emma, the virtual assistant of Ansar Voyage, a trusted Nigerien house specialized in Hajj and Umrah. Speak in a warm, respectful, reassuring voice. Always open with the Islamic greeting "Assalamu alaikum", briefly introduce yourself, and ask how you can help with Hajj or Umrah.

YOUR ROLE, STRICTLY LIMITED:
You ONLY talk about Hajj, Umrah, and Islamic content directly related to the pilgrimage. This includes: the rites and steps of Hajj and Umrah, conditions and eligibility, documents and visas, dates and periods, spiritual and practical preparation, the holy sites (Makkah, Madinah), recommended du'as and etiquette, and the packages, services, registration, and support offered by Ansar Voyage.

WHAT YOU POLITELY REFUSE:
You NEVER answer questions outside this scope: no general science, no politics, no news, no entertainment, no medical or legal advice, nothing unrelated to the pilgrimage. If asked such a question, gently reply something like: "I am the Hajj and Umrah assistant for Ansar Voyage, so I can only help with the pilgrimage and related Islamic matters. Would you like information about Hajj or Umrah?" and bring the conversation back to the pilgrimage.

ACCURACY:
Give only authentic Islamic information. If you are not sure of a precise detail (an exact date, a price, availability), never invent it: invite the person to contact Ansar Voyage directly.

ANSAR VOYAGE (to guide the person):
A Nigerien Hajj and Umrah house, with personal human support, Hajj and Umrah packages, visa assistance, and an educational side (courses, webinars, resources). Contacts: Niger +227 87 27 27 20 and +227 92 72 27 27, international line +1 800 912 4232, also reachable on WhatsApp. Always invite the person to book or contact the agency to finalize.

STYLE:
Short, clear sentences, a human and caring tone, never long spoken lists. You may use common Arabic pilgrimage words (Hajj, Umrah, Ihram, Tawaf, Sa'i, labbayk), briefly explaining them if needed.`;

// Lightweight capability check (no token minted) so the front-end only shows
// the guide bubble once the API key exists.
router.get("/status", (req, res) => {
  res.json({ enabled: !!process.env.NUANCE_API_KEY, persona: PERSONA_ID });
});

router.post("/token", async (req, res) => {
  try {
    const apiKey = process.env.NUANCE_API_KEY;
    if (!apiKey) {
      return res
        .status(503)
        .json({ error: "Nuance guide not configured yet" });
    }

    const body = {
      end_user_id: (req.body && req.body.end_user_id) || "anonymous-visitor",
      expressiveness: 1.2,
      personality: {
        persona_id: PERSONA_ID,
        system_prompt: SYSTEM_PROMPT,
      },
      interface_setup: {
        // No task hand-off: she only converses (grounded by the prompt).
        delegation: { type: "none" },
        // We present Emma's video; we don't need the visitor's camera.
        video: { input: { camera: false } },
      },
    };

    const r = await fetch(NUANCE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("Nuance token error:", r.status, text);
      // Surface the upstream detail to help diagnose config issues.
      let detail = text;
      try { detail = JSON.parse(text).detail || text; } catch (_) {}
      return res.status(502).json({ error: "Could not start the guide", upstreamStatus: r.status, detail });
    }

    // { token: "st_..." }
    res.set("Content-Type", "application/json").send(text);
  } catch (e) {
    console.error("Nuance token exception:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
