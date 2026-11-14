const express = require("express");
const path = require("path");
const router = express.Router();
const controller = require("../controller/controller");
const { sendEmailContact } = require("../controller/emailController");
const admin = require("../model/createAdmin");

router.get("/test", (req, res) => {
  res.send("<h1>Ansar Backend is up and running :)</h1>");
});

// Legal pages (served for SMS/A2P compliance and general use).
router.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "privacy.html"));
});
router.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "terms.html"));
});

// router.get("/email", (req, res) => {
//   sendEmail("work632294@gmail.com");
// });

router.post("/contact_email", async (req, res) => {
  // Store the question first (2026-11-14): SoftHadj lists these; a mail
  // failure must not lose the record, and a store failure must not block
  // the mail.
  try {
    const Contact = require("../schema/contactSchema");
    const { email, subject, message } = req.body || {};
    if (email && subject && message) {
      await Contact.create({ email, subject, message });
    }
  } catch (err) {
    console.log("Contact store failed:", err.message);
  }
  sendEmailContact(req.body, res);
});

// Airplane-ticket requests (2026-11-14): stored for SoftHadj's Billets
// d'avion table; the company is still notified by email via the existing
// contact mailer so nothing changes operationally.
router.post("/ticket_book", async (req, res) => {
  try {
    const Ticket = require("../schema/ticketSchema");
    const t = await Ticket.create(req.body);
    try {
      sendEmailContact(
        {
          email: t.email,
          subject: `Billet d'avion : ${t.from} -> ${t.to} (${t.departDate})`,
          message: JSON.stringify(t.toObject(), null, 2),
        },
        { status: () => ({ json: () => {} }) }
      );
    } catch (e) {
      console.log("Ticket email failed:", e.message);
    }
    res.json({ status: "success", data: t });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: error.message });
  }
});

router.get("/ticket_records", async (req, res) => {
  try {
    const Ticket = require("../schema/ticketSchema");
    const records = await Ticket.find().sort({ createdAt: -1 });
    res.json({ data: records, status: "success" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching tickets", error: error.message });
  }
});

// Mark a website submission as transferred into SoftHadj (approve flow).
router.post("/mark_transferred", async (req, res) => {
  try {
    const { collection, id } = req.body || {};
    const models = {
      hajj: require("../schema/hajjSchema"),
      umra: require("../schema/umraSchema"),
      ticket: require("../schema/ticketSchema"),
    };
    const Model = models[collection];
    if (!Model || !id) {
      return res.status(400).json({ status: "error", message: "Bad request" });
    }
    await Model.updateOne(
      { _id: id },
      { $set: { transferred: true } },
      { strict: false }
    );
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/contact_records", async (req, res) => {
  try {
    const Contact = require("../schema/contactSchema");
    const records = await Contact.find().sort({ createdAt: -1 });
    res.json({ data: records, status: "success" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching contacts", error: error.message });
  }
});

router.post("/hajj_book", (req, res) => {
  const data = req.body;
  controller.registerHajjController(data, res);
});

router.post("/umra_book", (req, res) => {
  const data = req.body;
  controller.registerUmraController(data, res);
});

router.post("/admin-login", (req, res) => {
  const data = req.body;
  controller.adminLoginController(data, res);
});

router.get("/hajj_records", (req, res) => {
  controller.fetchHajjController(res);
});

router.get("/umra_records", (req, res) => {
  controller.fetchUmraController(res);
});

router.get("/records", async (req, res) => {
  try {
    const hajjResponse = await fetch(
      "https://ansar-backend.onrender.com/hajj_records"
    );
    const umraResponse = await fetch(
      "https://ansar-backend.onrender.com/umra_records"
    );

    const hajjRecords = await hajjResponse.json();
    const umraRecords = await umraResponse.json();

    res.render("records", {
      hajjRecords: hajjRecords.data,
      umraRecords: umraRecords.data,
    });
  } catch (error) {
    res.status(500).send("Error fetching records");
  }
});


router.get("/lessons/:year", async (req, res) => {
    try {
          const Lesson = require("../schema/lectureSchema");
          const lessons = await Lesson.find({ year: req.params.year });
          res.json({ data: lessons, status: "success" });
    } catch (error) {
          res
            .status(500)
            .json({ message: "Error fetching videos", error: error.message });
    }
});
router.get("/lessons", async (req, res) => {
  try {
    await controller.fetchLecturesController(req, res);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching videos", error: error.message });
  }
});

module.exports = router;
