// Response API for Imsakiyah data
export interface JadwalSholatRaw {
  imsak: string;
  subuh: string;
  terbit: string;
  dhuha: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
}

export interface JadwalHariIni {
  tanggal: string;
  kota: string;
  jadwal: JadwalSholatRaw;
}

// API response for Imsakiyah data
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}
