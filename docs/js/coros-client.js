/**
 * COROS Training Hub API client (browser).
 * Ported from coros-mcp — same endpoints as MCP tools.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const BASE_URLS = {
  eu: "https://teameuapi.coros.com",
  us: "https://teamapi.coros.com",
  asia: "https://teamcnapi.coros.com",
  cn: "https://teamcnapi.coros.com",
};

const REGION_TRY_ORDER = ["asia", "eu", "us", "cn"];

const ENDPOINTS = {
  login: "/account/login",
  dashboard: "/dashboard/query",
  analyse: "/analyse/query",
  analyse_detail: "/analyse/dayDetail/query",
  activity_list: "/activity/query",
};

const SPORT_NAMES = {
  100: "Running",
  102: "Trail Running",
  103: "Track Running",
  104: "Hiking",
  105: "登山",
  200: "Road Bike",
  201: "Indoor Cycling",
  203: "Gravel Bike",
  204: "MTB",
  300: "泳池游泳",
  400: "Cardio",
  402: "Strength",
  403: "Yoga",
  900: "Walking",
  902: "爬楼梯",
  9807: "Bike Commute",
};

import { md5 as md5hash } from "./md5.js";

export function md5(text) {
  return md5hash(text);
}

function yyyymmdd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatYmd(s) {
  if (!s || s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function formatDuration(sec) {
  if (!sec) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

function formatDistance(m) {
  if (m == null || m <= 0) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function checkResult(body, ctx) {
  if (body.result !== "0000") {
    throw new Error(body.message || `COROS ${ctx} 失败 (${body.result})`);
  }
}

function authHeaders(auth) {
  return {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    accessToken: auth.accessToken,
    yfheader: JSON.stringify({ userId: auth.userId }),
  };
}

async function apiPost(base, path, json, headers = {}) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, ...headers },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiGet(base, path, params, headers) {
  const q = new URLSearchParams(params);
  const res = await fetch(`${base}${path}?${q}`, {
    headers: { "User-Agent": USER_AGENT, ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function loginRegion(email, password, region) {
  const base = BASE_URLS[region];
  const body = await apiPost(base, ENDPOINTS.login, {
    account: email,
    accountType: 2,
    pwd: md5(password),
  });
  checkResult(body, "登录");
  const data = body.data || {};
  if (!data.accessToken) throw new Error("登录成功但未返回 accessToken");
  return {
    accessToken: data.accessToken,
    userId: String(data.userId),
    region,
    baseUrl: base,
  };
}

export async function login(email, password, regionPref = "auto") {
  const regions =
    regionPref === "auto" ? REGION_TRY_ORDER : [regionPref, ...REGION_TRY_ORDER.filter((r) => r !== regionPref)];

  let lastErr = null;
  for (const region of regions) {
    try {
      return await loginRegion(email, password, region);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("无法登录，请检查邮箱、密码与区域");
}

function activityDate(item) {
  const day = item.startDay || item.happenDay;
  if (day) return formatYmd(String(day));
  const t = item.startTime;
  if (t) {
    const ms = Number(t) < 1e12 ? Number(t) * 1000 : Number(t);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseActivity(item) {
  const sportType = item.sportType;
  return {
    id: String(item.labelId ?? ""),
    date: activityDate(item),
    name: item.name || item.remark,
    sport: SPORT_NAMES[sportType] || `Sport ${sportType}`,
    sport_type: sportType,
    duration: formatDuration(item.totalTime),
    duration_seconds: item.totalTime,
    distance: formatDistance(item.distance ?? item.totalDistance),
    distance_meters: item.distance ?? item.totalDistance,
    avg_hr: item.avgHr,
    max_hr: item.maxHr,
    training_load: item.trainingLoad,
    elevation_gain_m: item.ascent ?? item.totalAscent ?? item.elevationGain,
    avg_power: item.avgPower,
    start_time: item.startTime,
  };
}

function parseDaily(item) {
  return {
    date: formatYmd(String(item.happenDay ?? "")),
    sleep_hrv: item.avgSleepHrv,
    hrv_baseline: item.sleepHrvBase,
    resting_hr: item.rhr,
    training_load: item.trainingLoad,
    load_ratio: item.trainingLoadRatio,
    fatigue_pct: item.tiredRateNew,
    ati: item.ati,
    cti: item.cti,
  };
}

export async function fetchActivities(auth, startDay, endDay, size = 100) {
  const all = [];
  let page = 1;
  let total = 0;
  do {
    const body = await apiGet(
      auth.baseUrl,
      ENDPOINTS.activity_list,
      { startDay, endDay, pageNumber: page, size },
      authHeaders(auth),
    );
    checkResult(body, "活动列表");
    const data = body.data || {};
    const items = data.dataList || data.list || [];
    total = data.totalCount || data.count || items.length;
    all.push(...items.map(parseActivity));
    if (all.length >= total || items.length === 0) break;
    page += 1;
  } while (page <= 10);
  return all.sort((a, b) => {
    const ta = Number(a.start_time) || 0;
    const tb = Number(b.start_time) || 0;
    return tb - ta;
  });
}

export async function fetchDailyRecords(auth, startDay, endDay) {
  const [detailBody, analyseBody] = await Promise.all([
    apiGet(auth.baseUrl, ENDPOINTS.analyse_detail, { startDay, endDay }, authHeaders(auth)),
    apiGet(auth.baseUrl, ENDPOINTS.analyse, {}, authHeaders(auth)),
  ]);
  checkResult(detailBody, "每日指标");
  const byDate = {};
  for (const item of detailBody.data?.dayList || []) {
    const rec = parseDaily(item);
    if (rec.date) byDate[rec.date.replace(/-/g, "")] = rec;
  }
  if (analyseBody.result === "0000") {
    for (const item of analyseBody.data?.t7dayList || []) {
      const key = String(item.happenDay ?? "");
      if (byDate[key]) {
        byDate[key].vo2max = item.vo2max;
        byDate[key].stamina_level = item.staminaLevel;
      }
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchDashboardHrv(auth) {
  try {
    const body = await apiGet(auth.baseUrl, ENDPOINTS.dashboard, {}, authHeaders(auth));
    checkResult(body, "仪表盘");
    const hrv = body.data?.summaryInfo?.sleepHrvData || {};
    const list = (hrv.sleepHrvList || []).map((item) => ({
      date: formatYmd(String(item.happenDay ?? "")),
      sleep_hrv: item.avgSleepHrv,
      baseline: item.sleepHrvBase,
    }));
    return list;
  } catch {
    return [];
  }
}

/**
 * Fetch all data used for analysis (same shape as Python coros_loader).
 */
export async function fetchCorosDataset(auth, weeks = 8) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - weeks * 7);
  const startDay = yyyymmdd(start);
  const endDay = yyyymmdd(end);

  const [activities, daily_metrics, dashboard_hrv] = await Promise.all([
    fetchActivities(auth, startDay, endDay),
    fetchDailyRecords(auth, startDay, endDay),
    fetchDashboardHrv(auth),
  ]);

  const dates = [
    ...activities.map((a) => a.date).filter(Boolean),
    ...daily_metrics.map((d) => d.date).filter(Boolean),
  ];
  const date_range = dates.length ? `${dates.sort()[0]} – ${dates.sort().at(-1)}` : "无数据";

  return {
    date_range,
    weeks,
    region: auth.region,
    activity_count: activities.length,
    activities,
    daily_metrics,
    dashboard_hrv,
    sleep: [],
  };
}
