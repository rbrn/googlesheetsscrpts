# EPS_Model Google Sheet Overview

## 1. Details of the Generated Code for EPS_Model Google Sheet
**Environment:** Google Apps Script (runs inside Google Sheets)

### Core Functions
- **getSpotPrice()** – Scrapes battery-grade lithium carbonate spot prices from Metal.com spot page, targeting the `<div class="price___2mpJr">` element.
  - Converts CNY/mt to USD/mt using a fixed exchange rate or live FX API.
- **getFuturesPrice()** – Scrapes LC2508 lithium futures prices from Metal.com futures page.
  - Also converts from CNY/mt to USD/mt.
- **appendDailyData()** – Appends the daily spot and futures data to the `Raw_Data` sheet.
  - Adds the spread (USD) and spread (%) automatically.
- **updateChart()** – Updates a chart to show the last 10 days of spot vs futures vs Albemarle’s guidance midpoint ($9,500/mt).

### Structure of `Raw_Data` Sheet
```
Date | Futures_USD_mt | Spot_USD_mt | Spread_USD_mt | Spread_%
```
Newest entries are appended at the bottom to allow chronological charting.

## 2. Purpose of the Code
The goal of the EPS_Model sheet and scripts is to:

- Automatically retrieve current lithium market prices (spot & futures) daily without manual input.
- Store historical price data for trend analysis and correlation with Albemarle’s EPS guidance.
- Allow simulation of different futures price scenarios (e.g., 75k, 80k, 85k CNY/mt) and estimate how these would impact:
  - Revenue
  - EBITDA
  - EPS
  - Stock Price Targets
- Support data visualization via an updated 10-day price chart, showing ALB’s guidance midpoint for quick comparison.

## 3. Key Assumptions in the Model
- **Exchange Rate:**
  - Fixed or retrieved via live API (currently ~7.20 CNY/USD).
  - This directly impacts USD/mt conversion accuracy.
- **ALB Price Realization:**
  - Assumes Albemarle’s realized selling price is closely correlated with LC2508 futures for the respective quarter (guidance generally based on forward contracts rather than current spot).
- **EPS Sensitivity:**
  - Based on historical Q4 2024 data as baseline; price moves are proportionally mapped to revenue changes.
  - EBITDA margin is assumed stable unless cost changes are explicitly modeled.
- **No Currency Hedging Impact Modeled:**
  - Assumes direct pass-through of USD prices without FX hedging distortions.

## 4. To-Do List to Improve the Model
### ✅ Immediate
- Integrate Live FX API (e.g., exchangerate.host or Yahoo Finance) instead of static CNY→USD conversion rate.
- Reverse Row Order in `Raw_Data` so latest is bottom for easier chronological charting.

### 📈 Medium-Term
- Add EPS Projection Logic: link futures price to modeled revenue → EBITDA → EPS.
- Pull ALB Guidance automatically from filings or news to update the midpoint dynamically.
- Incorporate Historical EPS vs Lithium Price Correlation for better simulation accuracy.
- Add Short Interest Data into the daily report to measure sentiment and squeeze potential.

### 🚀 Advanced
- Integrate Analyst Rating Changes & Insider Transactions directly into the sheet for daily tracking.
- Create Scenario Simulator inside the sheet: user inputs futures price → model outputs projected EPS & price target.
- Export Daily Report to PDF/Slack/Email automatically with chart + market summary.

