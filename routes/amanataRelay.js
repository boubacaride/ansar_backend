// AmanaTa static-IP relay (2026-11-12).
//
// The ACJMN donation kiosk's payment functions run on Supabase Edge, which
// has no fixed egress IP, but AmanaTa's B2B API only accepts calls from
// declared IP addresses. This router forwards the already-signed AmanaTa
// requests through this server, whose Render outbound IPs are static and
// declared with AmanaTa. The HMAC signature covers the UPSTREAM path and the
// exact body bytes, so the body is kept raw (never parsed) and the
// /amanata-relay prefix is stripped before forwarding.
//
// Env:
//   AMANATA_RELAY_TOKEN - shared secret; requests must carry it in
//                         x-relay-token or they get 403. No token set = 503,
//                         the relay never runs open.
//   AMANATA_BASE        - upstream base, default the preprod URL.
//
// GET /amanata-relay/egress-ip (same token) reports this server's current
// outbound IP, used once to know what to declare with AmanaTa.

const express = require("express");
const https = require("https");
const router = express.Router();

const UPSTREAM = (process.env.AMANATA_BASE || "https://paiement.preprod-amn.com")
  .replace(/\/+$/, "");

// Only the signed AmanaTa headers travel upstream; everything else is ours.
const FORWARD_HEADERS = [
  "x-timestamp",
  "x-apikey",
  "x-signature",
  "authorization",
  "content-type",
];

function authorized(req, res) {
  const token = process.env.AMANATA_RELAY_TOKEN;
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

router.all(/^\/v1\/.*/, (req, res) => {
  if (!authorized(req, res)) return;

  const upstreamPath = req.originalUrl.replace(/^\/amanata-relay/, "");
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
