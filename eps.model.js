/***********************
 * EPS model: Front-month LC futures → EPS projection (reuses existing sheet)
 ***********************/
const EPS_CFG = {
  SHEET: "EPS_Model",
  FX_CNY_PER_USD: 7.20,          // edit if you prefer
  BASELINE_USD_MT: 9500,         // ALB guidance midpoint baseline
  EBITDA_BASELINE_M: 251,        // Q4'24 baseline EBITDA ($M) – adjust to your baseline
  EPS_BASELINE: 0.29,            // Q4'24 baseline EPS – adjust to your baseline
  // Sensitivities (you can tune these later to ALB’s deck):
  // +$1,000/mt → +$50M EBITDA per quarter; +$0.60 EPS per $1,000/mt
  EBITDA_PER_1000_USD_M: 50,
  EPS_PER_1000_USD: 0.60,
  FUTURES_URL_PREFIX: "https://www.metal.com/Lithium/",
};

/** Menu hook */
function onOpen_eps() {
  SpreadsheetApp.getUi().createMenu("ALB EPS")
    .addItem("Update EPS from front-month LC", "ALB_UpdateEPS_Model")
    .addToUi();
}

/** Public entry – schedule this daily after your main update if you want */
/***********************
 * Enhanced EPS/Revenue model (front-month LC → Revenue, EBITDA, EPS)
 * Appends newest at bottom. Reads assumptions from N2:S2 in EPS_Model.
 ***********************/
function ALB_UpdateEPS_Model() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(EPS_CFG.SHEET) || ss.insertSheet(EPS_CFG.SHEET);

  ensureEpsHeaders_Extended_(sh);   // wider header set

  // --- Read assumptions (edit in cells N2:S2) ---
  const [volQ_mt, ebitdaMarginPct, dnaM, intM, taxPct, sharesM] =
    sh.getRange("N2:S2").getValues()[0].map(v => Number(v));

  // Fallbacks if cells empty
  const VOL_Q = isFiniteNumber_(volQ_mt) ? volQ_mt : 48000;
  const EBITDA_MAR = isFiniteNumber_(ebitdaMarginPct) ? ebitdaMarginPct/100 : 0.40;
  const DNA_M = isFiniteNumber_(dnaM) ? dnaM : 100;
  const INT_M = isFiniteNumber_(intM) ? intM : 35;
  const TAX = isFiniteNumber_(taxPct) ? taxPct/100 : 0.20;
  const SHARES_M = isFiniteNumber_(sharesM) ? sharesM : 117;

  // --- Futures (front month) ---
  const lcCode = getFrontMonthLCCode_();                     // e.g., LC2508
  const futCny = fetchLCFutures_CNYt_(lcCode);
  const fx = EPS_CFG.FX_CNY_PER_USD;
  const futUsdMt = isFiniteNumber_(futCny) ? (futCny / fx) : null;

  // --- Baseline & deltas ---
  const baseUsd = EPS_CFG.BASELINE_USD_MT;
  const priceDelta = (isFiniteNumber_(futUsdMt) ? (futUsdMt - baseUsd) : null);

  // EBITDA/EPS sensitivities (still available for comparison)
  const ebitdaBase = EPS_CFG.EBITDA_BASELINE_M;
  const ebitdaDeltaSens = (isFiniteNumber_(priceDelta) ? (priceDelta / 1000) * EPS_CFG.EBITDA_PER_1000_USD_M : null);
  const epsBase = EPS_CFG.EPS_BASELINE;
  const epsProjectedSens = (isFiniteNumber_(priceDelta) ? (epsBase + (priceDelta / 1000) * EPS_CFG.EPS_PER_1000_USD) : null);

  // --- Revenue & EBITDA model from assumptions ---
  // Revenue (US$M) = Futures_USD/mt * Volume_Q_mt / 1e6
  const revenueM = isFiniteNumber_(futUsdMt) ? (futUsdMt * VOL_Q) / 1e6 : null;
  // EBITDA (US$M) = Revenue * EBITDA_Margin
  const ebitdaM = isFiniteNumber_(revenueM) ? (revenueM * EBITDA_MAR) : null;
  // EBIT (US$M) = EBITDA - D&A
  const ebitM = (isFiniteNumber_(ebitdaM) ? ebitdaM : 0) - (isFiniteNumber_(DNA_M) ? DNA_M : 0);
  // EBT (US$M) = EBIT - Interest
  const ebtM = ebitM - (isFiniteNumber_(INT_M) ? INT_M : 0);
  // Net Income (US$M)
  const netM = ebtM * (1 - (isFiniteNumber_(TAX) ? TAX : 0.20));
  // EPS (US$) = Net / Shares
  const epsModel = (isFiniteNumber_(netM) && isFiniteNumber_(SHARES_M) && SHARES_M > 0)
      ? (netM * 1e6) / (SHARES_M * 1e6) : null;

  // Append newest at bottom
  sh.appendRow([
    new Date(),               // A Timestamp
    lcCode,                   // B LC_Code
    isFiniteNumber_(futCny) ? round0_(futCny) : "",          // C Futures_CNY/t
    fx,                       // D FX
    isFiniteNumber_(futUsdMt) ? round2_(futUsdMt) : "",      // E Futures_USD/mt
    baseUsd,                  // F Baseline_USD/mt
    isFiniteNumber_(priceDelta) ? round2_(priceDelta) : "",  // G Price_Delta_USD
    ebitdaBase,               // H EBITDA_Baseline_M (for reference)
    isFiniteNumber_(ebitdaDeltaSens) ? round2_(ebitdaDeltaSens) : "", // I EBITDA_Δ_M (sensitivity)
    epsBase,                  // J EPS_Baseline (ref)
    isFiniteNumber_(epsProjectedSens) ? round2_(epsProjectedSens) : "", // K EPS_Projected (sensitivity)
    isFiniteNumber_(revenueM) ? round2_(revenueM) : "",       // L Revenue_Est_M
    isFiniteNumber_(ebitdaM) ? round2_(ebitdaM) : "",         // M EBITDA_Est_M
    isFiniteNumber_(DNA_M) ? round2_(DNA_M) : "",             // N D&A_M
    isFiniteNumber_(INT_M) ? round2_(INT_M) : "",             // O Interest_M
    isFiniteNumber_(TAX) ? (round2_(TAX*100) + "%") : "",     // P TaxRate_%
    isFiniteNumber_(SHARES_M) ? round2_(SHARES_M) : "",       // Q Shares_M
    isFiniteNumber_(epsModel) ? round2_(epsModel) : ""        // R EPS_Model (from revenue)
  ]);

  buildEpsDualAxisChart_(sh); // prettier chart
}

/** Ensure expanded headers and assumption labels */
function ensureEpsHeaders_Extended_(sh){
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "Timestamp","LC_Code","Futures_CNY_per_t","FX_CNY_per_USD","Futures_USD_per_mt",
      "Baseline_USD_per_mt","Price_Delta_USD","EBITDA_Baseline_M","EBITDA_Δ_M",
      "EPS_Baseline","EPS_Projected","Revenue_Est_M","EBITDA_Est_M",
      "D&A_M","Interest_M","TaxRate_%","Shares_M","EPS_Model"
    ]);
    // Assumptions headers in row 1 (N1:S1)
    sh.getRange("N1").setValue("Volume_Q_mt");
    sh.getRange("O1").setValue("EBITDA_Margin_%");
    sh.getRange("P1").setValue("DnA_M_per_Q");
    sh.getRange("Q1").setValue("Interest_M_per_Q");
    sh.getRange("R1").setValue("TaxRate_%");
    sh.getRange("S1").setValue("Shares_M");
    // Defaults in row 2 if empty
    if (!sh.getRange("N2").getValue()) sh.getRange("N2").setValue(48000);
    if (!sh.getRange("O2").getValue()) sh.getRange("O2").setValue(40);
    if (!sh.getRange("P2").getValue()) sh.getRange("P2").setValue(100);
    if (!sh.getRange("Q2").getValue()) sh.getRange("Q2").setValue(35);
    if (!sh.getRange("R2").getValue()) sh.getRange("R2").setValue(20);
    if (!sh.getRange("S2").getValue()) sh.getRange("S2").setValue(117);
  }
}

/** Dual-axis chart: Futures USD/mt (left) vs EPS_Model (right) */
function buildEpsDualAxisChart_(sh){
  const lr = sh.getLastRow();
  if (lr < 3) return;
  const start = Math.max(2, lr - 13);
  const timeR = sh.getRange(start, 1, lr - start + 1, 1);  // Timestamp
  const futR  = sh.getRange(start, 5, lr - start + 1, 1);  // Futures_USD/mt (E)
  const epsR  = sh.getRange(start, 18, lr - start + 1, 1); // EPS_Model (R)

  // remove old charts
  sh.getCharts().forEach(c => sh.removeChart(c));

  // Build a combo chart to get dual axes
  const chart = sh.newChart()
    .asComboChart()
    .addRange(timeR)
    .addRange(futR)
    .addRange(epsR)
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_ROWS)
    .setPosition(2, 8, 0, 0)
    .setOption('title','Front-month Futures (USD/mt) vs EPS (last ~14)')
    .setOption('legend', { position: 'bottom' })
    .setOption('series', {
      0: { type: 'line', targetAxisIndex: 0, labelInLegend: 'Futures USD/mt' },
      1: { type: 'line', targetAxisIndex: 1, labelInLegend: 'EPS (model)' }
    })
    .setOption('vAxes', {
      0: { title: 'Futures (USD/mt)' },
      1: { title: 'EPS (US$)' }
    })
    .build();

  sh.insertChart(chart);
}


/** Determine front-month LC code: LC + YY + MM */
function getFrontMonthLCCode_() {
  // Use Europe/Bucharest (your TZ) to avoid off-by-one near midnight
  const tz = Session.getScriptTimeZone() || "Europe/Bucharest";
  const now = new Date();
  const y = Utilities.formatDate(now, tz, "yy"); // last 2 digits
  const m = Utilities.formatDate(now, tz, "MM"); // 01..12
  return "LC" + y + m;
}

/** Scrape futures last price (CNY/t) for a given LC code from metal.com */
function fetchLCFutures_CNYt_(lcCode) {
  try {
    const url = EPS_CFG.FUTURES_URL_PREFIX + lcCode.toLowerCase(); // e.g., .../lc2508
    const html = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.metal.com/"
      }
    }).getContentText();

    // Heuristic: pick the first plausible large number 60–90k (CNY/t) near top
    const candidates = html.match(/(\d{2,3},\d{3}|\d{5,6})(?=\s*(?:CNY|元|\/?t|\/?吨)?)/g);
    if (candidates && candidates.length) {
      for (var i = 0; i < candidates.length; i++) {
        const v = parseInt(candidates[i].replace(/,/g, ""), 10);
        if (v >= 60000 && v <= 90000) return v;
      }
    }
    return null;
  } catch (e) {
    Logger.log("fetchLCFutures_CNYt_ failed: " + e);
    return null;
  }
}

/** Ensure headers for EPS_Model */
function ensureEpsHeaders_(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "Timestamp",
      "LC_Code",
      "Futures_CNY_per_t",
      "FX_CNY_per_USD",
      "Futures_USD_per_mt",
      "Baseline_USD_per_mt",
      "Price_Delta_USD",
      "EBITDA_Baseline_M",
      "EBITDA_Δ_M",
      "EPS_Baseline",
      "EPS_Projected"
    ]);
  }
}

/** Tiny helper chart (last 14 rows) */
function buildEpsMiniChart_(sh) {
  const lr = sh.getLastRow();
  if (lr < 3) return; // need some data
  const start = Math.max(2, lr - 13);
  const range = sh.getRange(start, 1, lr - start + 1, 11); // whole row slice

  // Remove existing charts to avoid multiples
  sh.getCharts().forEach(c => sh.removeChart(c));

  // Build a small line chart for Futures_USD_per_mt & EPS_Projected
  const chart = sh.newChart()
    .asLineChart()
    .addRange(sh.getRange(start, 1, lr - start + 1, 1))   // Timestamp
    .addRange(sh.getRange(start, 5, lr - start + 1, 1))   // Futures_USD_per_mt
    .addRange(sh.getRange(start, 11, lr - start + 1, 1))  // EPS_Projected
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_ROWS)
    .setPosition(2, 8, 0, 0)
    .setOption('title', 'Front-month Futures (USD/mt) & EPS Projection (last ~14)')
    .setOption('legend', { position: 'bottom' })
    .setOption('hAxis', { slantedText: true })
    .build();
  sh.insertChart(chart);
}

/*** Reuse helpers from your existing script ***/
function isFiniteNumber_(x){ return typeof x === 'number' && isFinite(x); }
function round2_(x){ return Math.round(x*100)/100; }
function round0_(x){ return Math.round(x); }
