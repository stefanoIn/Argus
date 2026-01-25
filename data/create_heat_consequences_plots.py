"""
Create Publication-Ready Visualizations for Heat Consequences
Part of Urban Heat Islands Data Visualization Project

This script creates:
1. Energy Consumption vs Temperature (dual-axis line chart)
2. Heat-Related Mortality (bar/line chart)

Data Sources (cited in comments):
- Energy: Eurostat nrg_cb_pem or nrg_cb_e
- Temperature: Copernicus ERA5 or World Bank Climate
- Mortality: Eurostat demo_mexrt or peer-reviewed research

Author: Data Visualization Project
Date: 2025
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from datetime import datetime
import os

# Set publication-ready style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 13
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9
plt.rcParams['figure.figsize'] = (10, 6)

# Directories
data_dir = "processed"
output_dir = "processed"
os.makedirs(output_dir, exist_ok=True)

print("=" * 70)
print("CREATING HEAT CONSEQUENCES VISUALIZATIONS")
print("=" * 70)

# ============================================================================
# PART 1: ENERGY CONSUMPTION VS TEMPERATURE
# ============================================================================

print("\n[PLOT 1] Creating Energy Consumption vs Temperature Chart...")

# Load data
data_path = os.path.join(data_dir, "energy_temperature_monthly.csv")
if os.path.exists(data_path):
    df = pd.read_csv(data_path)
    df['date'] = pd.to_datetime(df['date'])
    print(f"  ✓ Loaded data from {data_path}")
else:
    print(f"  ✗ Data file not found: {data_path}")
    print("  → Run fetch_heat_consequences_data.py first")
    exit(1)

# Create the dual-axis plot
fig, ax1 = plt.subplots(figsize=(12, 6))

# Left y-axis: Electricity Consumption
color1 = '#e85d04'  # Orange (heat theme)
ax1.set_xlabel('Month', fontweight='bold')
ax1.set_ylabel('Electricity Consumption (GWh)', color=color1, fontweight='bold')
line1 = ax1.plot(df['date'], df['electricity_gwh'], 
                 color=color1, linewidth=2, label='Electricity Consumption', marker='o', markersize=3)
ax1.tick_params(axis='y', labelcolor=color1)
ax1.grid(True, alpha=0.3, linestyle='--')

# Right y-axis: Temperature
ax2 = ax1.twinx()
color2 = '#dc2626'  # Red (temperature theme)
ax2.set_ylabel('Average Temperature (°C)', color=color2, fontweight='bold')
line2 = ax2.plot(df['date'], df['temperature_c'], 
                 color=color2, linewidth=2, label='Temperature', marker='s', markersize=3, linestyle='--')
ax2.tick_params(axis='y', labelcolor=color2)

# Title and subtitle
plt.title('Electricity Demand Increases During Hot Periods', 
          fontsize=16, fontweight='bold', pad=20)
plt.suptitle('Italy, Monthly Averages (2020-2023)', 
             fontsize=11, y=0.96, style='italic')

# Add legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', framealpha=0.9)

# Format x-axis dates
fig.autofmt_xdate(rotation=45)
ax1.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter('%Y-%m'))

# Add caption text box
caption_text = ("Higher temperatures increase cooling demand, raising electricity consumption.\n"
                "Data sources: Eurostat (energy), Copernicus ERA5 (temperature)")
fig.text(0.5, 0.02, caption_text, ha='center', fontsize=9, 
         style='italic', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'energy_consumption_vs_temperature.png'), 
            bbox_inches='tight', facecolor='white')
print(f"  ✓ Saved: {output_dir}/energy_consumption_vs_temperature.png")

# ============================================================================
# PART 2: HEAT-RELATED MORTALITY
# ============================================================================

print("\n[PLOT 2] Creating Heat-Related Mortality Chart...")

# Load mortality data
mortality_path = os.path.join(data_dir, "heat_mortality_yearly.csv")
if os.path.exists(mortality_path):
    mortality_df = pd.read_csv(mortality_path)
    print(f"  ✓ Loaded data from {mortality_path}")
else:
    print(f"  ✗ Data file not found: {mortality_path}")
    print("  → Run fetch_heat_consequences_data.py first")
    exit(1)

# Create bar chart
fig, ax = plt.subplots(figsize=(10, 6))

# Color scheme: darker red for higher mortality
colors = plt.cm.Reds(np.linspace(0.4, 0.9, len(mortality_df)))

bars = ax.bar(mortality_df['year'], mortality_df['excess_deaths'], 
              color=colors, edgecolor='darkred', linewidth=1.5, alpha=0.8)

# Add value labels on bars
for i, (bar, value) in enumerate(zip(bars, mortality_df['excess_deaths'])):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height,
            f'{int(value):,}',
            ha='center', va='bottom', fontweight='bold', fontsize=9)

# Styling
ax.set_xlabel('Year', fontweight='bold')
ax.set_ylabel('Excess Deaths', fontweight='bold')
ax.set_title('Excess Mortality During Extreme Heat Events', 
             fontsize=16, fontweight='bold', pad=20)
ax.set_title('Europe / Italy (Official Statistics)', 
             fontsize=11, style='italic', pad=5, loc='right')

# Grid
ax.grid(True, alpha=0.3, linestyle='--', axis='y')
ax.set_axisbelow(True)

# Highlight 2022 (record year)
ax.axvline(x=2022, color='darkred', linestyle=':', linewidth=2, alpha=0.7, label='Record heatwave (2022)')
ax.legend(loc='upper left', framealpha=0.9)

# Add caption
caption_text = ("Extreme heat events are associated with increased mortality, "
                "particularly among vulnerable populations.\n"
                "Data sources: Eurostat excess mortality statistics, "
                "peer-reviewed research (Nature, 2023)")
fig.text(0.5, 0.02, caption_text, ha='center', fontsize=9, 
         style='italic', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))

plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'heat_related_mortality.png'), 
           bbox_inches='tight', facecolor='white')
print(f"  ✓ Saved: {output_dir}/heat_related_mortality.png")

# ============================================================================
# CONNECTION TO UHI (as amplifiers)
# ============================================================================

print("\n" + "=" * 70)
print("CONNECTION TO URBAN HEAT ISLANDS")
print("=" * 70)
print("""
These visualizations demonstrate the CONSEQUENCES of heat, not UHI directly.

HOW UHI AMPLIFIES THESE IMPACTS:

1. ENERGY CONSUMPTION:
   - Urban areas experience higher temperatures due to UHI effect
   - This increases cooling demand MORE than rural areas
   - The energy consumption chart shows the general relationship;
     UHI amplifies this in urban centers specifically

2. MORTALITY:
   - Heat-related mortality is concentrated in urban areas
   - UHI effect makes cities hotter than surrounding areas
   - Vulnerable populations in cities face higher heat exposure
   - The mortality data reflects this urban concentration

IMPORTANT CAVEATS:
- These are aggregate, national-level visualizations
- We do NOT claim direct neighborhood-level causality
- UHI is an AMPLIFIER of heat impacts, not the sole cause
- Multiple factors contribute (age, health, infrastructure, etc.)

The defensible inference: Urban heat islands make existing heat problems worse,
particularly in areas with high population density and low green cover.
""")

print("\n" + "=" * 70)
print("VISUALIZATIONS COMPLETE")
print("=" * 70)
print(f"\nOutput files saved to: {output_dir}/")
print("  - energy_consumption_vs_temperature.png")
print("  - heat_related_mortality.png")
print("\nData files:")
print("  - energy_temperature_monthly.csv")
print("  - heat_mortality_yearly.csv")
