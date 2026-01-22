/**
 * viz-utils.js
 * Utility functions for visualizations
 */

/**
 * Example function to load data from a CSV file
 * Replace with your actual data loading logic
 */
async function loadData(filePath) {
    try {
        const data = await d3.csv(filePath);
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
}

/**
 * Example function to load JSON data
 */
async function loadJSONData(filePath) {
    try {
        const data = await d3.json(filePath);
        return data;
    } catch (error) {
        console.error('Error loading JSON data:', error);
        return null;
    }
}

/**
 * Utility function to create a color scale for temperature
 */
function createTemperatureColorScale(data, domain = null) {
    const minTemp = domain ? domain[0] : d3.min(data, d => d.temperature);
    const maxTemp = domain ? domain[1] : d3.max(data, d => d.temperature);
    
    // Color scale from cool (blue) to hot (red)
    return d3.scaleSequential()
        .domain([minTemp, maxTemp])
        .interpolator(d3.interpolateRgb('#1a237e', '#ff6f00')); // Blue to orange
}

/**
 * Utility function to format tooltip content
 */
function formatTooltip(d) {
    // Customize based on your data structure
    return `
        <strong>Temperature:</strong> ${d.temperature}°C<br>
        <strong>Date:</strong> ${d.date}<br>
        <strong>Location:</strong> ${d.location || 'N/A'}
    `;
}

/**
 * Set up event listeners for visualization controls
 */
function setupVizControls() {
    // Time range selector for Viz 1
    const timeRangeSelect = document.getElementById('time-range');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log('Time range changed to:', selectedValue);
            // TODO: Filter data and update visualization
            // updateViz1(selectedValue);
        });
    }
    
    // Region filter for Viz 2
    const regionFilter = document.getElementById('region-filter');
    if (regionFilter) {
        regionFilter.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log('Region filter changed to:', selectedValue);
            // TODO: Filter data and update visualization
            // updateViz2(selectedValue);
        });
    }
}

