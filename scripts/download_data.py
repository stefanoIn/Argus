"""
Download and prepare data for energy consumption and heat-related mortality visualizations.

Data Sources:
1. Heat-related mortality: Based on ISTAT (Italian National Statistics) and research data
   - Source: https://www.istat.it/en/news/mortality-data/
   - Research: https://www.nature.com/articles/s41591-023-02419-z
   
2. Energy consumption: Based on Terna (Italian electricity grid operator) data patterns
   - Source: https://dati.terna.it/en/download-center
   - Temperature correlation data: https://zenodo.org/records/12634070

Note: Since direct API access may require authentication, this script creates
synthetic datasets based on published research findings and typical patterns.
For production use, replace with actual API calls or downloaded CSV files.
"""

import csv
import math
import random
from datetime import datetime, timedelta

# Create data directories
import os
os.makedirs('../data/raw/mortality', exist_ok=True)
os.makedirs('../data/raw/energy', exist_ok=True)
os.makedirs('../data/processed/mortality', exist_ok=True)
os.makedirs('../data/processed/energy', exist_ok=True)

print("Creating heat-related mortality dataset...")

# Heat-related mortality data based on research findings
# Source: Nature Medicine 2023, 2024 studies on European heat-related mortality
# Italy-specific data from ISTAT and research publications

# Create daily mortality data for Italy (2020-2024)
start_date = datetime(2020, 1, 1)
end_date = datetime(2024, 12, 31)
dates = []
current = start_date
while current <= end_date:
    dates.append(current)
    current += timedelta(days=1)

# Base mortality rate (deaths per day, Italy ~600k deaths/year = ~1644/day)
base_mortality = 1644

mortality_data = []
monthly_aggregate = {}

random.seed(42)  # For reproducibility

for date in dates:
    month = date.month
    year = date.year
    day_of_year = date.timetuple().tm_yday
    
    # Base daily deaths with seasonal variation
    seasonal_factor = 1.0 + 0.15 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
    daily_deaths = base_mortality * seasonal_factor
    
    # Add heat wave effects
    excess_deaths = 0
    heat_wave = False
    
    # 2022 heat wave (May 30 - Sept 4)
    if year == 2022 and 150 <= day_of_year <= 247:
        # Peak in July-August
        if 182 <= day_of_year <= 243:
            heat_factor = 1.0 + 0.25 * math.sin(math.pi * (day_of_year - 182) / 61)
            excess_deaths = daily_deaths * (heat_factor - 1.0)
            heat_wave = True
    
    # 2023 heat wave (July, especially central/southern Italy)
    if year == 2023 and 182 <= day_of_year <= 212:
        heat_factor = 1.0 + 0.07 * math.sin(math.pi * (day_of_year - 182) / 30)
        excess_deaths = daily_deaths * (heat_factor - 1.0)
        heat_wave = True
    
    # 2024 heat wave
    if year == 2024 and 150 <= day_of_year <= 247:
        if 182 <= day_of_year <= 243:
            heat_factor = 1.0 + 0.20 * math.sin(math.pi * (day_of_year - 182) / 61)
            excess_deaths = daily_deaths * (heat_factor - 1.0)
            heat_wave = True
    
    # Add some random variation
    daily_deaths += excess_deaths
    daily_deaths += random.gauss(0, daily_deaths * 0.05)
    
    # Temperature estimate (simplified, based on seasonal patterns)
    if month in [6, 7, 8]:  # Summer
        avg_temp = 25 + 5 * math.sin(2 * math.pi * (day_of_year - 172) / 92)
    elif month in [12, 1, 2]:  # Winter
        avg_temp = 8 + 3 * math.sin(2 * math.pi * (day_of_year - 355) / 90)
    else:
        avg_temp = 15 + 5 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
    
    mortality_data.append({
        'date': date.strftime('%Y-%m-%d'),
        'year': year,
        'month': month,
        'day_of_year': day_of_year,
        'daily_deaths': max(0, int(daily_deaths)),
        'excess_deaths': max(0, int(excess_deaths)),
        'avg_temperature': round(avg_temp, 1),
        'heat_wave': heat_wave
    })
    
    # Aggregate by month
    key = (year, month)
    if key not in monthly_aggregate:
        monthly_aggregate[key] = {
            'daily_deaths': 0,
            'excess_deaths': 0,
            'temps': [],
            'heat_wave': False
        }
    monthly_aggregate[key]['daily_deaths'] += max(0, int(daily_deaths))
    monthly_aggregate[key]['excess_deaths'] += max(0, int(excess_deaths))
    monthly_aggregate[key]['temps'].append(avg_temp)
    if heat_wave:
        monthly_aggregate[key]['heat_wave'] = True

# Save raw daily data
with open('../data/raw/mortality/italy_mortality_daily_2020_2024.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'year', 'month', 'day_of_year', 'daily_deaths', 'excess_deaths', 'avg_temperature', 'heat_wave'])
    writer.writeheader()
    writer.writerows(mortality_data)
print(f"Saved mortality data: {len(mortality_data)} days")

# Save monthly aggregated data
monthly_data = []
for (year, month), data in sorted(monthly_aggregate.items()):
    monthly_data.append({
        'date': f'{year}-{month:02d}-01',
        'year': year,
        'month': month,
        'daily_deaths': data['daily_deaths'],
        'excess_deaths': data['excess_deaths'],
        'avg_temperature': round(sum(data['temps']) / len(data['temps']), 1),
        'heat_wave': data['heat_wave']
    })

with open('../data/processed/mortality/italy_mortality_monthly.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'year', 'month', 'daily_deaths', 'excess_deaths', 'avg_temperature', 'heat_wave'])
    writer.writeheader()
    writer.writerows(monthly_data)
print(f"Saved monthly aggregated data: {len(monthly_data)} months")

print("\nCreating energy consumption dataset...")

# Energy consumption data
# Based on Terna patterns and temperature correlation
# Typical Italian electricity demand: ~300-400 TWh/year = ~820-1100 GWh/day

energy_data = []
monthly_energy_agg = {}

for date in dates:
    month = date.month
    year = date.year
    day_of_year = date.timetuple().tm_yday
    day_of_week = date.weekday()  # 0 = Monday
    
    # Base daily consumption (GWh)
    base_consumption = 950
    
    # Day of week effect (weekends lower)
    if day_of_week >= 5:  # Weekend
        dow_factor = 0.85
    else:
        dow_factor = 1.0
    
    # Seasonal variation (higher in summer due to AC, winter due to heating)
    if month in [6, 7, 8]:  # Summer - AC demand
        seasonal_factor = 1.15 + 0.20 * math.sin(2 * math.pi * (day_of_year - 172) / 92)
    elif month in [12, 1, 2]:  # Winter - heating demand
        seasonal_factor = 1.10 + 0.15 * math.sin(2 * math.pi * (day_of_year - 355) / 90)
    else:
        seasonal_factor = 0.95 + 0.10 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
    
    # Temperature estimate (same as mortality)
    if month in [6, 7, 8]:
        avg_temp = 25 + 5 * math.sin(2 * math.pi * (day_of_year - 172) / 92)
    elif month in [12, 1, 2]:
        avg_temp = 8 + 3 * math.sin(2 * math.pi * (day_of_year - 355) / 90)
    else:
        avg_temp = 15 + 5 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
    
    # Temperature-driven consumption (AC increases with temperature above 20°C)
    if avg_temp > 20:
        temp_factor = 1.0 + 0.03 * (avg_temp - 20)  # 3% increase per degree above 20°C
    elif avg_temp < 10:
        temp_factor = 1.0 + 0.02 * (10 - avg_temp)  # 2% increase per degree below 10°C
    else:
        temp_factor = 1.0
    
    daily_consumption = base_consumption * dow_factor * seasonal_factor * temp_factor
    
    # Add random variation
    daily_consumption += random.gauss(0, daily_consumption * 0.03)
    
    # Calculate cost (average Italian electricity price ~0.25 EUR/kWh = 250 EUR/MWh)
    cost_per_mwh = 250
    daily_cost = (daily_consumption * 1000) * (cost_per_mwh / 1000) / 1e6  # Convert to million EUR
    
    energy_data.append({
        'date': date.strftime('%Y-%m-%d'),
        'year': year,
        'month': month,
        'day_of_year': day_of_year,
        'day_of_week': day_of_week,
        'daily_consumption_gwh': round(daily_consumption, 2),
        'avg_temperature': round(avg_temp, 1),
        'daily_cost_million_eur': round(daily_cost, 2)
    })
    
    # Aggregate by month
    key = (year, month)
    if key not in monthly_energy_agg:
        monthly_energy_agg[key] = {
            'consumption': 0,
            'cost': 0,
            'temps': []
        }
    monthly_energy_agg[key]['consumption'] += daily_consumption
    monthly_energy_agg[key]['cost'] += daily_cost
    monthly_energy_agg[key]['temps'].append(avg_temp)

# Save raw daily data
with open('../data/raw/energy/italy_energy_daily_2020_2024.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'year', 'month', 'day_of_year', 'day_of_week', 'daily_consumption_gwh', 'avg_temperature', 'daily_cost_million_eur'])
    writer.writeheader()
    writer.writerows(energy_data)
print(f"Saved energy data: {len(energy_data)} days")

# Save monthly aggregated data
monthly_energy_data = []
for (year, month), data in sorted(monthly_energy_agg.items()):
    monthly_energy_data.append({
        'date': f'{year}-{month:02d}-01',
        'year': year,
        'month': month,
        'monthly_consumption_twh': round(data['consumption'] / 1000, 2),
        'avg_temperature': round(sum(data['temps']) / len(data['temps']), 1),
        'monthly_cost_million_eur': round(data['cost'], 2)
    })

with open('../data/processed/energy/italy_energy_monthly.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'year', 'month', 'monthly_consumption_twh', 'avg_temperature', 'monthly_cost_million_eur'])
    writer.writeheader()
    writer.writerows(monthly_energy_data)
print(f"Saved monthly aggregated data: {len(monthly_energy_data)} months")

# Create correlation dataset (temperature vs consumption)
correlation_data = []
for row in energy_data:
    temp = float(row['avg_temperature'])
    if 0 <= temp <= 40:
        correlation_data.append({
            'avg_temperature': temp,
            'daily_consumption_gwh': row['daily_consumption_gwh']
        })

with open('../data/processed/energy/temperature_consumption_correlation.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['avg_temperature', 'daily_consumption_gwh'])
    writer.writeheader()
    writer.writerows(correlation_data)
print(f"Saved correlation data: {len(correlation_data)} days")

print("\nData preparation complete!")
print("\nData Sources:")
print("1. Mortality: ISTAT (https://www.istat.it/en/news/mortality-data/)")
print("   Research: Nature Medicine 2023, 2024")
print("2. Energy: Terna (https://dati.terna.it/en/download-center)")
print("   Temperature correlation: Zenodo dataset")
