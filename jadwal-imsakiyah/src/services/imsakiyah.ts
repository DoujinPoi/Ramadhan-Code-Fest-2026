import type { JadwalHariIni, ApiResponse } from "../types/imsakiyah";

const BASE_URL = "https://api.myquran.com/v3/sholat";

// Fetch list of cities available in the API
export async function getListKota(
  keyword: string = "",
): Promise<ApiResponse<any>> {
  try {
    const url = keyword
      ? `${BASE_URL}/kabkota/cari/${keyword}`
      : `${BASE_URL}/kabkota/semua`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.status) {
      return {
        success: false,
        message: "Gagal mengambil list kota",
        data: null,
      };
    }

    return {
      success: true,
      message: "Berhasil mengambil list kota",
      data: json.data,
    };
  } catch (error) {
    return { success: false, message: "Terjadi Kesalahan Server", data: null };
  }
}

// Fetches the prayer schedule today for a given city
export async function getJadwalHariIni(
  kotaId: string,
): Promise<ApiResponse<JadwalHariIni>> {
  try {
    const res = await fetch(
      `${BASE_URL}/jadwal/${kotaId}/today?tz=Asia%2FJakarta`,
    );
    const json = await res.json();

    if (!json.status) {
      return { success: false, message: "Kota tidak ditemukan", data: null };
    }

    const tanggalKey = Object.keys(json.data.jadwal)[0];
    const jadwal = json.data.jadwal[tanggalKey];

    return {
      success: true,
      message: "Berhasil mengambil jadwal hari ini",
      data: {
        tanggal: jadwal.tanggal,
        kota: json.data.kabko,
        jadwal: {
          imsak: jadwal.imsak,
          subuh: jadwal.subuh,
          terbit: jadwal.terbit,
          dhuha: jadwal.dhuha,
          dzuhur: jadwal.dzuhur,
          ashar: jadwal.ashar,
          maghrib: jadwal.maghrib,
          isya: jadwal.isya,
        },
      },
    };
  } catch (error) {
    return { success: false, message: "Terjadi Kesalahan Server", data: null };
  }
}

// Fetch schedule by specified date
export async function getJadwalByTanggal(
  kotaId: string,
  tanggal: string, // format: YYYY-MM-DD
): Promise<ApiResponse<JadwalHariIni>> {
  try {
    const res = await fetch(`${BASE_URL}/jadwal/${kotaId}/${tanggal}`);
    const json = await res.json();

    if (!json.status) {
      return { success: false, message: "Data tidak ditemukan", data: null };
    }

    const tanggalKey = Object.keys(json.data.jadwal)[0];
    const jadwalData = json.data.jadwal[tanggalKey];

    return {
      success: true,
      message: "Berhasil mengambil jadwal",
      data: {
        tanggal: jadwalData.tanggal,
        kota: json.data.kabko,
        jadwal: {
          imsak: jadwalData.imsak,
          subuh: jadwalData.subuh,
          terbit: jadwalData.terbit,
          dhuha: jadwalData.dhuha,
          dzuhur: jadwalData.dzuhur,
          ashar: jadwalData.ashar,
          maghrib: jadwalData.maghrib,
          isya: jadwalData.isya,
        },
      },
    };
  } catch (error) {
    return { success: false, message: "Terjadi Kesalahan Server", data: null };
  }
}
