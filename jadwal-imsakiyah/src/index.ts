import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import imsakiyah from "./routes/imsakiyah";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Root Endpoint
app.get("/", (c) => {
  return c.json({
    success: true,
    message: "Selamat datang di API Jadwal Imsakiyah",
    endpoints: {
      list_kota: "GET /kota",
      list_kota_by_keyword: "GET /kota?keyword={keyword}",
      jadwal_hari_ini: "GET /jadwal/:kotaId",
      jadwal_by_tanggal: "GET /jadwal/{kotaId}/{tahun}/{bulan}/{hari}",
    },
  });
});

// Register Routes
app.route("/", imsakiyah);

export default app;
