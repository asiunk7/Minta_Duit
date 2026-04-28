const frameOffsetMultiplier = {
  h1: 1,
  h4: 8,
  day: 1,
  week: 1,
  month: 1,
  quarter: 1,
  semester: 1,
  year: 1,
};

const ladderFrames = new Set(["h1", "h4"]);

export function symbolConfig(symbol) {
  if (symbol === "forex") return { offset: 0.0001, decimals: 6 };
  if (symbol === "jpy") return { offset: 0.01, decimals: 3 };
  return { offset: 0.01, decimals: 4 };
}

export function calculate({ openBefore, highBefore, lowBefore, openNow, symbol, frame }) {
  const config = symbolConfig(symbol);
  const offset = config.offset * (frameOffsetMultiplier[frame] ?? 1);
  const pivot = (openBefore + highBefore + lowBefore + openNow + (openNow - offset)) / 5;

  const r1 = 2 * pivot - lowBefore;
  const s1 = 2 * pivot - highBefore;
  const s2 = pivot - (r1 - s1);
  const r2 = pivot - s1 + r1;
  let r3;
  let r4;
  let s3;
  let s4;

  if (ladderFrames.has(frame)) {
    s3 = pivot - (r2 - s2);
    r3 = pivot - s2 + r2;
    s4 = pivot - (r3 - s3);
    r4 = pivot - s3 + r3;
  } else {
    r3 = 2 * pivot + (highBefore - 2 * lowBefore);
    r4 = 3 * pivot + (highBefore - 3 * lowBefore);
    s3 = 2 * pivot - (2 * highBefore - lowBefore);
    s4 = 3 * pivot - (3 * highBefore - lowBefore);
  }

  return { r4, r3, r2, r1, pivot, s1, s2, s3, s4 };
}

export function analyze({ openBefore, highBefore, lowBefore, openNow, highNow, lowNow, currentPrice, levels, nextFrameLabel }) {
  const jikaOp = openNow >= openBefore ? "UP" : "DOWN";
  let trend = "";

  if (openNow > openBefore && highNow > highBefore && lowNow > lowBefore) trend = "NRL UP";
  else if (openNow < openBefore && highNow < highBefore && lowNow < lowBefore) trend = "NRL DN";
  else if (openNow > openBefore && highNow < highBefore && lowNow < lowBefore) trend = "ANL DN";
  else if (openNow < openBefore && highNow > highBefore && lowNow > lowBefore) trend = "ANL UP";
  else if (openNow > openBefore && highNow < highBefore && lowNow > lowBefore) trend = "SDW UP";
  else if (openNow < openBefore && highNow < highBefore && lowNow > lowBefore) trend = "SDW DN";
  else if (openNow > openBefore && highNow > highBefore && lowNow < lowBefore) trend = "BRK UP";
  else if (openNow < openBefore && highNow > highBefore && lowNow < lowBefore) trend = "BRK DN";

  let tugas = "OPEN N";
  if (currentPrice < lowBefore && currentPrice < levels.s1) tugas = `CEK ${nextFrameLabel}`;
  else if (currentPrice > highBefore && currentPrice > levels.r1) tugas = `CEK ${nextFrameLabel}`;
  else if (jikaOp === "UP" && currentPrice < openNow) tugas = "BUSUR BAWAH";
  else if (jikaOp === "UP" && currentPrice > openNow) tugas = "TARGET ATAS";
  else if (jikaOp === "DOWN" && currentPrice > openNow) tugas = "BUSUR ATAS";
  else if (jikaOp === "DOWN" && currentPrice < openNow) tugas = "TARGET BAWAH";

  let move = "HOME";
  if (currentPrice > openNow) move = "UP";
  if (currentPrice < openNow) move = "DOWN";

  return { jikaOp, trend, tugas, move };
}

export function formatPrice(value, symbol) {
  const { decimals } = symbolConfig(symbol);
  return Number(value.toFixed(decimals)).toString();
}
