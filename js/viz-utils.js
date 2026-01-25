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

/**
 * Lazy load visualization when container enters viewport
 * Uses IntersectionObserver to only initialize when visible
 * @param {string} containerSelector - CSS selector for visualization container
 * @param {Function} initFunction - Function to call when container becomes visible
 * @param {Object} options - Configuration options
 * @param {string} options.rootMargin - Margin around root (e.g., '200px' for pre-loading)
 * @param {number} options.threshold - Intersection threshold (0-1)
 */
function initializeLazyViz(containerSelector, initFunction, options = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.warn(`[LazyViz] Container not found: ${containerSelector}`);
        return;
    }
    
    // Check if already loaded
    if (container.dataset.loaded === 'true') {
        return;
    }
    
    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
        // Fallback: initialize immediately
        console.warn('[LazyViz] IntersectionObserver not supported, initializing immediately');
        container.dataset.loaded = 'true';
        initFunction();
        return;
    }
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.dataset.loaded !== 'true') {
                entry.target.dataset.loaded = 'true';
                console.log(`[LazyViz] Loading visualization: ${containerSelector}`);
                try {
                    initFunction();
                } catch (error) {
                    console.error(`[LazyViz] Error initializing ${containerSelector}:`, error);
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: options.rootMargin || '200px',
        threshold: options.threshold || 0.1
    });
    
    observer.observe(container);
}

/**
 * Fetch file with progress tracking
 * @param {string} url - URL to fetch
 * @param {Function} onProgress - Callback function(received, total) called during download
 * @returns {Promise<ArrayBuffer>} - Promise resolving to ArrayBuffer
 */
async function fetchWithProgress(url, onProgress) {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : null;
    
    if (!response.body) {
        throw new Error('ReadableStream not supported');
    }
    
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        received += value.length;
        
        if (onProgress && total) {
            onProgress(received, total);
        }
    }
    
    // Combine chunks into single ArrayBuffer
    const allChunks = new Uint8Array(received);
    let position = 0;
    for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
    }
    
    return allChunks.buffer;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} - Formatted string (e.g., "18.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

