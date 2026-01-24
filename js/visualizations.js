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
    console.log('[Viz] Initializing all visualizations...');
    
    // Initialize each visualization with error handling
    try {
        initializeGenoaUHIViz();
    } catch (error) {
        console.error('[Viz] Error initializing Genoa UHI:', error);
    }
    
    // Add delay for Land Cover visualization to ensure DOM is ready
    setTimeout(() => {
        try {
            initializeGenoaUhiScrolly();
        } catch (error) {
            console.error('[Viz] Error initializing Land Cover:', error);
        }
    }, 100);
    
    setTimeout(() => {
        try {
            initializeGenoaNDVIViz();
        } catch (error) {
            console.error('[Viz] Error initializing NDVI:', error);
        }
    }, 200);
    
    setTimeout(() => {
        try {
            initializeSankeyLandCoverViz();
        } catch (error) {
            console.error('[Viz] Error initializing Sankey:', error);
        }
    }, 300);
}
