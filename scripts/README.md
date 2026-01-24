# Data Sources and Preprocessing

This document describes the data sources and preprocessing steps for the energy consumption and heat-related mortality visualizations.

## Data Sources

### 1. Heat-Related Mortality Data

**Primary Source:** ISTAT (Italian National Institute of Statistics)
- **URL:** https://www.istat.it/en/news/mortality-data/
- **Description:** Daily mortality data for Italy from 2020-2024, covering all municipalities
- **Data Format:** CSV files with daily death counts by municipality

**Research References:**
- Nature Medicine 2023: "Heat-related mortality in Europe during the summer of 2022"
  - URL: https://www.nature.com/articles/s41591-023-02419-z
  - Findings: 61,672 heat-related deaths in Europe (May-Sept 2022), with Italy accounting for a significant portion

- Nature Medicine 2024: "Heat-related mortality in Europe during 2024"
  - URL: https://www.nature.com/articles/s41591-025-03954-7
  - Findings: 62,775 heat-related deaths in 2024

**Key Statistics Used:**
- Base mortality rate: ~1,644 deaths/day (Italy average)
- 2022 heat wave: ~18,000 excess deaths in Italy
- 2023 heat wave: 7% increase in mortality in central/southern Italy (July)
- 2024 heat wave: Similar patterns to 2022

### 2. Energy Consumption Data

**Primary Source:** Terna (Italian Transmission System Operator)
- **URL:** https://dati.terna.it/en/download-center
- **Description:** Italian electricity consumption data by region, sector, and time period
- **Data Format:** Excel/CSV tables with hourly, daily, and monthly aggregates

**Temperature Correlation Data:**
- **Source:** Zenodo dataset - "Weather- and climate-driven power supply and demand time series for European countries"
- **URL:** https://zenodo.org/records/12634070
- **Description:** Historical time series (1940-2023) correlating climate variables with power demand
- **Includes:** Heating and cooling demand time series with calibration coefficients

**Key Statistics Used:**
- Base consumption: ~950 GWh/day (Italy average)
- Temperature correlation: ~3% increase per °C above 20°C (cooling demand)
- Average electricity price: ~0.25 EUR/kWh (250 EUR/MWh)
- 2022 heat wave: 15%+ increase in electricity demand

## Preprocessing Script

**File:** `scripts/download_data.py`

**Dependencies:** Python 3 (standard library only - no external packages required)

**What it does:**
1. Generates synthetic datasets based on published research findings and typical patterns
2. Creates daily and monthly aggregated datasets
3. Models temperature-mortality and temperature-consumption correlations
4. Includes heat wave effects based on documented events (2022, 2023, 2024)

**Output Files:**
- `data/raw/mortality/italy_mortality_daily_2020_2024.csv` - Daily mortality data
- `data/processed/mortality/italy_mortality_monthly.csv` - Monthly aggregated mortality
- `data/raw/energy/italy_energy_daily_2020_2024.csv` - Daily energy consumption
- `data/processed/energy/italy_energy_monthly.csv` - Monthly aggregated energy
- `data/processed/energy/temperature_consumption_correlation.csv` - Correlation dataset

**Running the script:**
```bash
cd scripts
python3 download_data.py
```

## Data Limitations

**Important Note:** The current implementation uses synthetic data generated based on:
- Published research findings
- Typical seasonal patterns
- Documented heat wave events

**For production use:**
1. Replace synthetic data with actual ISTAT mortality data downloads
2. Replace synthetic data with actual Terna API calls or CSV downloads
3. Use real temperature data from meteorological services
4. Validate correlations against published research

## Visualization Files

- `js/viz-energy-consumption.js` - Energy consumption vs temperature visualization
- `js/viz-mortality.js` - Heat-related mortality timeline visualization

Both visualizations load data from the processed CSV files and create interactive D3.js charts.
