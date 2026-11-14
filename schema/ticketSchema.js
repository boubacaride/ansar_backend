const mongoose = require("mongoose");

// Airplane-ticket requests from ansarvoyage.com/ticket (added 2026-11-14).
// Mirrors every field of the website form so SoftHadj can show them all.
const ticketSchema = new mongoose.Schema(
  {
    tripType: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    departDate: { type: String, required: true },
    returnDate: { type: String },
    passengers: { type: String },
    cabin: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    birthDate: { type: String },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    passportNumber: { type: String },
    passportCountry: { type: String },
    passportExpiry: { type: String },
    notes: { type: String },
    transferred: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
