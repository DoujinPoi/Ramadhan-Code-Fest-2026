const citySearchInput = document.getElementById("citySearch");
const searchBtn = document.getElementById("searchBtn");
const regencySelect = document.getElementById("regencySelect");
const dateInput = document.getElementById("dateInput");
const loadBtn = document.getElementById("loadBtn");
const statusText = document.getElementById("statusText");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const cacheBadge = document.getElementById("cacheBadge");
const timeGrid = document.getElementById("timeGrid");

const prayerLabels = {
  imsyak: "Imsyak",
  shubuh: "Shubuh",
  terbit: "Terbit",
  dhuha: "Dhuha",
  dzuhur: "Dzuhur",
  ashr: "Ashar",
  maghrib: "Maghrib",
  isya: "Isya"
};

boot();

function boot() {
  const today = new Date();
  dateInput.value = toIsoDate(today);
  citySearchInput.value = "jakarta";

  searchBtn.addEventListener("click", () => {
    searchCities(citySearchInput.value.trim());
  });

  citySearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchCities(citySearchInput.value.trim());
    }
  });

  loadBtn.addEventListener("click", loadPrayerTimes);

  searchCities(citySearchInput.value.trim());
}

async function searchCities(keyword) {
  const search = keyword || "jakarta";
  setStatus(`Searching regencies for "${search}"...`, "idle");

  try {
    const response = await fetch(`/cities?search=${encodeURIComponent(search)}`);
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(readMessage(payload));
    }

    const items = payload?.data?.data || [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No city/regency found for "${search}".`);
    }

    renderRegencyOptions(items);
    setStatus(`Found ${items.length} matching regencies.`, "ok");
  } catch (error) {
    setStatus(error.message, "error");
    clearRegencyOptions();
  }
}

function renderRegencyOptions(items) {
  regencySelect.innerHTML = "";
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = `${item.name} (${item.code})`;
    regencySelect.append(option);
  }
}

function clearRegencyOptions() {
  regencySelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = "No regency available";
  regencySelect.append(option);
}

async function loadPrayerTimes() {
  const regencyCode = regencySelect.value;
  const date = dateInput.value || toIsoDate(new Date());

  if (!regencyCode) {
    setStatus("Please search and select regency first.", "error");
    return;
  }

  const params = new URLSearchParams({
    regency_code: regencyCode,
    date
  });

  setStatus("Loading prayer times...", "idle");
  try {
    const response = await fetch(`/prayer-times?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(readMessage(payload));
    }

    const firstSchedule = payload?.data?.data?.[0];
    if (!firstSchedule) {
      throw new Error("No schedule data returned.");
    }

    showSchedule(firstSchedule, Boolean(payload.cached));
    setStatus("Prayer times loaded.", "ok");
  } catch (error) {
    setStatus(error.message, "error");
    resultPanel.hidden = true;
  }
}

function showSchedule(schedule, cached) {
  const regencyName = schedule.regency_name || "Unknown Regency";
  const dateText = schedule.date || dateInput.value;
  resultTitle.textContent = `${regencyName} - ${dateText}`;
  cacheBadge.textContent = cached ? "cached" : "live";
  cacheBadge.classList.toggle("cached", cached);

  const order = [
    "imsyak",
    "shubuh",
    "terbit",
    "dhuha",
    "dzuhur",
    "ashr",
    "maghrib",
    "isya"
  ];

  timeGrid.innerHTML = "";
  for (const key of order) {
    const value = schedule[key] || "--:--";
    const card = document.createElement("article");
    card.className = "time-card";
    card.innerHTML = `
      <span class="time-label">${prayerLabels[key] || key}</span>
      <span class="time-value">${value}</span>
    `;
    timeGrid.append(card);
  }

  resultPanel.hidden = false;
}

function setStatus(message, type) {
  statusText.textContent = message;
  statusText.className = `status status-${type}`;
}

function toIsoDate(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
}

function readMessage(payload) {
  if (payload?.message) {
    return payload.message;
  }
  if (payload?.data?.message) {
    return payload.data.message;
  }
  return "Unexpected response from server.";
}
