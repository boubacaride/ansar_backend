// NITA Transfert static-IP relay (2026-11-19). Mirror of amanataRelay.js.
//
// The ACJMN kiosk's MyNita payment function runs on Supabase Edge, which has
// no fixed egress IP, but NITA's partner API expects calls from IPs declared
// in "Mes adresses IP". This router forwards the already-signed NITA requests
// through this server, whose Render outbound IPs are static and declared with
// NITA. The X-NT HMAC signature covers the body bytes, so the body is kept
// raw (never parsed) and the /nita-relay prefix is stripped before forwarding.
//
// Env:
//   NITA_RELAY_TOKEN - shared secret; requests must carry it in
//                      x-relay-token or they get 403. No token set = 503,
//                      the relay never runs open.
//   NITA_BASE        - upstream base, default the sandbox/portal domain.
//
// GET /nita-relay/egress-ip (same token) reports this server's current
// outbound IP, used once to know what to declare in "Mes adresses IP".

const express = require("express");
const https = require("https");
const router = express.Router();

const UPSTREAM = (process.env.NITA_BASE || "https://developers.nitatransfert.com")
  .replace(/\/+$/, "");

// Only the signed NITA headers travel upstream; everything else is ours.
const FORWARD_HEADERS = [
  "x-nt-api-key",
  "x-nt-timestamp",
  "x-nt-nonce",
  "x-nt-signature",
  "authorization",
  "content-type",
];

function authorized(req, res) {
  const token = process.env.NITA_RELAY_TOKEN;
  if (!token) {
    res.status(503).json({ error: "relay_not_configured" });
    return false;
  }
  if (req.headers["x-relay-token"] !== token) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

router.get("/egress-ip", (req, res) => {
  if (!authorized(req, res)) return;
  https
    .get("https://api.ipify.org?format=json", (up) => {
      let data = "";
      up.on("data", (c) => (data += c));
      up.on("end", () => res.type("application/json").send(data));
    })
    .on("error", (e) => res.status(502).json({ error: String(e.message) }));
});

// Raw body: the HMAC covers the exact bytes, parsing would risk re-encoding.
router.use(express.raw({ type: () => true, limit: "1mb" }));

router.all(/^\/api\/.*/, (req, res) => {
  if (!authorized(req, res)) return;

  const upstreamPath = req.originalUrl.replace(/^\/nita-relay/, "");
  const headers = {};
  for (const h of FORWARD_HEADERS) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  const body =
    req.method === "GET" || req.method === "HEAD" || !Buffer.isBuffer(req.body)
      ? null
      : req.body;
  if (body) headers["content-length"] = body.length;

  const up = https.request(
    UPSTREAM + upstreamPath,
    { method: req.method, headers, timeout: 30000 },
    (upRes) => {
      res.status(upRes.statusCode || 502);
      if (upRes.headers["content-type"]) {
        res.type(upRes.headers["content-type"]);
      }
      upRes.pipe(res);
    },
  );
  up.on("timeout", () => {
    up.destroy();
    if (!res.headersSent) res.status(504).json({ error: "upstream_timeout" });
  });
  up.on("error", (e) => {
    if (!res.headersSent) res.status(502).json({ error: String(e.message) });
  });
  if (body) up.write(body);
  up.end();
});

module.exports = router;
