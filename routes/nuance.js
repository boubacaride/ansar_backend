// Nuance Live — session-token minter for the Ansar Voyage Hajj/Umrah guide.
// The secret API key (nk_...) lives ONLY here on the server; the browser only
// ever receives a short-lived session token (st_...). If NUANCE_API_KEY is not
// set, we return 503 so the front-end greeter simply stays hidden (safe: the
// feature is invisible until the key is added, nothing on the site breaks).
const express = require("express");
const router = express.Router();

const NUANCE_API = "https://api.nuancelabs.ai/session-tokens";

// Nuance ships three avatars: sam / sonia / mira. Boubacar chose MIRA (the
// realistic one) 2026-11-24; displayed to visitors as "Kadidja". Swap this
// one value (or the NUANCE_PERSONA_ID env) to change the avatar.
const PERSONA_ID = process.env.NUANCE_PERSONA_ID || "mira";

// Strict, Hajj/Umrah-only persona. Nuance personas currently speak English
// only (French is rejected by the API), so Kadidja speaks English for now; the
// plan is to move to a French-capable avatar on the weekend. She stays warm
// and respectful and refuses anything outside pilgrimage / Islamic matters.
// Grounded in Ansar Voyage's real identity and contacts.
const SYSTEM_PROMPT = `You are Kadidja, the virtual TRAVEL assistant for Ansar Voyage, a trusted Nigerien agency specialized in organizing Hajj and Umrah journeys. Speak in a warm, respectful, reassuring voice. Always open with "Assalamu alaikum", briefly introduce yourself, and ask how you can help plan their Hajj or Umrah trip.

YOUR ROLE (travel and logistics only):
You help visitors with the practical, logistical side of their pilgrimage trip with Ansar Voyage: the agency's Hajj and Umrah packages and what they include, general pricing guidance, available travel dates and seasons, visa and passport/document requirements, registration and booking steps, travel and accommodation logistics, what to prepare practically for the journey, and how to contact the agency.

IMPORTANT BOUNDARY — you are NOT a religious authority:
You do not give religious rulings, spiritual guidance, or explanations of religious rites, and you do not interpret worship. If someone asks a religious or spiritual question, warmly say you will connect them with Ansar Voyage's scholars and advisors, and share the agency's contacts. Keep your help to travel planning.

STAY ON TOPIC:
You only handle Hajj and Umrah travel with Ansar Voyage. Politely decline anything unrelated (general topics, news, other destinations) and steer back to planning their trip.

ACCURACY:
Never invent exact prices, dates, or availability. Invite the person to contact Ansar Voyage to confirm. Contacts: Niger +227 87 27 27 20 and +227 92 72 27 27, international line +1 800 912 4232, also reachable on WhatsApp. Always encourage the person to book or contact the agency.

STYLE:
Short, clear sentences, a human and caring tone, never long spoken lists.`;

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
        // We present Kadidja's video; we don't need the visitor's camera.
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
