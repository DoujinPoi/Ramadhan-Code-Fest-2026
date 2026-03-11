import { Hono } from "hono";
import {
  getJadwalHariIni,
  getJadwalByTanggal,
  getListKota,
} from "../services/imsakiyah";

const imsakiyah = new Hono();

// Get City by keyword
imsakiyah.get("/kota", async (c) => {
  const keyword = c.req.query("keyword") ?? "";
  const result = await getListKota(keyword);

  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result, 200);
});

// Get schedule City by ID
imsakiyah.get("/jadwal/:kotaId", async (c) => {
  const kotaId = c.req.param("kotaId");
  const result = await getJadwalHariIni(kotaId);

  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result, 200);
});

// Get Schedule by CityId, year, month, day
imsakiyah.get("/jadwal/:kotaId/:tahun/:bulan/:hari", async (c) => {
  const kotaId = c.req.param("kotaId");
  const tahun = c.req.param("tahun");
  const bulan = c.req.param("bulan");
  const hari = c.req.param("hari");

  const tangaal = `${tahun}-${bulan}-${hari}`;
  const result = await getJadwalByTanggal(kotaId, tangaal);

  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result, 200);
});

export default imsakiyah;
