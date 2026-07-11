import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import solarRoutes from "./routes/solar.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allows your teammates' frontend (running on a different port/domain)
// to actually call this backend. Without this, browsers block the request.
app.use(cors());

// A simple health check so you can confirm the server is alive
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Solar backend is running." });
});

// All our real endpoints live under /api
app.use("/api", solarRoutes);

app.listen(PORT, () => {
  console.log(`✅ Solar backend running at http://localhost:${PORT}`);
  console.log(`   Try: http://localhost:${PORT}/api/solar?address=400 S Orange Ave, Orlando, FL`);
});
