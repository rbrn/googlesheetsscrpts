/***********************
 * ALB Daily Spot vs Futures Report (for EPS_Model)
 *
 * Business logic:
 *   - Retrieve battery‑grade lithium carbonate spot prices and the actively
 *     traded LC2508 futures contract from Metal.com.
 *   - Append today’s values to the `Raw_Data` sheet where history is stored in
 *     chronological order for trend analysis.
 *   - Compute and store the absolute and percentage spread between futures and
 *     spot to monitor market expectations.
 *   - Refresh a chart of the last 10 days showing spot, futures and Albemarle’s
 *     $9,500/mt guidance midpoint.
 ***********************/
const CFG = {
  SHEET: 'Raw_Data',
  GUIDANCE_USD_MT: 9500,                // Albemarle guidance midpoint
  URL_SPOT: 'https://www.metal.com/Lithium/201102250058', // Metal.com spot page (CNY/t)
  URL_FUTURES: 'https://www.metal.com/Lithium/lc2508',    // Metal.com LC2508 futures (CNY/t)
};

/** Menu hook */
function onOpen(){
  SpreadsheetApp.getUi().createMenu('ALB Report')
    .addItem('Update Now', 'runDailyUpdate')
    .addToUi();
}

/** Entry point – fetch prices, append row, refresh chart */
function runDailyUpdate(){
  const spot = getSpotPrice();
  const fut = getFuturesPrice();
  appendDailyData(spot, fut);
  updateChart();
}

/***********************
 * Fetch battery-grade lithium carbonate spot price
 * Scrapes the `<div class="price___2mpJr">` element from the Metal.com spot
 * page. The value is assumed to be in CNY per metric ton.
 ***********************/
function getSpotPrice(){
  try {
    const html = UrlFetchApp.fetch(CFG.URL_SPOT, {
      method: 'get', muteHttpExceptions: true, followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.metal.com/'
      }
    }).getContentText();

    // Extract the first price in the targeted div
    const m = html.match(/<div\s+class="price___2mpJr">\s*([\d,]+)/i);
    if (m && m[1]) {
      const cny = parseFloat(m[1].replace(/,/g, ''));
      if (isFiniteNumber_(cny)) return cny; // CNY/mt
    }
    return null;
  } catch(e){
    Logger.log('getSpotPrice failed: ' + e);
    return null;
  }
}

/***********************
 * Fetch LC2508 futures last price
 * Similar scrape as above but on the futures page. The first large number in
 * the HTML (60k–90k CNY/t) is treated as the last price.
 ***********************/
function getFuturesPrice(){
  try {
    const html = UrlFetchApp.fetch(CFG.URL_FUTURES, {
      method: 'get', muteHttpExceptions: true, followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }).getContentText();

    const nums = html.match(/(\d{2,3},\d{3}|\d{5,6})(?=\s*(?:CNY|\u5143|\/t|\/吨)?)/g);
    if (nums && nums.length){
      for (let i=0;i<nums.length;i++){
        const v = parseInt(nums[i].replace(/,/g,''),10);
        if (v >= 60000 && v <= 90000) return v; // CNY/mt
      }
    }
    return null;
  } catch(e){
    Logger.log('getFuturesPrice failed: ' + e);
    return null;
  }
}

/***********************
 * Append today's data to Raw_Data
 * Sheet layout: Date | Futures_CNY_mt | Spot_CNY_mt | Spread_CNY_mt | Spread_%
 * New rows are appended at the bottom so chronology is preserved.
 ***********************/
function appendDailyData(spot, fut){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CFG.SHEET) || ss.insertSheet(CFG.SHEET);
  ensureHeaders_(sh);

  // Futures minus spot highlights how far forward contracts are deviating
  // from physical market pricing. This spread is key for gauging sentiment
  // and potential EPS impact.
  const spreadCny = (isFiniteNumber_(fut) && isFiniteNumber_(spot)) ? (fut - spot) : null;
  const spreadPct = (isFiniteNumber_(spreadCny) && isFiniteNumber_(spot)) ? ((spreadCny / spot) * 100) : null;

  sh.appendRow([
    new Date(),
    isFiniteNumber_(fut) ? round2_(fut) : '',
    isFiniteNumber_(spot) ? round2_(spot) : '',
    isFiniteNumber_(spreadCny) ? round2_(spreadCny) : '',
    isFiniteNumber_(spreadPct) ? round2_(spreadPct) : ''
  ]);
}

/***********************
 * Redraw chart of the last 10 days
 * Visual aid: overlays futures, spot and Albemarle's $9,500/mt guidance
 * to see whether the market is pricing above or below management's view.
 * A helper sheet is used to include the constant guidance line.
 ***********************/
function updateChart(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CFG.SHEET);
  const lr = sh.getLastRow();
  if (lr < 2) return; // need at least one data row

  const start = Math.max(2, lr - 9); // last 10 rows
  const numRows = lr - start + 1;

  // Build temporary sheet with guidance column for charting
  const temp = ss.getSheetByName('_ChartData') || ss.insertSheet('_ChartData');
  temp.clear();
  temp.appendRow(['Date','Futures_CNY_mt','Spot_CNY_mt','Guidance_CNY_mt']);
  const rows = sh.getRange(start,1,numRows,3).getValues();
  rows.forEach(r => temp.appendRow([r[0], r[1], r[2], CFG.GUIDANCE_USD_MT]));

  // Remove old charts on Raw_Data sheet
  sh.getCharts().forEach(c => sh.removeChart(c));

  const chart = sh.newChart()
    .asLineChart()
    .addRange(temp.getRange(1,1,numRows+1,4))
    .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_ROWS)
    .setOption('title','Lithium Carbonate — Spot vs LC2508 Futures (Last 10 Days) + ALB Guidance')
    .setOption('legend',{ position:'bottom' })
    .setOption('hAxis',{ slantedText:true })
    .setPosition(2,6,0,0)
    .build();
  sh.insertChart(chart);
}

/** Ensure headers exist */
function ensureHeaders_(sh){
  if (sh.getLastRow() === 0){
    sh.appendRow(['Date','Futures_CNY_mt','Spot_CNY_mt','Spread_CNY_mt','Spread_%']);
  }
}

/*** Small helpers ***/
// Guard against NaN/null so spreadsheet cells aren't polluted
function isFiniteNumber_(x){ return typeof x === 'number' && isFinite(x); }
// Round to 2 decimals for cleaner USD figures
function round2_(x){ return Math.round(x*100)/100; }