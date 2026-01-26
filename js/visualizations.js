/**
 * visualizations.js
 * Main initialization file for all visualizations
 * This file coordinates the initialization of all visualization modules
 */

console.log('[Viz] Script loaded, waiting for DOM...');

// Wait for DOM and D3 to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Viz] DOMContentLoaded fired, checking D3...');
    
    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js is not loaded. Please ensure D3.js is included in the HTML.');
        return;
    }
    
    // Delay visualization initialization slightly to let animations set up first
    setTimeout(() => {
        console.log('[Viz] Starting visualization initialization (after animations)');
        initializeVisualizations();
    }, 100);
});

/**
 * Initialize all visualizations
 */
function initializeVisualizations() {
    console.log('[Viz] Initializing all visualizations...');
    
    // Lazy load TIFF-based visualizations (large files, start loading early)
    // These use IntersectionObserver with large rootMargin to preload well before viewport
    if (typeof initializeLazyViz === 'function') {
        // Genoa UHI - preload when still far from viewport (2000px away)
        initializeLazyViz('#viz-genoa-uhi', initializeGenoaUHIViz, {
            rootMargin: '2000px',
            threshold: 0.01
        });
        
        // Land Cover scrolly - preload when still far from viewport (2000px away)
        initializeLazyViz('#viz-genoa-uhi-scrolly', initializeGenoaUhiScrolly, {
            rootMargin: '2000px',
            threshold: 0.01
        });
    } else {
        // Fallback: initialize immediately if lazy loading not available
        console.warn('[Viz] Lazy loading not available, initializing TIFF visualizations immediately');
        try {
            initializeGenoaUHIViz();
        } catch (error) {
            console.error('[Viz] Error initializing Genoa UHI:', error);
        }
        setTimeout(() => {
            try {
                initializeGenoaUhiScrolly();
            } catch (error) {
                console.error('[Viz] Error initializing Land Cover:', error);
            }
        }, 100);
    }
    
    // Initialize non-TIFF visualizations with more stagger to reduce initial load
    // Prioritize above-the-fold content
    setTimeout(() => {
        try {
            initializeSankeyLandCoverViz();
        } catch (error) {
            console.error('[Viz] Error initializing Sankey:', error);
        }
    }, 200);
    
    setTimeout(() => {
        try {
            initializeProportionalSquaresViz();
        } catch (error) {
            console.error('[Viz] Error initializing Proportional Squares:', error);
        }
    }, 400);
    
    setTimeout(() => {
        try {
            initializeItalyElectricityViz();
        } catch (error) {
            console.error('[Viz] Error initializing Italy Electricity:', error);
        }
    }, 500);
    
    setTimeout(() => {
        try {
            initializeHDDCDDViz();
        } catch (error) {
            console.error('[Viz] Error initializing HDD/CDD:', error);
        }
    }, 600);
    
    // Health visualizations
    setTimeout(() => {
        try {
            initializeGlobalSleepLossViz();
        } catch (error) {
            console.error('[Viz] Error initializing Global Sleep Loss:', error);
        }
    }, 800);
    
    setTimeout(() => {
        try {
            initializeGlobalMortalityViz();
        } catch (error) {
            console.error('[Viz] Error initializing Global Mortality:', error);
        }
    }, 1000);
    
    setTimeout(() => {
        try {
            initializeWorkHoursLostViz();
        } catch (error) {
            console.error('[Viz] Error initializing Work Hours Lost:', error);
        }
    }, 1200);
    
    setTimeout(() => {
        try {
            initializeVulnerablePopulationsViz();
        } catch (error) {
            console.error('[Viz] Error initializing Vulnerable Populations:', error);
        }
    }, 1400);
}
