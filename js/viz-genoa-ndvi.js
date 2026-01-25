/**
 * viz-genoa-ndvi.js
 * Genoa NDVI Visualization from TIFF
 * Loads and displays NDVI data with optimized chunked processing
 */
function initializeGenoaNDVIViz() {
    const container = d3.select('#viz-genoa-ndvi');
    if (container.empty()) return;
    container.selectAll('*').remove();
    
    // Ensure container has relative positioning for absolute tooltip (set early)
    container.style('position', 'relative')
        .style('overflow', 'hidden');

    if (typeof GeoTIFF === 'undefined') {
        container.html('<p style="color:#e53e3e;padding:20px;">GeoTIFF library not loaded.</p>');
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
    
    const statusText = loadingMsg.append('p')
        .text('Loading Genoa NDVI data…')
        .style('font-size', '16px')
        .style('margin', '0 0 10px 0');
    
    const progressText = loadingMsg.append('p')
        .text('')
        .style('font-size', '13px')
        .style('margin', '0')
        .style('color', '#718096');

    const tiffPath = 'data/processed/NDVI_genoa_2025-07-09.tif';
    
    // Use fetchWithProgress to load the file with progress tracking
    const progressCallback = (typeof fetchWithProgress === 'function' && typeof formatBytes === 'function')
        ? (received, total) => {
            const percent = Math.round((received / total) * 100);
            const receivedMB = formatBytes(received);
            const totalMB = formatBytes(total);
            progressText.text(`Downloading... ${percent}% (${receivedMB} / ${totalMB})`);
        }
        : null;
    
    // Use fetchWithProgress if available, otherwise fallback to regular fetch
    const fetchPromise = (typeof fetchWithProgress === 'function')
        ? fetchWithProgress(tiffPath, progressCallback)
        : fetch(tiffPath).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
        });
    
    fetchPromise
        .then(b => {
            if (progressText && typeof formatBytes === 'function') {
                progressText.text('Processing TIFF file...');
            }
            return GeoTIFF.fromArrayBuffer(b);
        })
        .then(t => t.getImage())
        .then(image => {
            if (progressText && typeof formatBytes === 'function') {
                progressText.text('Reading raster data...');
            }
            return image.readRasters().then(rasters => ({
                data: rasters[0],
                width: image.getWidth(),
                height: image.getHeight()
            }));
        })
        .then(({ data, width, height }) => {
            if (progressText && typeof formatBytes === 'function') {
                progressText.text('Rendering visualization...');
            }

            /* -----------------------------
               DISPLAY & DOWNSAMPLING
            ------------------------------*/
            const margin = { top: 0, right: 0, bottom: 120, left: 0 };

            // Use full container width for larger visualization
            const containerWidth = container.node().getBoundingClientRect().width;
            const displayWidth = containerWidth > 0 ? containerWidth : Math.min(1600, window.innerWidth - 100);

            const sampleFactor = Math.max(
                1,
                Math.ceil(Math.sqrt((width * height) / (displayWidth * displayWidth * 4)))
            );

            const rasterWidth = Math.floor(width / sampleFactor);
            const rasterHeight = Math.floor(height / sampleFactor);
            const aspect = rasterHeight / rasterWidth;
            const displayHeight = displayWidth * aspect;

            const svg = container.append('svg')
                .attr('width', displayWidth + margin.left + margin.right)
                .attr('height', displayHeight + margin.top + margin.bottom)
                .attr('viewBox', `0 0 ${displayWidth + margin.left + margin.right} ${displayHeight + margin.top + margin.bottom}`)
                .style('overflow', 'hidden')
                .style('width', '100%')
                .style('height', 'auto')
                .style('display', 'block');
            
            const svgGroup = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            /* -----------------------------
               COLOR SCALES
            ------------------------------*/

            // Sequential green scale (increased luminance contrast)
            const vegInterpolator = d3.interpolateRgbBasis([
                '#edf8e9',
                '#bae4b3',
                '#74c476',
                '#238b45',
                '#005a32'
            ]);

            const vegColorScale = d3.scaleSequential(vegInterpolator)
                .domain([0, 1])
                .clamp(true);

            // Quiet cool neutral for NDVI < 0
            const neutralColor = { r: 200, g: 210, b: 220, a: 255 };

            /* -----------------------------
               CANVAS RENDERING (chunked)
            ------------------------------*/
            const canvas = document.createElement('canvas');
            canvas.width = rasterWidth;
            canvas.height = rasterHeight;

            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(rasterWidth, rasterHeight);

            const gamma = 0.85;

            // Process in chunks to avoid blocking
            let currentY = 0;
            const chunkSize = 20; // Increased from 10 to 20 for faster processing

            function processChunk() {
                const endY = Math.min(currentY + chunkSize, rasterHeight);

                for (let y = currentY; y < endY; y++) {
                    for (let x = 0; x < rasterWidth; x++) {

                        const sx0 = x * sampleFactor;
                        const sy0 = y * sampleFactor;
                        const sx1 = Math.min(sx0 + sampleFactor, width);
                        const sy1 = Math.min(sy0 + sampleFactor, height);

                        let sum = 0;
                        let count = 0;

                        for (let sy = sy0; sy < sy1; sy++) {
                            for (let sx = sx0; sx < sx1; sx++) {
                                const v = data[sy * width + sx];
                                if (Number.isFinite(v)) {
                                    sum += v;
                                    count++;
                                }
                            }
                        }

                        let r = 0, g = 0, b = 0, a = 0;

                        if (count > 0) {
                            const avg = sum / count;

                            if (avg < 0) {
                                ({ r, g, b, a } = neutralColor);
                            } else {
                                const v = Math.min(1, Math.max(0.05, Math.pow(avg, gamma)));
                                const c = d3.rgb(vegColorScale(v));
                                r = c.r; g = c.g; b = c.b; a = 255;
                            }
                        }

                        const i = (y * rasterWidth + x) * 4;
                        imageData.data[i]     = r;
                        imageData.data[i + 1] = g;
                        imageData.data[i + 2] = b;
                        imageData.data[i + 3] = a;
                    }
                }

                currentY = endY;

                if (currentY < rasterHeight) {
                    // Use requestIdleCallback when available for better performance, otherwise use setTimeout
                    if (window.requestIdleCallback) {
                        requestIdleCallback(processChunk, { timeout: 100 });
                    } else {
                        setTimeout(processChunk, 0);
                    }
                } else {
                    ctx.putImageData(imageData, 0, 0);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    const imageUrl = canvas.toDataURL();
                    
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
                    
                    // Function to determine land type from NDVI value
                    function getLandType(ndvi) {
                        if (ndvi < 0) return 'Non-vegetated';
                        if (ndvi > 0 && ndvi <= 0.2) return 'Bare/nearly bare soil';
                        if (ndvi > 0.2 && ndvi <= 0.4) return 'Sparse vegetation';
                        if (ndvi > 0.4 && ndvi <= 0.6) return 'Moderate vegetation';
                        if (ndvi > 0.6 && ndvi <= 0.8) return 'Dense vegetation';
                        if (ndvi > 0.8) return 'Very dense vegetation';
                    }
                    
                    // Create tooltip for hover values - fixed position in top-right (container already has position: relative)
                    const tooltip = container.append('div')
                        .attr('class', 'ndvi-tooltip')
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
                        .style('min-width', '160px')
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
                    
                    // Add hover tooltip with NDVI values
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
                                // Get NDVI value from original data
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
                                            if (Number.isFinite(value)) {
                                                sum += value;
                                                count++;
                                            }
                                        }
                                    }
                                }
                                
                                if (count > 0) {
                                    const avgValue = sum / count;
                                    const landType = getLandType(avgValue);
                                    
                                    // Determine color for display
                                    let displayColor = '#c8d2d8'; // neutral color
                                    if (avgValue >= 0) {
                                        const v = Math.min(1, Math.max(0.05, Math.pow(avgValue, gamma)));
                                        displayColor = vegColorScale(v);
                                    }
                                    
                                    // Update tooltip - fixed position in top-right corner (using right/top CSS)
                                    tooltip
                                        .html(`
                                            <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px; opacity: 0.9;">NDVI</div>
                                            <div style="font-size: 24px; font-weight: 700; color: ${displayColor}; line-height: 1.2; margin-bottom: 6px;">
                                                ${avgValue.toFixed(3)}
                                            </div>
                                            <div style="font-size: 11px; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 6px; margin-top: 6px;">
                                                ${landType}
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

                    addLegend();
                    loadingMsg.remove();
                }
            }

            // Start processing with small delay
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    // Use requestIdleCallback when available for better performance, otherwise use setTimeout
                    if (window.requestIdleCallback) {
                        requestIdleCallback(processChunk, { timeout: 100 });
                    } else {
                        setTimeout(processChunk, 0);
                    }
                }, { timeout: 100 });
            } else {
                setTimeout(() => {
                    // Use requestIdleCallback when available for better performance, otherwise use setTimeout
                    if (window.requestIdleCallback) {
                        requestIdleCallback(processChunk, { timeout: 100 });
                    } else {
                        setTimeout(processChunk, 0);
                    }
                }, 0);
            }

            /* -----------------------------
               LEGEND
            ------------------------------*/
            function addLegend() {
                const legendWidth = 320;
                const legendHeight = 22;

                const legend = svgGroup.append('g')
                    .attr('transform', `translate(${(displayWidth - legendWidth) / 2}, ${displayHeight + 45})`);

                const defs = svgGroup.append('defs');
                const grad = defs.append('linearGradient')
                    .attr('id', 'ndvi-veg-gradient')
                    .attr('x1', '0%')
                    .attr('x2', '100%');

                for (let i = 0; i <= 30; i++) {
                    const t = i / 30;
                    grad.append('stop')
                        .attr('offset', `${t * 100}%`)
                        .attr('stop-color', vegColorScale(t));
                }

                legend.append('rect')
                    .attr('width', legendWidth)
                    .attr('height', legendHeight)
                    .attr('fill', 'url(#ndvi-veg-gradient)')
                    .attr('stroke', '#4a5568');

                [0, 0.25, 0.5, 0.75, 1].forEach((v, i, arr) => {
                    const x = (i / (arr.length - 1)) * legendWidth;
                    legend.append('text')
                        .attr('x', x)
                        .attr('y', legendHeight + 16)
                        .attr('text-anchor', 'middle')
                        .style('font-size', '11px')
                        .text(v.toFixed(2));
                });

                legend.append('text')
                    .attr('x', legendWidth / 2)
                    .attr('y', -10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '13px')
                    .style('font-weight', '500')
                    .text('Vegetation Density (NDVI 0–1)');

                legend.append('rect')
                    .attr('x', 0)
                    .attr('y', legendHeight + 28)
                    .attr('width', 20)
                    .attr('height', 12)
                    .attr('fill', 'rgb(200,210,220)')
                    .attr('stroke', '#4a5568');

                legend.append('text')
                    .attr('x', 26)
                    .attr('y', legendHeight + 38)
                    .style('font-size', '11px')
                    .text('NDVI < 0 (non-vegetated surfaces)');
            }
        })
        .catch(err => {
            console.error(err);
            loadingMsg.html('<p style="color:#e53e3e;">Failed to load NDVI data</p>');
        });
}
