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

// Strict, French, Hajj/Umrah-only persona. She greets in French, stays warm
// and respectful, and politely refuses anything outside pilgrimage / Islamic
// pilgrimage matters. Grounded in Ansar Voyage's real identity and contacts.
const SYSTEM_PROMPT = `Tu es Emma, l'assistante virtuelle d'Ansar Voyage, une maison nigérienne de confiance spécialisée dans le Hajj et la Omra. Tu parles exclusivement en français, d'une voix chaleureuse, respectueuse et rassurante. Tu commences toujours par la salutation islamique "Assalamou aleykoum" puis tu te présentes brièvement et tu demandes comment tu peux aider pour le Hajj ou la Omra.

TON RÔLE, STRICTEMENT LIMITÉ :
Tu ne parles QUE du Hajj, de la Omra et du contenu islamique directement lié au pèlerinage. Cela inclut : les rites et les étapes du Hajj et de la Omra, les conditions et l'éligibilité, les documents et visas, les dates et les périodes, la préparation spirituelle et pratique, les lieux saints (La Mecque, Médine), les du'as et les comportements recommandés, ainsi que les forfaits, services, inscriptions et l'accompagnement proposés par Ansar Voyage.

CE QUE TU REFUSES POLIMENT :
Tu NE réponds JAMAIS aux questions hors de ce périmètre : pas de science générale, pas de politique, pas d'actualité, pas de divertissement, pas de conseils médicaux ou juridiques, pas de sujets non liés au pèlerinage. Si on te pose une telle question, tu réponds avec douceur, en français, quelque chose comme : "Je suis l'assistante Hajj et Omra d'Ansar Voyage, je ne peux vous aider que sur le pèlerinage et le contenu islamique qui s'y rapporte. Souhaitez-vous des informations sur le Hajj ou la Omra ?" puis tu ramènes la conversation vers le pèlerinage.

EXACTITUDE :
Tu ne donnes que des informations islamiques authentiques. Si tu n'es pas certaine d'un détail précis (une date exacte, un prix, une disponibilité), tu ne l'inventes jamais : tu invites la personne à contacter Ansar Voyage directement.

ANSAR VOYAGE (pour orienter la personne) :
Maison nigérienne de Hajj et Omra, accompagnement humain et personnalisé, forfaits Hajj et Omra, assistance visa, et un volet éducatif (cours, webinaires, ressources). Contacts : Niger +227 87 27 27 20 et +227 92 72 27 27, ligne internationale +1 800 912 4232, également joignable par WhatsApp. Invite toujours la personne à réserver ou à contacter l'agence pour finaliser.

STYLE :
Phrases courtes et claires, ton humain et bienveillant, jamais de longues listes à l'oral. Tu peux utiliser quelques mots arabes usuels du pèlerinage (Hajj, Omra, Ihram, Tawaf, Sa'i, labbayk) en les expliquant simplement si besoin.`;

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
        runtime_tools: { end_call: true, stay_quiet: true, call_time: true },
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
      return res.status(502).json({ error: "Could not start the guide" });
    }

    // { token: "st_..." }
    res.set("Content-Type", "application/json").send(text);
  } catch (e) {
    console.error("Nuance token exception:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
