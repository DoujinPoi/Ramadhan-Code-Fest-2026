require("dotenv").config();

const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_CO_ID_KEY;
const CACHE_TTL_MS = 5 * 60 * 1000;

const API_BASE_URL =
  process.env.API_CO_ID_BASE_URL ||
  "https://use.api.co.id/regional/indonesia/prayer-times";
const API_REGENCIES_URL =
  process.env.API_CO_ID_REGENCIES_URL ||
  process.env.API_CO_ID_CITIES_URL ||
  `${API_BASE_URL}/regencies`;
const responseCache = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Rate limit exceeded. Max 20 requests per 5 minutes."
  }
});

app.use(limiter);

app.get("/api-info", (_req, res) => {
  res.json({
    success: true,
    service: "ramadhan-prayer-times-api",
    upstream: {
      base_url: API_BASE_URL,
      regencies_url: API_REGENCIES_URL
    },
    endpoints: {
      health: "/health",
      cities: "/cities?search=jakarta",
      prayerTimes: "/prayer-times?regency_code=3171&date=2026-03-10",
      prayerTimesByCity: "/prayer-times?city=jakarta selatan&date=2026-03-10"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "ramadhan-prayer-times-api"
  });
});

app.get("/prayer-times", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error: API_CO_ID_KEY is missing."
    });
  }

  let regencyCode = req.query.regency_code
    ? String(req.query.regency_code).trim()
    : "";
  let resolvedRegency = null;
  let cityLookupCached = false;

  if (!regencyCode) {
    const city = req.query.city ? String(req.query.city).trim() : "";
    if (!city) {
      return res.status(400).json({
        success: false,
        message:
          "Query parameter 'regency_code' or 'city' is required. Example: /prayer-times?regency_code=3171&date=2026-03-10"
      });
    }

    try {
      const resolved = await resolveRegencyByCity(API_KEY, city);
      cityLookupCached = resolved.cached;

      if (!resolved.match) {
        if (resolved.candidates.length === 0) {
          return res.status(404).json({
            success: false,
            message: `City '${city}' not found in regencies list.`,
            hint: "Use /cities?search=<keyword> to find valid regency code."
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "Multiple regencies matched that city name. Please use regency_code for precision.",
          candidates: resolved.candidates
        });
      }

      regencyCode = resolved.match.code;
      resolvedRegency = resolved.match;
    } catch (_error) {
      return res.status(502).json({
        success: false,
        message: "Failed to resolve city against regencies list."
      });
    }
  }

  if (!/^\d{4}$/.test(regencyCode)) {
    return res.status(400).json({
      success: false,
      message: "Query parameter 'regency_code' must be 4 digits. Example: 3171"
    });
  }

  const params = new URLSearchParams({ regency_code: regencyCode });
  const date = req.query.date ? String(req.query.date) : "";
  const startDate = req.query.start_date ? String(req.query.start_date) : "";
  const endDate = req.query.end_date ? String(req.query.end_date) : "";
  const page = req.query.page ? String(req.query.page) : "";

  if (date && !startDate && !endDate) {
    params.set("start_date", date);
    params.set("end_date", date);
  }
  if (startDate) {
    params.set("start_date", startDate);
  }
  if (endDate) {
    params.set("end_date", endDate);
  }
  if (page) {
    params.set("page", page);
  }

  const upstreamUrl = `${API_BASE_URL}?${params.toString()}`;
  const cacheKey = `prayer-times:${params.toString()}`;

  try {
    const result = await fetchUpstreamWithCache(upstreamUrl, API_KEY, cacheKey);
    if (!resolvedRegency) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      ...result.body,
      resolved_regency: resolvedRegency,
      city_lookup_cached: cityLookupCached
    });
  } catch (_error) {
    return res.status(502).json({
      success: false,
      message: "Failed to reach upstream provider."
    });
  }
});

app.get("/cities", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error: API_CO_ID_KEY is missing."
    });
  }

  const search = req.query.search ? String(req.query.search).trim() : "";
  if (search) {
    try {
      const regenciesResult = await getAllRegencies(API_KEY);
      const keyword = search.toUpperCase();
      const filtered = regenciesResult.regencies.filter((item) =>
        item.name.toUpperCase().includes(keyword)
      );

      return res.json({
        success: true,
        source: "api.co.id",
        cached: regenciesResult.cached,
        data: {
          is_success: true,
          message: "Success",
          data: filtered,
          paging: {
            page: 1,
            size: filtered.length,
            total_item: filtered.length,
            total_page: 1
          }
        }
      });
    } catch (_error) {
      return res.status(502).json({
        success: false,
        message: "Failed to load regencies list from upstream provider."
      });
    }
  }

  const params = buildQueryParams({ page: req.query.page });
  const query = params.toString();
  const upstreamUrl = query ? `${API_REGENCIES_URL}?${query}` : API_REGENCIES_URL;
  const cacheKey = `regencies:${query || "page=1"}`;

  try {
    const result = await fetchUpstreamWithCache(upstreamUrl, API_KEY, cacheKey);
    return res.status(result.status).json(result.body);
  } catch (_error) {
    return res.status(502).json({
      success: false,
      message: "Failed to reach upstream provider."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function buildQueryParams(queryObject) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryObject)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          params.append(key, String(item));
        }
      }
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}

function fetchFromCache(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    responseCache.delete(cacheKey);
    return null;
  }

  return {
    status: cached.status,
    body: {
      ...cached.body,
      cached: true
    }
  };
}

function saveToCache(cacheKey, result) {
  responseCache.set(cacheKey, {
    status: result.status,
    body: {
      ...result.body,
      cached: false
    },
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

async function fetchUpstreamWithCache(upstreamUrl, apiKey, cacheKey) {
  const cached = fetchFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-api-co-id": apiKey
    }
  });

  const text = await upstreamResponse.text();
  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep raw text for non-JSON upstream responses.
  }

  const result = {
    status: upstreamResponse.status,
    body: {
      success: upstreamResponse.ok,
      source: "api.co.id",
      cached: false,
      data: payload
    }
  };

  if (upstreamResponse.ok) {
    saveToCache(cacheKey, result);
  }

  return result;
}

async function getAllRegencies(apiKey) {
  const cacheKey = "regencies:all";
  const cached = fetchFromCache(cacheKey);
  if (
    cached &&
    cached.status === 200 &&
    Array.isArray(cached.body?.data?.data)
  ) {
    return {
      regencies: cached.body.data.data,
      cached: true
    };
  }

  const firstPageUrl = `${API_REGENCIES_URL}?page=1`;
  const firstPage = await fetchUpstreamWithCache(
    firstPageUrl,
    apiKey,
    "regencies:page=1"
  );
  if (firstPage.status !== 200 || !Array.isArray(firstPage.body?.data?.data)) {
    throw new Error("Failed to get first regencies page");
  }

  const allRegencies = [...firstPage.body.data.data];
  const totalPages = Number(firstPage.body?.data?.paging?.total_page || 1);

  for (let page = 2; page <= totalPages; page += 1) {
    const pageUrl = `${API_REGENCIES_URL}?page=${page}`;
    const pageResult = await fetchUpstreamWithCache(
      pageUrl,
      apiKey,
      `regencies:page=${page}`
    );
    if (pageResult.status !== 200 || !Array.isArray(pageResult.body?.data?.data)) {
      throw new Error(`Failed to get regencies page ${page}`);
    }
    allRegencies.push(...pageResult.body.data.data);
  }

  allRegencies.sort((a, b) => a.name.localeCompare(b.name));

  const aggregated = {
    status: 200,
    body: {
      success: true,
      source: "api.co.id",
      cached: false,
      data: {
        is_success: true,
        message: "Success",
        data: allRegencies,
        paging: {
          page: 1,
          size: allRegencies.length,
          total_item: allRegencies.length,
          total_page: 1
        }
      }
    }
  };

  saveToCache(cacheKey, aggregated);

  return {
    regencies: allRegencies,
    cached: false
  };
}

async function resolveRegencyByCity(apiKey, city) {
  const regenciesResult = await getAllRegencies(apiKey);
  const cityKey = normalizeRegencyName(city);

  const exactMatch = regenciesResult.regencies.find(
    (item) => normalizeRegencyName(item.name) === cityKey
  );
  if (exactMatch) {
    return {
      match: exactMatch,
      candidates: [exactMatch],
      cached: regenciesResult.cached
    };
  }

  const partialMatches = regenciesResult.regencies.filter((item) =>
    normalizeRegencyName(item.name).includes(cityKey)
  );

  if (partialMatches.length === 1) {
    return {
      match: partialMatches[0],
      candidates: partialMatches,
      cached: regenciesResult.cached
    };
  }

  return {
    match: null,
    candidates: partialMatches.slice(0, 10),
    cached: regenciesResult.cached
  };
}

function normalizeRegencyName(value) {
  return String(value)
    .toUpperCase()
    .replace(/^KABUPATEN\s+/, "")
    .replace(/^KOTA\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
