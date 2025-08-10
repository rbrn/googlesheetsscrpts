/***********************
 * ALB Daily Report — Auto Spot + Futures (chronological)
 *
 * Business logic:
 *   - Track daily lithium carbonate spot prices and the actively traded LC2508
 *     futures contract.  Comparing the two gives a real‑time view of how future
 *     expectations diverge from the current physical market.
 *   - Every run appends a new row to a raw data sheet and refreshes a summary
 *     sheet with the latest spread versus Albemarle's guidance price.
 *   - A small chart of the last 10 days helps visualize the relationship over
 *     time for quick monitoring.
 *
 * Spot source (primary): TradingEconomics lithium API (guest key)
 * Fallback spot: SMM USD/mt page
 * Futures source: SMM LC2508 page (CNY/t)
 ***********************/
const CFG = {
  SHEET_RAW: "raw_data",
  SHEET_SUMMARY: "summary",
  FX_CNY_PER_USD: 7.20, // adjust if desired
  GUIDANCE_USD_MT: 9500,
  // Data sources
  URL_SPOT_SMM_USD: "https://www.metal.com/Lithium/201102250059", // fallback
  URL_FUT_LC2508: "https://www.metal.com/Lithium/lc2508",
};

function updateALBDailyReport(){ return ALB_UpdateNow(); }

  // Manual test run
function ALB_UpdateNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const raw = ss.getSheetByName(CFG.SHEET_RAW) || ss.insertSheet(CFG.SHEET_RAW);
  const sum = ss.getSheetByName(CFG.SHEET_SUMMARY) || ss.insertSheet(CFG.SHEET_SUMMARY);

  // Ensure headers & order (oldest at top, we always append to bottom)
  ensureHeaders_(raw);

  // Fetch spot (USD/mt)
  let spotUsdMt = fetchSpotUSDmt_SMM_Strict();

  // Fetch futures LC2508 (CNY/t)
  const futCnyPerT = fetchFuturesLC2508_CNYt_OrNull();

  // Convert futures to USD/mt so it is comparable with the spot quote
  const fx = CFG.FX_CNY_PER_USD;
  const futUsdMt = isFiniteNumber_(futCnyPerT) ? (futCnyPerT / fx) : null;

  // Spreads highlight how much the futures market expects prices to move
  const spreadUsdMt = (isFiniteNumber_(spotUsdMt) && isFiniteNumber_(futUsdMt)) ? (futUsdMt - spotUsdMt) : null;
  const spreadPct = (isFiniteNumber_(spreadUsdMt) && isFiniteNumber_(spotUsdMt)) ? ((spreadUsdMt / spotUsdMt) * 100) : null;

  // Append new row at bottom (newest → bottom)
  const now = new Date();
  raw.appendRow([
    now,
    isFiniteNumber_(spotUsdMt) ? round2_(spotUsdMt) : "",
    isFiniteNumber_(futCnyPerT) ? round0_(futCnyPerT) : "",
    fx,
    isFiniteNumber_(futUsdMt) ? round2_(futUsdMt) : "",
    isFiniteNumber_(spreadUsdMt) ? round2_(spreadUsdMt) : "",
    isFiniteNumber_(spreadPct) ? round2_(spreadPct) : "",
    CFG.GUIDANCE_USD_MT,
    (isFiniteNumber_(spotUsdMt) ? "SMM" : "")
  ]);

  // Refresh summary + 10-day chart to provide a quick snapshot for the user
  buildSummary_(sum, raw);

  Logger.log("ALB update complete @ " + now);
  return true;
}


// --- Spot fetch from SMM by scraping the specific div class ---
// If TradingEconomics is unavailable this scraper pulls the headline USD/mt
// price directly from the SMM page and falls back through several patterns to
// handle minor site changes.
// Page: https://www.metal.com/Lithium/201102250059
function fetchSpotUSDmt_SMM_Strict() {
  try {
    var html = UrlFetchApp.fetch("https://www.metal.com/Lithium/201102250059", {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Optional: some sites behave better with a simple referer
        "Referer": "https://www.metal.com/"
      }
    }).getContentText();

    // 1) Exact selector you requested
    var mStrict = html.match(/<div\s+class="price___2mpJr">\s*([\d,]+(?:\.\d+)?)\s*<\/div>/i);
    if (mStrict && mStrict[1]) {
      var val = parseFloat(mStrict[1].replace(/,/g, ""));
      if (isFinite(val)) return val; // USD/mt
    }

    // 2) Fallback: any number followed by USD/mt or USD/t (in case class changes)
    var mFallback = html.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:USD\/mt|USD\/t)\b/i);
    if (mFallback && mFallback[1]) {
      var val2 = parseFloat(mFallback[1].replace(/,/g, ""));
      if (isFinite(val2)) return val2;
    }

    // 3) Another fallback: look for "USD" near a big number
    var mLoose = html.match(/USD[^<>{}]{0,40}?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
    if (mLoose && mLoose[1]) {
      var val3 = parseFloat(mLoose[1].replace(/,/g, ""));
      if (isFinite(val3)) return val3;
    }

    return null;
  } catch (e) {
    Logger.log("SMM spot strict fetch failed: " + e);
    return null;
  }
}


function fetchSpotUSDmt_SMM_OrNull(){
  try {
    const html = UrlFetchApp.fetch(CFG.URL_SPOT_SMM_USD, {
      method:"get", muteHttpExceptions:true, followRedirects:true,
      headers:{
        "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":"en-US,en;q=0.9"
      }
    }).getContentText();
    // Look for patterns like: 8,836.04 USD/mt or $8,836.04/t
    const m = html.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*USD\/(?:mt|t)/i);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(/,/g,""));
      return isFinite(val) ? val : null;
    }
    return null;
  } catch(e){
    Logger.log("SMM fallback spot failed: " + e);
    return null;
  }
}

function fetchFuturesLC2508_CNYt_OrNull(){
  try {
    const html = UrlFetchApp.fetch(CFG.URL_FUT_LC2508, {
      method:"get", muteHttpExceptions:true, followRedirects:true,
      headers:{
        "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":"en-US,en;q=0.9"
      }
    }).getContentText();
    // pick first plausible large number as "last price" (70k–85k range)
    const nums = html.match(/(\d{2,3},\d{3}|\d{5,6})(?=\s*(?:CNY|元|\/?t|\/?吨)?)/g);
    if (nums && nums.length) {
      for (var i=0;i<nums.length;i++){
        const v = parseInt(nums[i].replace(/,/g,""),10);
        if (v >= 60000 && v <= 90000) return v;
      }
    }
    return null;
  } catch(e){
    Logger.log("LC2508 futures fetch failed: " + e);
    return null;
  }
}

/*** Summary & chart ***/
function ensureHeaders_(raw){
  if (raw.getLastRow() === 0) {
    raw.appendRow([
      "Timestamp",            // A
      "Spot_USD_per_mt",      // B
      "Futures_CNY_per_t",    // C
      "FX_CNY_per_USD",       // D
      "Futures_USD_per_mt",   // E
      "Spread_USD_per_mt",    // F
      "Spread_pct",           // G
      "Guidance_USD_per_mt",  // H
      "Spot_Source"           // I
    ]);
  }
}

function buildSummary_(sum, raw){
  sum.clear();
  const lastRow = raw.getLastRow();
  const now = new Date();
  sum.appendRow(["As of", now]);

  if (lastRow >= 2) {
    const latest = raw.getRange(lastRow, 1, 1, 9).getValues()[0];
    const spot = latest[1], futCny = latest[2], fx = latest[3], futUsd = latest[4], spread = latest[5], spreadPct = latest[6], guidance = latest[7], spotSrc = latest[8];

    sum.appendRow(["Spot (USD/mt)", isFiniteNumber_(spot) ? round2_(spot) : "N/A"]);
    sum.appendRow(["Futures LC2508 (CNY/t)", isFiniteNumber_(futCny) ? round0_(futCny) : "N/A"]);
    sum.appendRow(["FX (CNY per USD)", fx]);
    sum.appendRow(["Futures (USD/mt)", isFiniteNumber_(futUsd) ? round2_(futUsd) : "N/A"]);
    sum.appendRow(["Spread (USD/mt)", isFiniteNumber_(spread) ? round2_(spread) : "N/A"]);
    sum.appendRow(["Spread (%)", isFiniteNumber_(spreadPct) ? (round2_(spreadPct) + "%") : "N/A"]);
    sum.appendRow(["ALB Guidance (USD/mt)", guidance]);
    sum.appendRow(["Spot Source", spotSrc]);

    sum.appendRow(['']);
    sum.appendRow(["Last 10 Days (for chart)"]);
    sum.appendRow(["Timestamp","Spot_USD_mt","Futures_USD_mt","Guidance_USD_mt"]);

    const startRow = Math.max(2, lastRow - 9);
    const numRows = lastRow - startRow + 1;
      const data = raw.getRange(startRow, 1, numRows, 9).getValues();
      data.forEach(r => sum.appendRow([r[0], r[1], r[4], r[7]]));

      createOrUpdateChart_(sum); // visual of spot vs futures vs guidance
  } else {
    sum.appendRow(["Note","Not enough history yet to draw the 10-day chart."]);
  }
}

function createOrUpdateChart_(sheet){
  const lr = sheet.getLastRow();
  // find "Last 10 Days (for chart)"
  let startRow = null;
  for (let r=1;r<=lr;r++){
    if (sheet.getRange(r,1).getValue() === "Last 10 Days (for chart)") {
      startRow = r + 2;
      break;
    }
  }
  if (!startRow) return;
  const numRows = Math.max(0, lr - startRow + 1);
  if (numRows < 1) return;

  const dataRange = sheet.getRange(startRow, 1, numRows, 4);
  sheet.getCharts().forEach(ch => sheet.removeChart(ch));

  const chart = sheet.newChart()
    .asLineChart()
    .addRange(dataRange)
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_ROWS)
    .setPosition(2, 6, 0, 0)
    .setOption('title','Lithium Carbonate — Spot vs LC2508 Futures (Last 10 Days) + ALB Guidance')
    .setOption('legend',{ position:'bottom' })
    .setOption('hAxis',{ slantedText:true })
    .build();
  sheet.insertChart(chart);
}

/*** Helpers ***/
function isFiniteNumber_(x){ return typeof x === 'number' && isFinite(x); }
function round2_(x){ return Math.round(x*100)/100; }
function round0_(x){ return Math.round(x); }

function onOpen(){
  SpreadsheetApp.getUi().createMenu("ALB Report")
    .addItem("Update Now (Live Fetch)", "ALB_UpdateNow")
    .addToUi();
}
