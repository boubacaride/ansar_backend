const mongoose = require("mongoose");

// Contact-form questions from ansarvoyage.com (added 2026-11-14 so SoftHadj
// can list them; before this they were only emailed, never stored).
const contactSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
