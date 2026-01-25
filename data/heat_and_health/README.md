# Heat and Health Data

This directory contains health impact data from the **Lancet Countdown on Health and Climate Change 2025 Report**.

## Data Sources

All data downloaded from: [Lancet Countdown Data Platform](https://www.lancetcountdown.org/data-platform/)

### Files

1. **Indicator-1.1.1_Vulnerable_Data-Download_2025-Lancet-Countdown-Report-1.xlsx**
   - **Indicator**: 1.1.1 - Heatwave exposure of vulnerable populations
   - **Metrics**: Total exposure events for infants and adults aged 65+
   - **Coverage**: Country-level data (1980–2024)
   - **Description**: Person-events exceeding heat thresholds, calculated using ERA5 temperature data and population statistics
   - **Output**: 
     - `vulnerable_population_exposure.json` (Italy time series)
     - `vulnerable_population_choropleth.json` (Global 2024)

2. **Indicator-1.1.3_PWHL_Data-Download_2025-Lancet-Countdown-Report_v2-1.xlsx**
   - **Indicator**: 1.1.3 - Population-weighted hours lost (PWHL)
   - **Metrics**: Hours of sleep/work lost per person per year due to heat exposure
   - **Coverage**: Country-level data (1990–2024)
   - **Description**: Calculated using labor force data, heat exposure thresholds, and outdoor work hours
   - **Output**: `sleep_hours_lost.json` (Italy time series)

3. **Indicator-1.1.4_Data-Download_2025-Lancet-Countdown-Report-1.xlsx**
   - **Indicator**: 1.1.4 - Global sleep loss percentage
   - **Metrics**: Percentage of sleep lost due to heat
   - **Coverage**: Global aggregate (2015–2024)
   - **Output**: `global_sleep_loss.json`

4. **Indicator-1.1.5_Data-Download_2025-Lancet-Countdown-Report-1.xlsx**
   - **Indicator**: 1.1.5 - Economic losses due to heat
   - **Metrics**: Attributable fraction (AF) and absolute number (AN)
   - **Coverage**: Global aggregate (1990–2021)
   - **Output**: `economic_losses.json`

## Data Processing

Run the processing script to convert Excel files to JSON:

```bash
cd data/heat_and_health
python3 -m venv venv
source venv/bin/activate
pip install pandas openpyxl
python3 process_health_data.py
```

### Processing Steps

1. **Extraction**: Read Excel sheets using `pandas.read_excel()`
2. **Filtering**: Extract Italy-specific data for country-level indicators
3. **Aggregation**: Calculate totals (e.g., infants + older adults)
4. **Sorting**: Top 30 countries by total exposure for choropleth
5. **Export**: Save as JSON in `../json/` directory

## Visualizations

### 1. Sleep Hours Lost (Italy, 1990–2024)
- **Type**: Line chart with area fill
- **File**: `viz-sleep-hours-lost.js`
- **Data**: `sleep_hours_lost.json`
- **Key Findings**: Shows trend in heat-related sleep disruption over 35 years

### 2. Vulnerable Population Exposure (Italy, 1980–2024)
- **Type**: Dual-line chart (infants vs. adults 65+)
- **File**: `viz-vulnerable-exposure.js`
- **Data**: `vulnerable_population_exposure.json`
- **Key Findings**: Highlights disproportionate exposure of vulnerable age groups

### 3. Global Vulnerability (2024)
- **Type**: Horizontal bar chart (Top 30 countries)
- **File**: `viz-vulnerable-choropleth.js`
- **Data**: `vulnerable_population_choropleth.json`
- **Key Findings**: Geographic distribution of heat vulnerability globally

## Data Quality

- **Source Authority**: Lancet Countdown is a peer-reviewed, multi-disciplinary collaboration tracking health impacts of climate change
- **Methodology**: Published annually in *The Lancet* with rigorous quality control
- **Validation**: Cross-referenced with ERA5 temperature data and demographic statistics
- **Limitations**: 
  - Exposure thresholds may vary by region due to acclimatization
  - Historical data quality dependent on temperature records and population estimates
  - Infant and 65+ age group definitions may vary slightly by country

## References

- Romanello, M., et al. (2024). "The 2024 report of the Lancet Countdown on health and climate change." *The Lancet*. 
- Lancet Countdown Data Platform: https://www.lancetcountdown.org/data-platform/
- ERA5 Reanalysis: Copernicus Climate Change Service (C3S)

## License

Data provided by Lancet Countdown under CC BY 4.0 license. See [https://www.lancetcountdown.org/](https://www.lancetcountdown.org/) for terms of use.
