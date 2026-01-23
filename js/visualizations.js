/**
 * visualizations.js
 * Main initialization file for all visualizations
 * This file coordinates the initialization of all visualization modules
 */

// Wait for DOM and D3 to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js is not loaded. Please ensure D3.js is included in the HTML.');
        return;
    }
    
    // Initialize visualizations
    initializeVisualizations();
});

/**
 * Initialize all visualizations
 */
function initializeVisualizations() {
    // Initialize each visualization for storytelling format
    initializeGenoaUHIViz();
    initializeGenoaNDVIViz();
}