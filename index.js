const connectToDatabase = require("./config/db.js");
const express = require("express");
const routes = require("./routes/routes");
const adminRoutes = require("./routes/adminRoutes");
const cors = require("cors");
const path = require("path");
const app = express();
require("dotenv").config();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Use environment variable for the port, defaulting to 4000 if not provided
const port = process.env.PORT || 4000;

// Mounted BEFORE express.json(): the relays must see the raw body bytes,
// the AmanaTa and NITA HMAC signatures cover them exactly.
app.use("/amanata-relay", require("./routes/amanataRelay"));
app.use("/nita-relay", require("./routes/nitaRelay"));

app.use(express.json());
app.use(cors());
app.use("/nuance", require("./routes/nuance"));
app.use("/", routes);
app.use("/admin", adminRoutes);

connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.log("Database connection failed!", err);
  });
