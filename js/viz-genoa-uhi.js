/**
 * viz-genoa-uhi.js
 * Genoa LST visualization from TIFF
 * Loads and displays the processed TIFF file showing Urban Heat Island in Genoa
 * Uses chunked processing for better performance
 */
function initializeGenoaUHIViz() {
    const container = d3.select('#viz-genoa-uhi');
    
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    // Ensure container has relative positioning for absolute tooltip (set early)
    container.style('position', 'relative')
        .style('overflow', 'hidden');
    
    // Check if GeoTIFF is available
    if (typeof GeoTIFF === 'undefined') {
        container.html('<p style="color: #e53e3e; padding: 20px;">GeoTIFF library not loaded. Please check the script includes.</p>');
        return;
    }
    
    // Create loading message - properly centered
    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '60px 20px')
        .style('color', '#4a5568')
        .style('min-height', '400px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('justify-content', 'center');
    
    loadingMsg.append('p')
        .text('Loading Genoa UHI data from satellite imagery...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Try to load the TIFF file
    const tiffPath = 'data/processed/LST_10m_XGB_2025-07-09_Genoa.tif';
    
    // Use fetch to load the file
    fetch(tiffPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            return GeoTIFF.fromArrayBuffer(arrayBuffer);
        })
        .then(tiff => {
            return tiff.getImage();
        })
        .then(image => {
            // Get image dimensions and data
            const width = image.getWidth();
            const height = image.getHeight();
            const bbox = image.getBoundingBox();
            
            // Read the raster data - readRasters returns a Promise
            return image.readRasters().then(rasters => {
                // Check if rasters is an array
                if (!rasters || !Array.isArray(rasters) || rasters.length === 0) {
                    throw new Error('Invalid raster data structure');
                }
                
                // Get the first band - it might be a TypedArray
                let data = rasters[0];
                
                // Check if data exists and has length
                if (!data || typeof data.length === 'undefined') {
                    throw new Error('Raster data is not iterable or has no length property');
                }
                
                // Calculate min/max and percentiles efficiently
                let minVal = Infinity;
                let maxVal = -Infinity;
                const validValues = [];
                
                for (let i = 0; i < data.length; i++) {
                    const value = data[i];
                    if (!isNaN(value) && value !== null && value !== undefined && isFinite(value)) {
                        if (value < minVal) minVal = value;
                        if (value > maxVal) maxVal = value;
                        validValues.push(value);
                    }
                }
                
                if (validValues.length === 0) {
                    throw new Error('No valid data found in TIFF file');
                }
                
                if (minVal === Infinity || maxVal === -Infinity) {
                    throw new Error('Could not determine data range');
                }
                
                // Calculate 1st and 99th percentiles for color scale (to avoid outlier skewing)
                validValues.sort((a, b) => a - b);
                const p1Index = Math.floor(validValues.length * 0.01);
                const p99Index = Math.floor(validValues.length * 0.99);
                const p1Val = validValues[p1Index];
                const p99Val = validValues[p99Index];
                
                return { data, width, height, minVal, maxVal, p1Val, p99Val, bbox };
            });
        })
        .then(({ data, width, height, minVal, maxVal, p1Val, p99Val, bbox }) => {
            
            //svg display - minimal margins, map should fill the div
            const margin = { top: 0, right: 0, bottom: 120, left: 0 };

            // Compute display width - use full container width (accounting for minimal margins)
            const containerWidth = container.node().getBoundingClientRect().width;
            const displayWidth = containerWidth > 0 ? containerWidth : Math.min(1600, window.innerWidth - 100);
            
            // Compute sample factor 
            const sampleFactor = Math.max(
              1,
              Math.ceil(Math.sqrt((width * height) / (displayWidth * displayWidth * 4)))
            );
            
            // Now compute downsampled raster size
            const rasterWidth  = Math.floor(width / sampleFactor);
            const rasterHeight = Math.floor(height / sampleFactor);
            
            // Preserve correct aspect ratio
            const aspect = rasterHeight / rasterWidth;
            const displayHeight = displayWidth * aspect;
            
            const svgWidth = displayWidth;
            const svgHeight = displayHeight;
            
            
            const svg = container
                .append('svg')
                .attr('width', svgWidth + margin.left + margin.right)
                .attr('height', svgHeight + margin.top + margin.bottom)
                .attr('viewBox', `0 0 ${svgWidth + margin.left + margin.right} ${svgHeight + margin.top + margin.bottom}`)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .style('overflow', 'hidden')
                .style('width', '100%')
                .style('height', 'auto')
                .style('display', 'block');
            
            const svgGroup = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
            
            // INFERNO colormap: perceptually uniform, colorblind-friendly
            const colorScale = d3.scaleSequential(d3.interpolateInferno)
                .domain([p1Val, p99Val])
                .clamp(true); // Clamp values outside the domain
            
            // Create display canvas with correct downsampled dimensions
            const displayCanvas = document.createElement('canvas');
            displayCanvas.width = rasterWidth;
            displayCanvas.height = rasterHeight;
            const displayCtx = displayCanvas.getContext('2d');
            
            // Enable image smoothing for better quality (set before processing)
            displayCtx.imageSmoothingEnabled = true;
            displayCtx.imageSmoothingQuality = 'high';
            
            const imageData = displayCtx.createImageData(rasterWidth, rasterHeight);
            
            // Fill image data with color-mapped values using proper downsampling
            // Average values in each sample block for better quality
            // Process in chunks to avoid blocking the main thread and allow footer to render
            let currentY = 0;
            const chunkSize = 20; // Increased from 10 to 20 for faster processing
            
            function processChunk() {
                const endY = Math.min(currentY + chunkSize, rasterHeight);
                
                for (let displayY = currentY; displayY < endY; displayY++) {
                    for (let displayX = 0; displayX < rasterWidth; displayX++) {
                        // Calculate source pixel range for this display pixel
                        const srcXStart = displayX * sampleFactor;
                        const srcYStart = displayY * sampleFactor;
                        const srcXEnd = Math.min(srcXStart + sampleFactor, width);
                        const srcYEnd = Math.min(srcYStart + sampleFactor, height);
                        
                        // Average values in the sample block
                        let sum = 0;
                        let count = 0;
                        
                        for (let srcY = srcYStart; srcY < srcYEnd; srcY++) {
                            for (let srcX = srcXStart; srcX < srcXEnd; srcX++) {
                                const idx = srcY * width + srcX;
                                if (idx >= 0 && idx < data.length) {
                                    const value = data[idx];
                                    if (!isNaN(value) && value !== null && value !== undefined && isFinite(value)) {
                                        sum += value;
                                        count++;
                                    }
                                }
                            }
                        }
                        
                        // Get color for averaged value (clamped to percentile range)
                        let color = { r: 0, g: 0, b: 0, opacity: 0 };
                        if (count > 0) {
                            const avgValue = sum / count;
                            // Clamp value to percentile range for color mapping
                            const clampedValue = Math.max(p1Val, Math.min(p99Val, avgValue));
                            color = d3.rgb(colorScale(clampedValue));
                        }
                        
                        // Set pixel in image data
                        const displayIdx = (displayY * rasterWidth + displayX) * 4;
                        imageData.data[displayIdx] = color.r;
                        imageData.data[displayIdx + 1] = color.g;
                        imageData.data[displayIdx + 2] = color.b;
                        imageData.data[displayIdx + 3] = count > 0 ? 255 : 0; // Transparent if no valid data
                    }
                }
                
                currentY = endY;
                
                // If there's more to process, schedule next chunk
                // Use requestIdleCallback when available for better performance, otherwise use setTimeout
                if (currentY < rasterHeight) {
                    if (window.requestIdleCallback) {
                        requestIdleCallback(processChunk, { timeout: 100 });
                    } else {
                        setTimeout(processChunk, 0);
                    }
                } else {
                    // All processing complete, put the image data into the canvas
                    displayCtx.putImageData(imageData, 0, 0);
                    continueVisualization();
                }
            }
            
            // Start processing
            function continueVisualization() {
                // Add image to SVG with better rendering
                const imageUrl = displayCanvas.toDataURL('image/png');
                
                // Create a group for zoom/pan
                const imageGroup = svgGroup.append('g');
                
                const imageElement = imageGroup.append('image')
                    .attr('href', imageUrl)
                    .attr('width', displayWidth)
                    .attr('height', displayHeight)
                    .attr('x', 0)
                    .attr('y', 0)
                    .style('image-rendering', 'auto')
                    .style('cursor', 'grab');
                
                // Create tooltip for hover values - fixed position in top-right (container already has position: relative)
                const tooltip = container.append('div')
                    .attr('class', 'uhi-tooltip')
                    .style('position', 'absolute')
                    .style('pointer-events', 'none')
                    .style('background', 'var(--bg-overlay)')
                    .style('color', 'var(--text-primary)')
                    .style('padding', '12px 16px')
                    .style('border-radius', '8px')
                    .style('font-size', '14px')
                    .style('font-family', 'system-ui, sans-serif')
                    .style('opacity', 0)
                    .style('transition', 'opacity 0.2s')
                    .style('z-index', '10')
                    .style('box-shadow', 'var(--shadow-lg)')
                    .style('border', '1px solid var(--border-medium)')
                    .style('min-width', '140px')
                    .style('text-align', 'center')
                    .style('right', '20px')
                    .style('top', '20px')
                    .style('max-width', 'calc(100% - 40px)');
                
                // Zoom state: locked by default (scroll zoom disabled)
                let zoomLocked = true;
                
                // Add zoom behavior - scroll zoom controlled by lock, with boundary constraints
                const zoomBehavior = d3.zoom()
                    .scaleExtent([0.5, 5])
                    .filter(function(event) {
                        // Only allow wheel zoom when unlocked
                        if (event.type === 'wheel') {
                            return !zoomLocked;
                        }
                        return true;
                    })
                    .on('zoom', function(event) {
                        const { transform } = event;
                        // Constrain panning to keep content within SVG bounds
                        const k = transform.k;
                        const maxX = 0;
                        const maxY = 0;
                        const minX = -(displayWidth * k - displayWidth);
                        const minY = -(displayHeight * k - displayHeight);
                        
                        const x = Math.max(minX, Math.min(maxX, transform.x));
                        const y = Math.max(minY, Math.min(maxY, transform.y));
                        
                        // Apply constrained transform
                        imageGroup.attr('transform', `translate(${x},${y}) scale(${k})`);
                    });
                
                svgGroup.call(zoomBehavior);
                
                // Add zoom toggle button - absolute position inside visualization div (bottom-right)
                const zoomButton = container.append('div')
                    .attr('class', 'zoom-toggle-button')
                    .style('position', 'absolute')
                    .style('bottom', '20px')
                    .style('right', '20px')
                    .style('width', '48px')
                    .style('height', '48px')
                    .style('background', 'var(--bg-overlay)')
                    .style('border', '1px solid var(--border-medium)')
                    .style('border-radius', '8px')
                    .style('cursor', 'pointer')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('justify-content', 'center')
                    .style('box-shadow', 'var(--shadow-md)')
                    .style('z-index', '100')
                    .style('transition', 'all 0.2s')
                    .on('click', function(event) {
                        event.stopPropagation();
                        zoomLocked = !zoomLocked;
                        updateZoomIcon();
                    })
                    .on('mouseenter', function() {
                        d3.select(this).style('background', 'var(--bg-card)')
                            .style('box-shadow', 'var(--shadow-lg)');
                    })
                    .on('mouseleave', function() {
                        d3.select(this).style('background', 'var(--bg-overlay)')
                            .style('box-shadow', 'var(--shadow-md)');
                    });
                
                // Create SVG for lens icon
                const lensSvg = zoomButton.append('svg')
                    .attr('width', '24')
                    .attr('height', '24')
                    .style('pointer-events', 'none');
                
                function updateZoomIcon() {
                    lensSvg.selectAll('*').remove();
                    
                    if (zoomLocked) {
                        // Locked state - lens with slash (zoom disabled)
                        // Magnifying glass circle
                        lensSvg.append('circle')
                            .attr('cx', '10')
                            .attr('cy', '10')
                            .attr('r', '6')
                            .attr('fill', 'none')
                            .attr('stroke', '#718096')
                            .attr('stroke-width', '2');
                        // Handle
                        lensSvg.append('line')
                            .attr('x1', '14')
                            .attr('y1', '14')
                            .attr('x2', '18')
                            .attr('y2', '18')
                            .attr('stroke', '#718096')
                            .attr('stroke-width', '2')
                            .attr('stroke-linecap', 'round');
                        // Slash (disabled indicator)
                        lensSvg.append('line')
                            .attr('x1', '4')
                            .attr('y1', '4')
                            .attr('x2', '20')
                            .attr('y2', '20')
                            .attr('stroke', '#e53e3e')
                            .attr('stroke-width', '2')
                            .attr('stroke-linecap', 'round');
                    } else {
                        // Unlocked state - active lens (zoom enabled)
                        // Magnifying glass circle
                        lensSvg.append('circle')
                            .attr('cx', '10')
                            .attr('cy', '10')
                            .attr('r', '6')
                            .attr('fill', 'none')
                            .attr('stroke', '#48bb78')
                            .attr('stroke-width', '2.5');
                        // Handle
                        lensSvg.append('line')
                            .attr('x1', '14')
                            .attr('y1', '14')
                            .attr('x2', '18')
                            .attr('y2', '18')
                            .attr('stroke', '#48bb78')
                            .attr('stroke-width', '2.5')
                            .attr('stroke-linecap', 'round');
                    }
                }
                
                updateZoomIcon();
                
                // Add panning on drag
                svgGroup
                    .on('mousedown', function(event) {
                        if (event.button === 0) {
                            svgGroup.style('cursor', 'grabbing');
                        }
                    })
                    .on('mouseup', function(event) {
                        if (event.button === 0) {
                            svgGroup.style('cursor', 'grab');
                        }
                    })
                    .on('mouseleave', function() {
                        svgGroup.style('cursor', 'grab');
                    });
                
                // Add wheel zoom (when unlocked)
                svgGroup.on('wheel', function(event) {
                    if (!zoomLocked) {
                        event.preventDefault();
                        const delta = -event.deltaY * 0.001;
                        const currentTransform = d3.zoomTransform(svgGroup.node());
                        const scale = currentTransform.k * (1 + delta);
                        const [x, y] = d3.pointer(event, svgGroup.node());
                        zoomBehavior.scaleTo(svgGroup, scale, [x, y]);
                    }
                });
                
                // Add hover tooltip with temperature values
                svgGroup.on('mousemove', function(event) {
                    const [x, y] = d3.pointer(event, svgGroup.node());
                    const transform = d3.zoomTransform(svgGroup.node());
                    
                    // Convert screen coordinates to image coordinates
                    const imageX = (x - transform.x) / transform.k;
                    const imageY = (y - transform.y) / transform.k;
                    
                    // Check if within image bounds
                    if (imageX >= 0 && imageX < displayWidth && imageY >= 0 && imageY < displayHeight) {
                        // Convert to raster coordinates
                        const rasterX = Math.floor((imageX / displayWidth) * rasterWidth);
                        const rasterY = Math.floor((imageY / displayHeight) * rasterHeight);
                        
                        if (rasterX >= 0 && rasterX < rasterWidth && rasterY >= 0 && rasterY < rasterHeight) {
                            // Get temperature value from original data
                            const srcXStart = rasterX * sampleFactor;
                            const srcYStart = rasterY * sampleFactor;
                            const srcXEnd = Math.min(srcXStart + sampleFactor, width);
                            const srcYEnd = Math.min(srcYStart + sampleFactor, height);
                            
                            let sum = 0;
                            let count = 0;
                            
                            for (let srcY = srcYStart; srcY < srcYEnd; srcY++) {
                                for (let srcX = srcXStart; srcX < srcXEnd; srcX++) {
                                    const idx = srcY * width + srcX;
                                    if (idx >= 0 && idx < data.length) {
                                        const value = data[idx];
                                        if (!isNaN(value) && value !== null && value !== undefined && isFinite(value)) {
                                            sum += value;
                                            count++;
                                        }
                                    }
                                }
                            }
                            
                            if (count > 0) {
                                const avgValue = sum / count;
                                const clampedValue = Math.max(p1Val, Math.min(p99Val, avgValue));
                                
                                // Update tooltip - fixed position in top-right corner (using right/top CSS)
                                tooltip
                                    .html(`
                                        <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px; opacity: 0.9;">Temperature</div>
                                        <div style="font-size: 24px; font-weight: 700; color: ${colorScale(clampedValue)}; line-height: 1.2;">
                                            ${avgValue.toFixed(1)}°C
                                        </div>
                                    `)
                                    .style('opacity', 1);
                                
                                return;
                            }
                        }
                    }
                    
                    // Hide tooltip if outside bounds
                    tooltip.style('opacity', 0);
                });
                
                svgGroup.on('mouseleave', function() {
                    tooltip.style('opacity', 0);
                });
                
                // Add color legend with improved apparatus 
                const legendWidth = 300;
                const legendHeight = 25;
                const legend = svgGroup.append('g')
                    .attr('transform', `translate(${(svgWidth - legendWidth) / 2}, ${svgHeight + 40})`);
                
                // Create gradient for legend matching the color scale
                const defs = svgGroup.append('defs');
                const gradient = defs.append('linearGradient')
                    .attr('id', 'heat-gradient')
                    .attr('x1', '0%')
                    .attr('x2', '100%');
                
                // Use more stops for smoother gradient matching the color scale (using percentile range)
                const numStops = 30;
                for (let i = 0; i <= numStops; i++) {
                    const t = i / numStops;
                    const value = p1Val + (p99Val - p1Val) * t;
                    const color = colorScale(value);
                    gradient.append('stop')
                        .attr('offset', `${t * 100}%`)
                        .attr('stop-color', color);
                }
                
                // Draw legend rectangle
                legend.append('rect')
                    .attr('width', legendWidth)
                    .attr('height', legendHeight)
                    .attr('fill', 'url(#heat-gradient)')
                    .attr('stroke', 'var(--border-medium)')
                    .attr('stroke-width', 1)
                    .attr('class', 'legend-rect');
                
                // Add tick marks and labels at key intervals (using percentile range)
                const numTicks = 5; // P1, P99, and 3 intermediate values
                const tickValues = [];
                for (let i = 0; i < numTicks; i++) {
                    const value = p1Val + (p99Val - p1Val) * (i / (numTicks - 1));
                    tickValues.push(value);
                }
                
                // Add tick marks
                tickValues.forEach((value, i) => {
                    const xPos = (i / (numTicks - 1)) * legendWidth;
                    
                    // Draw tick line
                    legend.append('line')
                        .attr('x1', xPos)
                        .attr('x2', xPos)
                        .attr('y1', legendHeight)
                        .attr('y2', legendHeight + 4)
                        .attr('stroke', '#4a5568')
                        .attr('stroke-width', 1);
                    
                    // Add tick label
                    legend.append('text')
                        .attr('x', xPos)
                        .attr('y', legendHeight + 18)
                        .attr('text-anchor', 'middle')
                        .style('font-size', '11px')
                        .style('fill', 'var(--text-secondary)')
                        .attr('class', 'legend-label')
                        .style('font-family', 'system-ui, sans-serif')
                        .text(`${value.toFixed(1)}°C`);
                });
                
                // Add legend title with percentile information
                legend.append('text')
                    .attr('x', legendWidth / 2)
                    .attr('y', -8)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '13px')
                    .style('fill', 'var(--text-primary)')
                    .attr('class', 'legend-title')
                    .style('font-weight', '500')
                    .style('font-family', 'system-ui, sans-serif')
                    .text('Land Surface Temperature (°C)');

                // Add actual min/max values for transparency
                legend.append('text')
                    .attr('x', legendWidth / 2)
                    .attr('y', legendHeight + 45)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('fill', 'var(--text-tertiary)')
                    .attr('class', 'legend-subtitle')
                    .style('font-family', 'system-ui, sans-serif')
                    .text(`Full range: ${minVal.toFixed(1)}°C - ${maxVal.toFixed(1)}°C`);
                
                // Remove loading message
                loadingMsg.remove();
            }
            
            // Start the chunked processing after allowing browser to render footer first
            // Use requestIdleCallback if available, otherwise use setTimeout to allow initial render
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    requestAnimationFrame(processChunk);
                }, { timeout: 100 });
            } else {
                // Small delay to allow footer to render first
                setTimeout(() => {
                    requestAnimationFrame(processChunk);
                }, 0);
            }
        })
        .catch(error => {
            console.error('Error loading Genoa UHI TIFF:', error);
            loadingMsg.html(`
                <p style="color: #e53e3e; margin-bottom: 10px;">Error loading TIFF file</p>
                <p style="color: #718096; font-size: 14px;">${error.message}</p>
                <p style="color: #718096; font-size: 12px; margin-top: 10px;">Please ensure the file exists at: ${tiffPath}</p>
            `);
        });
}

/**
 * Open enlarged modal view with zoom, pan, and tooltips
 * Following Andy Kirk's principles: Clear interactions, accessibility, detailed exploration
 */
function openEnlargedView({ data, width, height, minVal, maxVal, p1Val, p99Val, bbox,
    imageUrl, displayWidth, displayHeight, rasterWidth, rasterHeight,
    sampleFactor, colorScale }) {
    
    // Create modal overlay (Kirk's principle: Clear visual hierarchy)
    const modal = d3.select('body')
        .append('div')
        .attr('class', 'genoa-modal-overlay')
        .attr('role', 'dialog')
        .attr('aria-modal', 'true')
        .attr('aria-label', 'Enlarged Genoa Urban Heat Island visualization')
        .style('position', 'fixed')
        .style('top', 0)
        .style('left', 0)
        .style('width', '100%')
        .style('height', '100%')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('z-index', '10000')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .style('opacity', 0)
        .style('transition', 'opacity 0.3s ease')
        .on('click', function(e) {
            // Close on background click
            if (e.target === this) {
                closeModal();
            }
        });
    
    // Fade in
    modal.transition().duration(300).style('opacity', 1);
    
    // Create modal content container
    const modalContent = modal.append('div')
        .attr('class', 'genoa-modal-content')
        .style('position', 'relative')
        .style('width', '95%')
        .style('max-width', '1400px')
        .style('height', '95%')
        .style('max-height', '95vh')
        .style('background', 'var(--bg-card)')
        .style('border-radius', '12px')
        .style('box-shadow', '0 20px 60px rgba(0, 0, 0, 0.5)')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('overflow', 'hidden')
        .on('click', function(e) {
            e.stopPropagation(); // Prevent closing when clicking inside
        });
    
    // Create header with title and close button (Kirk's principle: Clear controls)
    const header = modalContent.append('div')
        .attr('class', 'genoa-modal-header')
        .style('padding', '20px 24px')
        .style('border-bottom', '1px solid var(--border-light)')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('align-items', 'center')
        .style('flex-shrink', '0');
    
    header.append('h2')
        .attr('class', 'genoa-modal-title')
        .style('margin', 0)
        .style('font-size', '24px')
        .style('font-weight', '600')
        .style('color', 'var(--text-primary)')
        .text('Genoa Urban Heat Island - Interactive View');
    
    const closeButton = header.append('button')
        .attr('class', 'genoa-modal-close')
        .attr('aria-label', 'Close enlarged view')
        .attr('type', 'button')
        .style('background', 'transparent')
        .style('border', 'none')
        .style('font-size', '28px')
        .style('color', 'var(--text-secondary)')
        .style('cursor', 'pointer')
        .style('padding', '4px 12px')
        .style('line-height', '1')
        .style('border-radius', '4px')
        .style('transition', 'all 0.2s')
        .text('×')
        .on('click', closeModal)
        .on('mouseenter', function() {
            d3.select(this).style('color', 'var(--primary-color)').style('background', 'var(--bg-secondary)');
        })
        .on('mouseleave', function() {
            d3.select(this).style('color', 'var(--text-secondary)').style('background', 'transparent');
        });
    
    // Create controls bar (Kirk's principle: User control)
    const controlsBar = modalContent.append('div')
        .attr('class', 'genoa-modal-controls')
        .style('padding', '12px 24px')
        .style('border-bottom', '1px solid var(--border-light)')
        .style('display', 'flex')
        .style('gap', '12px')
        .style('align-items', 'center')
        .style('flex-wrap', 'wrap')
        .style('flex-shrink', '0')
        .style('background', 'var(--bg-secondary)');
    
    // Zoom controls
    const zoomControls = controlsBar.append('div')
        .style('display', 'flex')
        .style('gap', '8px')
        .style('align-items', 'center');
    
    zoomControls.append('span')
        .style('font-size', '14px')
        .style('color', 'var(--text-secondary)')
        .style('font-weight', '500')
        .text('Zoom:');
    
    const zoomInBtn = zoomControls.append('button')
        .attr('aria-label', 'Zoom in')
        .style('padding', '6px 12px')
        .style('background', 'var(--bg-primary)')
        .style('border', '1px solid var(--border-medium)')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('font-size', '16px')
        .style('color', 'var(--text-primary)')
        .text('+')
        .on('click', function() {
            zoom(1.5);
        });
    
    const zoomOutBtn = zoomControls.append('button')
        .attr('aria-label', 'Zoom out')
        .style('padding', '6px 12px')
        .style('background', 'var(--bg-primary)')
        .style('border', '1px solid var(--border-medium)')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('font-size', '16px')
        .style('color', 'var(--text-primary)')
        .text('−')
        .on('click', function() {
            zoom(1/1.5);
        });
    
    const resetBtn = zoomControls.append('button')
        .attr('aria-label', 'Reset zoom and pan')
        .style('padding', '6px 12px')
        .style('background', 'var(--bg-primary)')
        .style('border', '1px solid var(--border-medium)')
        .style('border-radius', '4px')
        .style('cursor', 'pointer')
        .style('font-size', '14px')
        .style('color', 'var(--text-primary)')
        .text('Reset')
        .on('click', resetView);
    
    // Instructions
    controlsBar.append('div')
        .style('margin-left', 'auto')
        .style('font-size', '13px')
        .style('color', 'var(--text-tertiary)')
        .style('font-style', 'italic')
        .html('Drag to pan • Scroll to zoom • Hover for temperature');
    
    // Create visualization container with zoom/pan
    const vizContainer = modalContent.append('div')
        .attr('class', 'genoa-modal-viz-container')
        .style('flex', '1')
        .style('overflow', 'hidden')
        .style('position', 'relative')
        .style('background', 'var(--bg-secondary)');
    
    // Calculate optimal size for modal (larger than original)
    const modalVizWidth = Math.min(1200, window.innerWidth - 100);
    const modalVizHeight = Math.min(800, window.innerHeight - 200);
    const modalAspect = displayHeight / displayWidth;
    const finalWidth = modalVizWidth;
    const finalHeight = modalVizWidth * modalAspect;
    
    // Create SVG for zoomable/panable visualization
    const modalSvg = vizContainer.append('svg')
        .attr('width', finalWidth)
        .attr('height', finalHeight)
        .style('display', 'block')
        .style('cursor', 'grab');
    
    // Create zoom behavior (Kirk's principle: Intuitive interactions)
    const zoomBehavior = d3.zoom()
        .scaleExtent([0.5, 5]) // Allow zoom from 0.5x to 5x
        .on('zoom', function(event) {
            const { transform } = event;
            imageGroup.attr('transform', transform);
            updateTooltipPosition();
        });
    
    modalSvg.call(zoomBehavior);
    
    // Add panning on drag
    let isDragging = false;
    modalSvg
        .on('mousedown', function() {
            isDragging = true;
            modalSvg.style('cursor', 'grabbing');
        })
        .on('mouseup', function() {
            isDragging = false;
            modalSvg.style('cursor', 'grab');
        })
        .on('mouseleave', function() {
            isDragging = false;
            modalSvg.style('cursor', 'grab');
        });
    
    // Add wheel zoom
    modalSvg.on('wheel', function(event) {
        event.preventDefault();
        const delta = -event.deltaY * 0.001;
        const scale = d3.zoomTransform(modalSvg.node()).k * (1 + delta);
        const [x, y] = d3.pointer(event, modalSvg.node());
        zoomBehavior.scaleTo(modalSvg, scale, [x, y]);
    });
    
    // Create image group for zoom/pan
    const imageGroup = modalSvg.append('g');
    
    // Add high-resolution image
    const modalImage = imageGroup.append('image')
        .attr('href', imageUrl)
        .attr('width', finalWidth)
        .attr('height', finalHeight)
        .attr('x', 0)
        .attr('y', 0)
        .style('image-rendering', 'auto');
    
    // Create tooltip (Kirk's principle: Precise data on demand)
    const tooltip = vizContainer.append('div')
        .attr('class', 'genoa-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0, 0, 0, 0.85)')
        .style('color', '#fff')
        .style('padding', '8px 12px')
        .style('border-radius', '6px')
        .style('font-size', '13px')
        .style('font-family', 'system-ui, sans-serif')
        .style('opacity', 0)
        .style('transition', 'opacity 0.2s')
        .style('z-index', '10001')
        .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)');
    
    // Add tooltip on mouse move
    modalSvg.on('mousemove', function(event) {
        const [x, y] = d3.pointer(event, modalSvg.node());
        const transform = d3.zoomTransform(modalSvg.node());
        
        // Convert screen coordinates to image coordinates
        const imageX = (x - transform.x) / transform.k;
        const imageY = (y - transform.y) / transform.k;
        
        // Check if within image bounds
        if (imageX >= 0 && imageX < finalWidth && imageY >= 0 && imageY < finalHeight) {
            // Convert to raster coordinates
            const rasterX = Math.floor((imageX / finalWidth) * rasterWidth);
            const rasterY = Math.floor((imageY / finalHeight) * rasterHeight);
            
            if (rasterX >= 0 && rasterX < rasterWidth && rasterY >= 0 && rasterY < rasterHeight) {
                // Get temperature value from original data
                const srcXStart = rasterX * sampleFactor;
                const srcYStart = rasterY * sampleFactor;
                const srcXEnd = Math.min(srcXStart + sampleFactor, width);
                const srcYEnd = Math.min(srcYStart + sampleFactor, height);
                
                let sum = 0;
                let count = 0;
                
                for (let srcY = srcYStart; srcY < srcYEnd; srcY++) {
                    for (let srcX = srcXStart; srcX < srcXEnd; srcX++) {
                        const idx = srcY * width + srcX;
                        if (idx >= 0 && idx < data.length) {
                            const value = data[idx];
                            if (!isNaN(value) && value !== null && value !== undefined && isFinite(value)) {
                                sum += value;
                                count++;
                            }
                        }
                    }
                }
                
                if (count > 0) {
                    const avgValue = sum / count;
                    const clampedValue = Math.max(p1Val, Math.min(p99Val, avgValue));
                    
                    // Update tooltip
                    tooltip
                        .style('left', (x + 15) + 'px')
                        .style('top', (y - 10) + 'px')
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 4px;">Temperature</div>
                            <div style="font-size: 16px; font-weight: 700; color: ${colorScale(clampedValue)};">
                                ${avgValue.toFixed(1)}°C
                            </div>
                            <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
                                Range: ${minVal.toFixed(1)}°C - ${maxVal.toFixed(1)}°C
                            </div>
                        `)
                        .style('opacity', 1);
                    
                    return;
                }
            }
        }
        
        // Hide tooltip if outside bounds
        tooltip.style('opacity', 0);
    });
    
    modalSvg.on('mouseleave', function() {
        tooltip.style('opacity', 0);
    });
    
    // Add legend to modal
    const modalMargin = { top: 20, right: 20, bottom: 100, left: 20 };
    const modalLegend = modalSvg.append('g')
        .attr('transform', `translate(${(finalWidth - 300) / 2}, ${finalHeight + 60})`);
    
    // Reuse legend code from main visualization
    const modalDefs = modalSvg.append('defs');
    const modalGradient = modalDefs.append('linearGradient')
        .attr('id', 'modal-heat-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');
    
    const numStops = 30;
    for (let i = 0; i <= numStops; i++) {
        const t = i / numStops;
        const value = p1Val + (p99Val - p1Val) * t;
        const color = colorScale(value);
        modalGradient.append('stop')
            .attr('offset', `${t * 100}%`)
            .attr('stop-color', color);
    }
    
    modalLegend.append('rect')
        .attr('width', 300)
        .attr('height', 25)
        .attr('fill', 'url(#modal-heat-gradient)')
        .attr('stroke', 'var(--text-secondary)')
        .attr('stroke-width', 1);
    
    const numTicks = 5;
    const tickValues = [];
    for (let i = 0; i < numTicks; i++) {
        const value = p1Val + (p99Val - p1Val) * (i / (numTicks - 1));
        tickValues.push(value);
    }
    
    tickValues.forEach((value, i) => {
        const xPos = (i / (numTicks - 1)) * 300;
        
        modalLegend.append('line')
            .attr('x1', xPos)
            .attr('x2', xPos)
            .attr('y1', 25)
            .attr('y2', 29)
            .attr('stroke', 'var(--text-secondary)')
            .attr('stroke-width', 1);
        
        modalLegend.append('text')
            .attr('x', xPos)
            .attr('y', 47)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', 'var(--text-secondary)')
            .style('font-family', 'system-ui, sans-serif')
            .text(`${value.toFixed(1)}°C`);
    });
    
    modalLegend.append('text')
        .attr('x', 150)
        .attr('y', -8)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', 'var(--text-primary)')
        .style('font-weight', '500')
        .style('font-family', 'system-ui, sans-serif')
        .text('Land Surface Temperature (°C)');
    
    // Zoom and pan functions
    function zoom(factor) {
        const currentTransform = d3.zoomTransform(modalSvg.node());
        const newScale = currentTransform.k * factor;
        const [x, y] = [finalWidth / 2, finalHeight / 2];
        zoomBehavior.scaleTo(modalSvg, newScale, [x, y]);
    }
    
    function resetView() {
        zoomBehavior.transform(modalSvg, d3.zoomIdentity);
    }
    
    function updateTooltipPosition() {
        // Tooltip position is updated in mousemove handler
    }
    
    function closeModal() {
        modal.transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function() {
                modal.remove();
                // Restore body scroll
                document.body.style.overflow = '';
            });
    }
    
    // Keyboard navigation (Kirk's principle: Accessibility)
    const keyHandler = function(event) {
        if (event.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', keyHandler);
        } else if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            zoom(1.5);
        } else if (event.key === '-' || event.key === '_') {
            event.preventDefault();
            zoom(1/1.5);
        } else if (event.key === '0') {
            event.preventDefault();
            resetView();
        }
    };
    
    document.addEventListener('keydown', keyHandler);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    // Focus management for accessibility
    closeButton.node().focus();
}
