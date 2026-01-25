#!/usr/bin/env python3
"""
Process Lancet Countdown health data for heat-related impacts
"""
import pandas as pd
import json
import os

# Output directory
output_dir = '../json'
os.makedirs(output_dir, exist_ok=True)

# ============================================================================
# 1. VULNERABLE POPULATION EXPOSURE (Indicator 1.1.1)
# ============================================================================
print("Processing vulnerable population exposure data...")
df_vulnerable = pd.read_excel(
    'Indicator-1.1.1_Vulnerable_Data-Download_2025-Lancet-Countdown-Report-1.xlsx',
    sheet_name='2025 Report Data_Country'
)

# Filter for Italy
italy_vulnerable = df_vulnerable[df_vulnerable['Country'] == 'Italy'].copy()
italy_vulnerable = italy_vulnerable[['Year', 'exposures_total_infants', 'exposures_total_65']]
italy_vulnerable = italy_vulnerable.sort_values('Year')

# Convert to JSON format
vulnerable_data = []
for _, row in italy_vulnerable.iterrows():
    vulnerable_data.append({
        'year': int(row['Year']),
        'infants': float(row['exposures_total_infants']),
        'older_adults': float(row['exposures_total_65'])
    })

with open(f'{output_dir}/vulnerable_population_exposure.json', 'w') as f:
    json.dump(vulnerable_data, f, indent=2)
print(f"✓ Saved vulnerable population data: {len(vulnerable_data)} years")

# Also get global/regional data for choropleth
# Get most recent year for all countries
recent_year = df_vulnerable['Year'].max()
df_recent = df_vulnerable[df_vulnerable['Year'] == recent_year].copy()

choropleth_data = []
for _, row in df_recent.iterrows():
    choropleth_data.append({
        'country': row['Country'],
        'iso3': row['ISO3'],
        'year': int(row['Year']),
        'infants': float(row['exposures_total_infants']),
        'older_adults': float(row['exposures_total_65']),
        'total': float(row['exposures_total_infants'] + row['exposures_total_65'])
    })

with open(f'{output_dir}/vulnerable_population_choropleth.json', 'w') as f:
    json.dump(choropleth_data, f, indent=2)
print(f"✓ Saved choropleth data: {len(choropleth_data)} countries")

# ============================================================================
# 2. SLEEP HOURS LOST (Indicator 1.1.3 - PWHL)
# ============================================================================
print("\nProcessing sleep hours lost data...")
df_sleep = pd.read_excel(
    'Indicator-1.1.3_PWHL_Data-Download_2025-Lancet-Countdown-Report_v2-1.xlsx',
    sheet_name='2025 Report Data_Country'
)

# Filter for Italy
italy_sleep = df_sleep[df_sleep['Country'] == 'Italy'].copy()
italy_sleep = italy_sleep[['Year', 'TotalSunWHLpp']].sort_values('Year')

# Convert to JSON format
sleep_data = []
for _, row in italy_sleep.iterrows():
    sleep_data.append({
        'year': int(row['Year']),
        'hours_lost_per_person': float(row['TotalSunWHLpp'])
    })

with open(f'{output_dir}/sleep_hours_lost.json', 'w') as f:
    json.dump(sleep_data, f, indent=2)
print(f"✓ Saved sleep hours lost data: {len(sleep_data)} years")

# ============================================================================
# 3. GLOBAL SLEEP LOSS PERCENTAGE (Indicator 1.1.4)
# ============================================================================
print("\nProcessing global sleep loss percentage...")
df_sleep_global = pd.read_excel(
    'Indicator-1.1.4_Data-Download_2025-Lancet-Countdown-Report-1.xlsx',
    sheet_name='2025 Report Data_Global'
)

sleep_global_data = []
for _, row in df_sleep_global.iterrows():
    sleep_global_data.append({
        'year': int(row['Year']),
        'sleep_loss_percentage': float(row['Sleep_loss_percentage'])
    })

with open(f'{output_dir}/global_sleep_loss.json', 'w') as f:
    json.dump(sleep_global_data, f, indent=2)
print(f"✓ Saved global sleep loss data: {len(sleep_global_data)} years")

# ============================================================================
# 4. ECONOMIC LOSSES (Indicator 1.1.5)
# ============================================================================
print("\nProcessing economic losses...")
df_economic = pd.read_excel(
    'Indicator-1.1.5_Data-Download_2025-Lancet-Countdown-Report-1.xlsx',
    sheet_name='2025 Report Data_Global'
)

economic_data = []
for _, row in df_economic.iterrows():
    economic_data.append({
        'year': int(row['Year']),
        'af': float(row['AF']),  # Attributable fraction
        'an': float(row['AN'])   # Absolute number
    })

with open(f'{output_dir}/economic_losses.json', 'w') as f:
    json.dump(economic_data, f, indent=2)
print(f"✓ Saved economic losses data: {len(economic_data)} years")

print("\n" + "="*80)
print("All data processed successfully!")
print("="*80)
