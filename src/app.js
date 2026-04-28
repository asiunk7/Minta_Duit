import { analyze, calculate, formatPrice } from "./coptah.js";

const fields = {
  openBefore: document.querySelector("#openBefore"),
  highBefore: document.querySelector("#highBefore"),
  lowBefore: document.querySelector("#lowBefore"),
  openNow: document.querySelector("#openNow"),
  highNow: document.querySelector("#highNow"),
  lowNow: document.querySelector("#lowNow"),
  currentPrice: document.querySelector("#currentPrice"),
};

const outputs = {
  r4: document.querySelector("#r4"),
  r3: document.querySelector("#r3"),
  r2: document.querySelector("#r2"),
  r1: document.querySelector("#r1"),
  pivot: document.querySelector("#pivot"),
  s1: document.querySelector("#s1"),
  s2: document.querySelector("#s2"),
  s3: document.querySelector("#s3"),
  s4: document.querySelector("#s4"),
};

const insightOutputs = {
  jikaOp: document.querySelector("#jikaOp"),
  trend: document.querySelector("#trend"),
  tugas: document.querySelector("#tugas"),
  move: document.querySelector("#move"),
};

const timeframeSelect = document.querySelector("#timeframeSelect");
const storageKey = "coptah-rps-state";
let activeFrame = "h1";
let installPrompt = null;
let autoMode = false;
let autoTimer = null;
let bridgeData = null;
let frameInputs = {};

const frameLabels = {
  h1: "H1",
  h4: "H4",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarter",
  semester: "Semester",
  year: "Year",
};

const nextFrameLabels = {
  h1: "H4",
  h4: "DAY",
  day: "WEEK",
  week: "MONTH",
  month: "QRTR",
  quarter: "SEMESTER",
  semester: "YEAR",
  year: "YEAR",
};

const defaultFrameInputs = {
  h1: { openBefore: "2772.342", highBefore: "2775.084", lowBefore: "2770.058", openNow: "2772.095", highNow: "2774.311", lowNow: "2772.058" },
  h4: { openBefore: "2754.608", highBefore: "2777.507", lowBefore: "2754.39", openNow: "2772.342", highNow: "2775.084", lowNow: "2770.588" },
  day: { openBefore: "2755.625", highBefore: "2759.023", lowBefore: "2735.894", openNow: "2754.608", highNow: "2777.507", lowNow: "2754.39" },
  week: { openBefore: "2691.19", highBefore: "2724.797", lowBefore: "2656.829", openNow: "2696.485", highNow: "2777.507", lowNow: "2689.417" },
  month: { openBefore: "2649.115", highBefore: "2726.267", lowBefore: "2583.475", openNow: "2625.24", highNow: "2777.507", lowNow: "2614.484" },
  quarter: { openBefore: "2635.722", highBefore: "2790.137", lowBefore: "2536.817", openNow: "2625.24", highNow: "2777.507", lowNow: "2614.484" },
  semester: { openBefore: "2325.02", highBefore: "2790.137", lowBefore: "2318.511", openNow: "2625.24", highNow: "2777.507", lowNow: "2614.484" },
  year: { openBefore: "2065.007", highBefore: "2790.137", lowBefore: "1984.19", openNow: "2625.24", highNow: "2777.137", lowNow: "2614.484" },
};

const statusLine = document.querySelector("#statusLine");

function cleanNumber(value) {
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function currentState() {
  storeVisibleInputs();
  return {
    frame: activeFrame,
    autoMode,
    frames: frameInputs,
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(currentState()));
}

function setEmpty(message = "") {
  Object.values(outputs).forEach((output) => {
    output.value = message;
    output.classList.remove("hit");
    output.classList.remove("hit-resistance");
    output.classList.remove("hit-pivot");
    output.classList.remove("hit-support");
  });
}

function levelWasHit(levelKey, level, values) {
  if (levelKey.startsWith("r")) return values.highNow >= level;
  if (levelKey.startsWith("s")) return values.lowNow <= level;
  return values.lowNow <= level && values.highNow >= level;
}

function storeVisibleInputs() {
  frameInputs[activeFrame] = {
    openBefore: fields.openBefore.textContent,
    highBefore: fields.highBefore.textContent,
    lowBefore: fields.lowBefore.textContent,
    openNow: fields.openNow.textContent,
    highNow: fields.highNow.textContent,
    lowNow: fields.lowNow.textContent,
    currentPrice: fields.currentPrice.textContent,
  };
}

function loadFrameInputs(frame) {
  const values = frameInputs[frame] ?? defaultFrameInputs[frame] ?? defaultFrameInputs.h1;
  fields.openBefore.textContent = values.openBefore;
  fields.highBefore.textContent = values.highBefore;
  fields.lowBefore.textContent = values.lowBefore;
  fields.openNow.textContent = values.openNow;
  fields.highNow.textContent = values.highNow ?? values.openNow;
  fields.lowNow.textContent = values.lowNow ?? values.openNow;
  fields.currentPrice.textContent = values.currentPrice ?? values.bid ?? values.openNow;
}

function applyBridgeFrame(frame) {
  const data = bridgeData?.frames?.[frame];
  if (!data) return false;
  frameInputs[frame] = {
    openBefore: String(data.openBefore),
    highBefore: String(data.highBefore),
    lowBefore: String(data.lowBefore),
    openNow: String(data.openNow),
    highNow: String(data.highNow ?? data.openNow),
    lowNow: String(data.lowNow ?? data.openNow),
    currentPrice: String(bridgeData.bid ?? data.currentPrice ?? data.openNow),
  };
  loadFrameInputs(frame);
  return true;
}

function formatGmt7(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return `${value} GMT+7`;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  date.setUTCHours(date.getUTCHours() + 7);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT+7`;
}

function updateResults() {
  if (autoMode) applyBridgeFrame(activeFrame);
  storeVisibleInputs();

  const values = {
    openBefore: cleanNumber(fields.openBefore.textContent),
    highBefore: cleanNumber(fields.highBefore.textContent),
    lowBefore: cleanNumber(fields.lowBefore.textContent),
    openNow: cleanNumber(fields.openNow.textContent),
    highNow: cleanNumber(fields.highNow.textContent),
    lowNow: cleanNumber(fields.lowNow.textContent),
    currentPrice: cleanNumber(fields.currentPrice.textContent),
    symbol: "xau",
    frame: activeFrame,
  };

  const missing = ["openBefore", "highBefore", "lowBefore", "openNow", "highNow", "lowNow", "currentPrice"].some(
    (key) => values[key] === null,
  );
  if (missing) {
    setEmpty("");
    Object.values(insightOutputs).forEach((output) => {
      output.textContent = "";
    });
    saveState();
    return;
  }

  const result = calculate(values);
  Object.entries(outputs).forEach(([key, output]) => {
    const wasHit = levelWasHit(key, result[key], values);
    output.value = formatPrice(result[key], values.symbol);
    output.classList.toggle("hit-resistance", wasHit && key.startsWith("r"));
    output.classList.toggle("hit-support", wasHit && key.startsWith("s"));
    output.classList.toggle("hit-pivot", wasHit && key === "pivot");
  });
  const insights = analyze({ ...values, levels: result, nextFrameLabel: nextFrameLabels[activeFrame] });
  insightOutputs.jikaOp.textContent = insights.jikaOp;
  insightOutputs.trend.textContent = insights.trend || "-";
  insightOutputs.tugas.textContent = insights.tugas;
  insightOutputs.move.textContent = insights.move;
  saveState();
}

async function refreshFromBridge() {
  if (!autoMode) return;
  try {
    const response = await fetch("./api/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bridgeData = await response.json();
    const session = bridgeData.session ? ` ${bridgeData.session}` : "";
    statusLine.textContent = `Auto XAUUSD${session} - ${frameLabels[activeFrame]} - Bid ${bridgeData.bid ?? "-"} / Ask ${bridgeData.ask ?? "-"} - ${formatGmt7(bridgeData.serverTime)}`;
    updateResults();
  } catch {
    statusLine.textContent = "Auto belum connect ke MT4 bridge";
  }
}

function setAutoMode(next) {
  autoMode = next;
  document.querySelector("#autoButton").setAttribute("aria-pressed", String(autoMode));
  document.querySelector("#autoButton").classList.toggle("active", autoMode);
  statusLine.textContent = autoMode ? "Auto connect ke MT4 bridge..." : "Manual mode";
  clearInterval(autoTimer);
  autoTimer = autoMode ? setInterval(refreshFromBridge, 3000) : null;
  if (autoMode) refreshFromBridge();
  saveState();
}

function restoreState() {
  frameInputs = structuredClone(defaultFrameInputs);
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    loadFrameInputs(activeFrame);
    return;
  }

  try {
    const state = JSON.parse(raw);
    frameInputs = { ...frameInputs, ...(state.frames ?? {}) };
    if (!state.frames && state.openBefore) {
      frameInputs.h1 = {
        openBefore: state.openBefore,
        highBefore: state.highBefore,
        lowBefore: state.lowBefore,
        openNow: state.openNow,
      };
    }
    activeFrame = state.frame ?? activeFrame;
    if (!frameInputs[activeFrame]) activeFrame = "h1";
    autoMode = Boolean(state.autoMode);
    loadFrameInputs(activeFrame);
  } catch {
    localStorage.removeItem(storageKey);
    loadFrameInputs(activeFrame);
  }
}

function syncTabs() {
  timeframeSelect.value = activeFrame;
}

document.querySelector("#updateButton").addEventListener("click", updateResults);
document.querySelector("#autoButton").addEventListener("click", () => setAutoMode(!autoMode));

timeframeSelect.addEventListener("change", () => {
  storeVisibleInputs();
  activeFrame = timeframeSelect.value;
  loadFrameInputs(activeFrame);
  syncTabs();
  autoMode ? refreshFromBridge() : updateResults();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#installButton").classList.add("ready");
});

document.querySelector("#installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

restoreState();
syncTabs();
setAutoMode(autoMode);
updateResults();
