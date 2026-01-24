/**
 * viz-genoa-uhi-scrolly.js
 * Side-by-side comparison: Land Cover Context | Vegetation Heat | Urban Heat
 * 
 * Shows three views simultaneously for direct comparison:
 * - Left: WorldCover semantic map (muted/desaturated) for spatial context
 * - Middle: LST masked by vegetation (WorldCover classes 1, 2)
 * - Right: LST masked by built-up (WorldCover class 3)
 * 
 * Masking happens at render time using Canvas compositing.
 * WorldCover classes: 1=vegetation, 2=low_veg, 3=built, 4=bare, 5=water
 * 
 * Loads TIFF files directly with optimized chunked processing for performance.
 */
function initializeGenoaUhiScrolly() {
    const container = d3.select('#viz-genoa-uhi-scrolly');
    if (container.empty()) return;
    container.selectAll('*').remove();

    // Set container positioning FIRST to prevent layout shifts
    // Use a fixed min-height that matches the tile-map's expected height
    container.style('position', 'relative')
        .style('min-height', '500px')
        .style('width', '100%')
        .style('display', 'block');

    // Check if GeoTIFF is available
    if (typeof GeoTIFF === 'undefined') {
        container.html('<p style="color: #e53e3e; padding: 20px;">GeoTIFF library not loaded. Please check the script includes.</p>');
        return;
    }

    const lstPath = 'data/processed/LST_10m_XGB_2025-07-09_Genoa.tif';
    const wcPath = 'data/processed/WorldCover_Genova_2021_semantic.tif';

    // Create loading message - properly centered with absolute positioning to prevent layout shifts
    const loadingMsg = container.append('div')
        .style('position', 'absolute')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translate(-50%, -50%)')
        .style('text-align', 'center')
        .style('padding', '20px')
        .style('color', '#4a5568')
        .style('z-index', '1000')
        .style('pointer-events', 'none')
        .style('white-space', 'nowrap');
    
    loadingMsg.append('p')
        .text('Loading Genoa land-cover and temperature data...')
        .style('font-size', '16px')
        .style('margin', '0');

    // INFERNO colormap: perceptually uniform, colorblind-friendly
    // Goes from black (cool) → purple → red → orange → yellow (hot)
    const heatScale = d3.scaleSequential(d3.interpolateInferno)
        .domain([0, 1])
        .clamp(true);

    // WorldCover class colors (for step 0 context view - muted/desaturated)
    const wcColors = {
        1: { r: 100, g: 150, b: 100, a: 180 },  // Vegetation (muted green)
        2: { r: 140, g: 180, b: 140, a: 180 },  // Low vegetation (lighter green)
        3: { r: 180, g: 120, b: 100, a: 180 },  // Built-up (muted brown/orange)
        4: { r: 200, g: 190, b: 170, a: 180 },  // Bare (muted beige)
        5: { r: 120, g: 160, b: 200, a: 140 }   // Water (muted blue)
    };

    function loadTiff(path) {
        return fetch(path)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => GeoTIFF.fromArrayBuffer(arrayBuffer))
            .then(tiff => tiff.getImage())
            .then(image => {
                return image.readRasters().then(rasters => ({
                    data: rasters[0],
                    width: image.getWidth(),
                    height: image.getHeight(),
                    bbox: image.getBoundingBox()
                }));
            });
    }

    // Function to resample WorldCover data to match LST dimensions using nearest-neighbor
    function resampleWorldCover(wcData, wcWidth, wcHeight, targetWidth, targetHeight) {
        const resampledData = new Float32Array(targetWidth * targetHeight);
        const scaleX = wcWidth / targetWidth;
        const scaleY = wcHeight / targetHeight;
        
        for (let ty = 0; ty < targetHeight; ty++) {
            for (let tx = 0; tx < targetWidth; tx++) {
                // Calculate source coordinates using nearest-neighbor
                const sx = Math.floor(tx * scaleX);
                const sy = Math.floor(ty * scaleY);
                
                // Clamp to source bounds
                const srcX = Math.max(0, Math.min(wcWidth - 1, sx));
                const srcY = Math.max(0, Math.min(wcHeight - 1, sy));
                
                // Get source value
                const srcIdx = srcY * wcWidth + srcX;
                const targetIdx = ty * targetWidth + tx;
                resampledData[targetIdx] = wcData[srcIdx];
            }
        }
        
        return resampledData;
    }

    // Load both TIFF files in parallel
    Promise.all([loadTiff(lstPath), loadTiff(wcPath)])
        .then(([lstData, wcData]) => {
            let { data: lstValues, width: lstWidth, height: lstHeight } = lstData;
            let { data: wcValues, width: wcWidth, height: wcHeight } = wcData;

            // Resample WorldCover to match LST dimensions if they don't match
            if (lstWidth !== wcWidth || lstHeight !== wcHeight) {
                console.log(`Resampling WorldCover from ${wcWidth}x${wcHeight} to match LST ${lstWidth}x${lstHeight}`);
                wcValues = resampleWorldCover(wcValues, wcWidth, wcHeight, lstWidth, lstHeight);
                wcWidth = lstWidth;
                wcHeight = lstHeight;
            }

            const width = lstWidth;
            const height = lstHeight;

            // Calculate display dimensions
            const containerWidth = container.node().getBoundingClientRect().width;
            const displayWidth = containerWidth > 0 ? containerWidth : Math.min(1600, window.innerWidth - 100);
            
            // Compute sample factor for downsampling
            const sampleFactor = Math.max(
                1,
                Math.ceil(Math.sqrt((width * height) / (displayWidth * displayWidth * 4)))
            );
            
            const rasterWidth = Math.floor(width / sampleFactor);
            const rasterHeight = Math.floor(height / sampleFactor);
            const aspect = rasterHeight / rasterWidth;
            const displayHeight = displayWidth * aspect;

            // Calculate statistics and percentiles for LST
            const validLstValues = [];
            for (let i = 0; i < lstValues.length; i++) {
                const val = lstValues[i];
                if (Number.isFinite(val) && val !== null && val !== undefined) {
                    validLstValues.push(val);
                }
            }
            
            if (validLstValues.length === 0) {
                throw new Error('No valid LST data found');
            }

            validLstValues.sort((a, b) => a - b);
            const p1Index = Math.floor(validLstValues.length * 0.01);
            const p99Index = Math.floor(validLstValues.length * 0.99);
            const p1Val = validLstValues[p1Index];
            const p99Val = validLstValues[p99Index];
            const minVal = validLstValues[0];
            const maxVal = validLstValues[validLstValues.length - 1];

            // Create dashboard-style layout wrapper
            const dashboardWrapper = container.append('div')
                .attr('class', 'landcover-dashboard-wrapper')
                .style('display', 'flex')
                .style('gap', '20px')
                .style('width', '100%')
                .style('max-width', '100%')
                .style('flex-wrap', 'wrap');
            
            // Create map container (main visualization area)
            const mapContainer = dashboardWrapper.append('div')
                .attr('class', 'layered-map-container')
                .style('position', 'relative')
                .style('flex', '1 1 70%')
                .style('min-width', '500px')
                .style('aspect-ratio', `${displayWidth} / ${displayHeight}`)
                .style('max-width', '100%')
                .style('background', '#f0f0f0') // Light grey background to prevent white holes
                .style('border-radius', '8px')
                .style('overflow', 'hidden')
                .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');
            
            // Create dashboard panel (legend and controls)
            const dashboardPanel = dashboardWrapper.append('div')
                .attr('class', 'landcover-dashboard-panel')
                .style('flex', '0 0 280px')
                .style('min-width', '250px')
                .style('max-width', '100%')
                .style('display', 'flex')
                .style('flex-direction', 'column')
                .style('gap', '20px');

            // Create canvas layers (all in same container, stacked)
            const step0Canvas = createStepCanvasForMap(mapContainer, 'step-0', 'WorldCover context', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step1Canvas = createStepCanvasForMap(mapContainer, 'step-1', 'Vegetation heat', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step2Canvas = createStepCanvasForMap(mapContainer, 'step-2', 'Urban heat', rasterWidth, rasterHeight, displayWidth, displayHeight);
            
            // Create WorldCover background for step 1 and 2
            const wcBackground1 = createStepCanvasForMap(mapContainer, 'wc-background-1', 'WorldCover background', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const wcBackground2 = createStepCanvasForMap(mapContainer, 'wc-background-2', 'WorldCover background', rasterWidth, rasterHeight, displayWidth, displayHeight);

            // Statistics for temperature averages
            const stats = {
                vegSum: 0,
                vegCount: 0,
                builtSum: 0,
                builtCount: 0
            };

            // Process data in chunks
            let currentY = 0;
            const chunkSize = 15; // Increased from 5 to 15 for faster processing

            function processChunk() {
                const endY = Math.min(currentY + chunkSize, rasterHeight);

                for (let displayY = currentY; displayY < endY; displayY++) {
                    for (let displayX = 0; displayX < rasterWidth; displayX++) {
                        // Calculate source pixel range
                        const srcXStart = displayX * sampleFactor;
                        const srcYStart = displayY * sampleFactor;
                        const srcXEnd = Math.min(srcXStart + sampleFactor, width);
                        const srcYEnd = Math.min(srcYStart + sampleFactor, height);
                        
                        // Average LST and WorldCover values in the sample block
                        let lstSum = 0;
                        let lstCount = 0;
                        const wcCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                        let dominantWcClass = 0;
                        let maxWcCount = 0;

                        for (let srcY = srcYStart; srcY < srcYEnd; srcY++) {
                            for (let srcX = srcXStart; srcX < srcXEnd; srcX++) {
                                const idx = srcY * width + srcX;
                                
                                // Process LST
                                if (idx < lstValues.length) {
                                    const lstVal = lstValues[idx];
                                    if (Number.isFinite(lstVal) && lstVal !== null && lstVal !== undefined) {
                                        lstSum += lstVal;
                                        lstCount++;
                                    }
                                }
                                
                                // Process WorldCover
                                if (idx < wcValues.length) {
                                    const wcVal = Math.round(wcValues[idx]);
                                    if (wcVal >= 1 && wcVal <= 5) {
                                        wcCounts[wcVal] = (wcCounts[wcVal] || 0) + 1;
                                        if (wcCounts[wcVal] > maxWcCount) {
                                            maxWcCount = wcCounts[wcVal];
                                            dominantWcClass = wcVal;
                                        }
                                    }
                                }
                            }
                        }

                        const avgLst = lstCount > 0 ? lstSum / lstCount : null;
                        const displayIdx = (displayY * rasterWidth + displayX) * 4;

                        // WorldCover background (transparent, for steps 1 and 2)
                        // Exclude water (class 5) - leave transparent
                        if (dominantWcClass > 0 && dominantWcClass <= 4) {
                            const wcColor = wcColors[dominantWcClass];
                            wcBackground1.imageData.data[displayIdx] = wcColor.r;
                            wcBackground1.imageData.data[displayIdx + 1] = wcColor.g;
                            wcBackground1.imageData.data[displayIdx + 2] = wcColor.b;
                            wcBackground1.imageData.data[displayIdx + 3] = Math.floor(wcColor.a * 0.4); // 40% opacity
                            
                            wcBackground2.imageData.data[displayIdx] = wcColor.r;
                            wcBackground2.imageData.data[displayIdx + 1] = wcColor.g;
                            wcBackground2.imageData.data[displayIdx + 2] = wcColor.b;
                            wcBackground2.imageData.data[displayIdx + 3] = Math.floor(wcColor.a * 0.4); // 40% opacity
                        }
                        // Water (class 5) and invalid pixels remain transparent

                        // Step 0: WorldCover context (muted/desaturated)
                        // Exclude water (class 5) - leave transparent/background
                        // Fill with background color first to prevent white holes
                        const bgR = 240, bgG = 240, bgB = 240; // Light grey background
                        step0Canvas.imageData.data[displayIdx] = bgR;
                        step0Canvas.imageData.data[displayIdx + 1] = bgG;
                        step0Canvas.imageData.data[displayIdx + 2] = bgB;
                        step0Canvas.imageData.data[displayIdx + 3] = 255;
                        
                        if (dominantWcClass > 0 && dominantWcClass <= 4) {
                            const wcColor = wcColors[dominantWcClass];
                            step0Canvas.imageData.data[displayIdx] = wcColor.r;
                            step0Canvas.imageData.data[displayIdx + 1] = wcColor.g;
                            step0Canvas.imageData.data[displayIdx + 2] = wcColor.b;
                            step0Canvas.imageData.data[displayIdx + 3] = wcColor.a;
                        }
                        // Water (class 5) and invalid pixels show background color (not white)

                        // Step 1: LST masked by vegetation (WorldCover classes 1, 2)
                        if (avgLst !== null && (dominantWcClass === 1 || dominantWcClass === 2)) {
                            const clampedValue = Math.max(p1Val, Math.min(p99Val, avgLst));
                            const t = (clampedValue - p1Val) / (p99Val - p1Val);
                            const color = d3.rgb(heatScale(t));
                            step1Canvas.imageData.data[displayIdx] = color.r;
                            step1Canvas.imageData.data[displayIdx + 1] = color.g;
                            step1Canvas.imageData.data[displayIdx + 2] = color.b;
                            step1Canvas.imageData.data[displayIdx + 3] = 255;

                            // Collect statistics
                            stats.vegSum += avgLst;
                            stats.vegCount++;
                        }

                        // Step 2: LST masked by built-up (WorldCover class 3)
                        if (avgLst !== null && dominantWcClass === 3) {
                            const clampedValue = Math.max(p1Val, Math.min(p99Val, avgLst));
                            const t = (clampedValue - p1Val) / (p99Val - p1Val);
                            const color = d3.rgb(heatScale(t));
                            step2Canvas.imageData.data[displayIdx] = color.r;
                            step2Canvas.imageData.data[displayIdx + 1] = color.g;
                            step2Canvas.imageData.data[displayIdx + 2] = color.b;
                            step2Canvas.imageData.data[displayIdx + 3] = 255;

                            // Collect statistics
                            stats.builtSum += avgLst;
                            stats.builtCount++;
                        }
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
                    // All processing complete, draw to canvases
                    step0Canvas.ctx.putImageData(step0Canvas.imageData, 0, 0);
                    wcBackground1.ctx.putImageData(wcBackground1.imageData, 0, 0);
                    step1Canvas.ctx.putImageData(step1Canvas.imageData, 0, 0);
                    wcBackground2.ctx.putImageData(wcBackground2.imageData, 0, 0);
                    step2Canvas.ctx.putImageData(step2Canvas.imageData, 0, 0);

                    // Calculate statistics
                    const vegAvg = stats.vegCount ? stats.vegSum / stats.vegCount : NaN;
                    const builtAvg = stats.builtCount ? stats.builtSum / stats.builtCount : NaN;

                    loadingMsg.remove();
                    
                    // Small delay to ensure DOM is ready, then initialize
                    setTimeout(() => {
                        finalizeSetup({ 
                            mapContainer,
                            wcBackground1,
                            wcBackground2,
                            step0Canvas, 
                            step1Canvas, 
                            step2Canvas,
                            vegAvg,
                            builtAvg,
                            p1Val,
                            p99Val,
                            dashboardPanel,
                            minVal,
                            maxVal,
                            heatScale
                        });
                    }, 50);
                }
            }

            function createStepCanvasForMap(mapContainer, stepId, label, canvasWidth, canvasHeight, displayW, displayH) {
                const canvas = mapContainer.append('canvas')
                    .attr('class', `layer-canvas`)
                    .attr('data-step', stepId)
                    .attr('width', canvasWidth)
                    .attr('height', canvasHeight)
                    .style('position', 'absolute')
                    .style('top', '0')
                    .style('left', '0')
                    .style('width', '100%')
                    .style('height', '100%')
                    .style('display', 'block')
                    .style('border-radius', '8px')
                    .style('opacity', 0)
                    .style('transition', 'opacity 0.3s ease-in-out')
                    .style('pointer-events', 'none')
                    .node();

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Create image data for this canvas
                const imageData = ctx.createImageData(canvasWidth, canvasHeight);
                
                return { canvas, ctx, imageData };
            }

            // Start processing with small delay
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                    requestAnimationFrame(processChunk);
                }, { timeout: 100 });
            } else {
                setTimeout(() => {
                    requestAnimationFrame(processChunk);
                }, 0);
            }
        })
        .catch(error => {
            console.error('Error loading TIFF files:', error);
            loadingMsg.html(`
                <p style="color:#e53e3e;margin-bottom:10px;">Failed to load TIFF files</p>
                <p style="color:#718096;font-size:14px;">${error.message}</p>
                <p style="color:#718096;font-size:12px;margin-top:10px;">
                    Check paths: ${lstPath}, ${wcPath}
                </p>
            `);
        });

    function finalizeSetup({ mapContainer, wcBackground1, wcBackground2, step0Canvas, step1Canvas, step2Canvas, vegAvg, builtAvg, p1Val, p99Val, minVal, maxVal, heatScale, dashboardPanel }) {
        // Set z-index for proper layering
        step0Canvas.canvas.style.zIndex = '1';
        wcBackground1.canvas.style.zIndex = '2';
        step1Canvas.canvas.style.zIndex = '3';
        wcBackground2.canvas.style.zIndex = '4';
        step2Canvas.canvas.style.zIndex = '5';
        
        // Create legend section in dashboard panel
        const legendSection = dashboardPanel.append('div')
            .attr('class', 'dashboard-legend-section')
            .style('background', 'var(--bg-card)')
            .style('border', '1px solid var(--border-light)')
            .style('border-radius', '8px')
            .style('padding', '16px')
            .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)');
        
        // Legend title
        legendSection.append('div')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .style('color', 'var(--text-primary)')
            .style('margin-bottom', '12px')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.5px')
            .text('Land Cover Classes');
        
        // Land cover class definitions (excluding water)
        const landCoverClasses = [
            { id: 1, name: 'Vegetation (Trees)', color: 'rgb(100, 150, 100)' },
            { id: 2, name: 'Vegetation (Low)', color: 'rgb(140, 180, 140)' },
            { id: 3, name: 'Built-up', color: 'rgb(180, 120, 100)' },
            { id: 4, name: 'Bare Ground', color: 'rgb(200, 190, 170)' }
        ];
        
        const legendItemsContainer = legendSection.append('div')
            .style('display', 'grid')
            .style('grid-template-columns', 'repeat(2, 1fr)')
            .style('gap', '12px');
        
        landCoverClasses.forEach(cls => {
            const legendItem = legendItemsContainer.append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('gap', '8px')
                .style('font-size', '11px')
                .style('color', 'var(--text-primary)')
                .style('padding', '4px 0');
            
            legendItem.append('div')
                .style('width', '20px')
                .style('height', '20px')
                .style('background', cls.color)
                .style('border-radius', '3px')
                .style('border', '1px solid var(--border-medium)')
                .style('flex-shrink', '0')
                .style('box-shadow', '0 1px 2px rgba(0,0,0,0.1)');
            
            legendItem.append('span')
                .style('font-weight', '500')
                .style('line-height', '1.2')
                .text(cls.name);
        });
        
        // Create controls section in dashboard panel
        const controlsSection = dashboardPanel.append('div')
            .attr('class', 'dashboard-controls-section')
            .style('background', 'var(--bg-card)')
            .style('border', '1px solid var(--border-light)')
            .style('border-radius', '8px')
            .style('padding', '16px')
            .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)');
        
        // Controls title
        controlsSection.append('div')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .style('color', 'var(--text-primary)')
            .style('margin-bottom', '12px')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.5px')
            .text('Layer Controls');
        
        // Layer controls container
        const layerControlsContainer = controlsSection.append('div')
            .style('display', 'flex')
            .style('flex-direction', 'column')
            .style('gap', '10px');
        
        // Layer 0: Land Cover Context
        const layer0Control = layerControlsContainer.append('label')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '10px')
            .style('cursor', 'pointer')
            .style('font-size', '12px')
            .style('color', 'var(--text-primary)')
            .style('padding', '8px')
            .style('border-radius', '6px')
            .style('transition', 'background 0.2s ease')
            .on('mouseenter', function() {
                d3.select(this).style('background', 'var(--bg-secondary)');
            })
            .on('mouseleave', function() {
                d3.select(this).style('background', 'transparent');
            });
        
        const layer0Checkbox = layer0Control.append('input')
            .attr('type', 'checkbox')
            .attr('checked', true)
            .style('cursor', 'pointer')
            .style('width', '16px')
            .style('height', '16px')
            .style('accent-color', 'var(--primary-color)')
            .on('change', function() {
                step0Canvas.canvas.style.opacity = this.checked ? '1' : '0';
            });
        
        layer0Control.append('span')
            .style('font-weight', '500')
            .text('Land Cover Context');
        
        // Layer 1: Vegetation Heat
        const layer1Control = layerControlsContainer.append('label')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '10px')
            .style('cursor', 'pointer')
            .style('font-size', '12px')
            .style('color', 'var(--text-primary)')
            .style('padding', '8px')
            .style('border-radius', '6px')
            .style('transition', 'background 0.2s ease')
            .on('mouseenter', function() {
                d3.select(this).style('background', 'var(--bg-secondary)');
            })
            .on('mouseleave', function() {
                d3.select(this).style('background', 'transparent');
            });
        
        const layer1Checkbox = layer1Control.append('input')
            .attr('type', 'checkbox')
            .attr('checked', false)
            .style('cursor', 'pointer')
            .style('width', '16px')
            .style('height', '16px')
            .style('accent-color', 'var(--primary-color)');
        
        layer1Control.append('span')
            .style('font-weight', '500')
            .text('Vegetation Heat');
        
        // Layer 2: Urban Heat
        const layer2Control = layerControlsContainer.append('label')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '10px')
            .style('cursor', 'pointer')
            .style('font-size', '12px')
            .style('color', 'var(--text-primary)')
            .style('padding', '8px')
            .style('border-radius', '6px')
            .style('transition', 'background 0.2s ease')
            .on('mouseenter', function() {
                d3.select(this).style('background', 'var(--bg-secondary)');
            })
            .on('mouseleave', function() {
                d3.select(this).style('background', 'transparent');
            });
        
        const layer2Checkbox = layer2Control.append('input')
            .attr('type', 'checkbox')
            .attr('checked', false)
            .style('cursor', 'pointer')
            .style('width', '16px')
            .style('height', '16px')
            .style('accent-color', 'var(--primary-color)');
        
        layer2Control.append('span')
            .style('font-weight', '500')
            .text('Urban Heat');
        
        // Create statistics section in dashboard panel
        const statsSection = dashboardPanel.append('div')
            .attr('class', 'dashboard-stats-section')
            .style('background', 'var(--bg-card)')
            .style('border', '1px solid var(--border-light)')
            .style('border-radius', '8px')
            .style('padding', '16px')
            .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)');
        
        // Stats title
        statsSection.append('div')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .style('color', 'var(--text-primary)')
            .style('margin-bottom', '12px')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.5px')
            .text('Temperature Statistics');
        
        // Statistics display that updates based on visible layers
        const statsDisplay = statsSection.append('div')
            .attr('class', 'stats-display')
            .style('min-height', '60px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('font-size', '14px')
            .style('color', 'var(--text-secondary)');
        
        function updateStatsDisplay() {
            const layer1Visible = layer1Checkbox.property('checked');
            const layer2Visible = layer2Checkbox.property('checked');
            
            if (layer1Visible && Number.isFinite(vegAvg)) {
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                const textColor = isDarkMode ? '#9ca3af' : '#000000';
                
                statsDisplay
                    .style('display', 'flex')
                    .style('flex-direction', 'column')
                    .style('align-items', 'center')
                    .html(`
                        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Vegetation Average</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${textColor};">
                            ${vegAvg.toFixed(1)}°C
                        </div>
                    `);
            } else if (layer2Visible && Number.isFinite(builtAvg)) {
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                const isLowTemp = builtAvg < (p1Val + (p99Val - p1Val) * 0.3);
                const textColor = (isDarkMode && isLowTemp) ? '#9ca3af' : '#e53e3e';
                
                statsDisplay
                    .style('display', 'flex')
                    .style('flex-direction', 'column')
                    .style('align-items', 'center')
                    .html(`
                        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Urban Average</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${textColor};">
                            ${builtAvg.toFixed(1)}°C
                        </div>
                    `);
            } else {
                statsDisplay
                    .style('display', 'flex')
                    .html('<div style="font-size: 12px; opacity: 0.5; text-align: center;">Enable a layer to view statistics</div>');
            }
        }
        
        // Add event handlers for layer toggles
        layer1Checkbox.on('change', function() {
            const isVisible = this.checked;
            wcBackground1.canvas.style.opacity = isVisible ? '0.4' : '0';
            step1Canvas.canvas.style.opacity = isVisible ? '1' : '0';
            updateStatsDisplay();
        });
        
        layer2Checkbox.on('change', function() {
            const isVisible = this.checked;
            wcBackground2.canvas.style.opacity = isVisible ? '0.4' : '0';
            step2Canvas.canvas.style.opacity = isVisible ? '1' : '0';
            updateStatsDisplay();
        });
        
        // Initialize stats display
        updateStatsDisplay();
        
        
        // Initialize: show layer 0 (land cover context)
        step0Canvas.canvas.style.opacity = '1';
    }
}
