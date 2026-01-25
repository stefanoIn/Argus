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

// Track if initialization has been attempted
let landCoverInitialized = false;

function initializeGenoaUhiScrolly() {
    const container = d3.select('#viz-genoa-uhi-scrolly');
    if (container.empty()) {
        if (!landCoverInitialized) {
            setTimeout(initializeGenoaUhiScrolly, 500);
        }
        return;
    }
    
    if (landCoverInitialized) return;
    landCoverInitialized = true;
    
    // Clear any existing content
    container.selectAll('*').remove();

    // Set container positioning FIRST to prevent layout shifts
    container.style('position', 'relative')
        .style('min-height', '500px')
        .style('width', '100%')
        .style('display', 'block');

    // Check if GeoTIFF is available
    if (typeof GeoTIFF === 'undefined') {
        console.error('[Land Cover] GeoTIFF library not loaded');
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
    
    const statusText = loadingMsg.append('p')
        .text('Loading Genoa land-cover and temperature data...')
        .style('font-size', '16px')
        .style('margin', '0 0 10px 0');
    
    const progressText = loadingMsg.append('p')
        .text('')
        .style('font-size', '13px')
        .style('margin', '0')
        .style('color', '#718096');

    // INFERNO colormap: perceptually uniform, colorblind-friendly
    // Goes from black (cool) → purple → red → orange → yellow (hot)
    const heatScale = d3.scaleSequential(d3.interpolateInferno)
        .domain([0, 1])
        .clamp(true);

    // WorldCover class colors for step 0 (brighter, less muted)
    const wcColors = {
        1: { r: 100, g: 150, b: 100, a: 255 },  // Vegetation (green) - full opacity
        2: { r: 140, g: 180, b: 140, a: 255 },  // Low vegetation (greenish) - full opacity
        3: { r: 80, g: 80, b: 80, a: 255 },     // Built-up (dark gray) - full opacity
        4: { r: 180, g: 120, b: 100, a: 255 },  // Bare Soil (brown) - full opacity
        5: { r: 120, g: 160, b: 200, a: 255 }   // Water (blue) - full opacity
    };

    // Track download progress for both files
    let totalDownloaded = 0;
    let totalSize = 0;
    const fileSizes = {};
    
    function loadTiff(path, fileName) {
        // Create progress callback for this specific file
        const progressCallback = (typeof fetchWithProgress === 'function' && typeof formatBytes === 'function')
            ? (received, total) => {
                fileSizes[path] = { received, total };
                totalSize = Object.values(fileSizes).reduce((sum, f) => sum + (f.total || 0), 0);
                totalDownloaded = Object.values(fileSizes).reduce((sum, f) => sum + (f.received || 0), 0);
                
                if (totalSize > 0) {
                    const percent = Math.round((totalDownloaded / totalSize) * 100);
                    const downloadedMB = formatBytes(totalDownloaded);
                    const totalMB = formatBytes(totalSize);
                    progressText.text(`Downloading... ${percent}% (${downloadedMB} / ${totalMB})`);
                }
            }
            : null;
        
        // Use fetchWithProgress if available, otherwise fallback to regular fetch
        const fetchPromise = (typeof fetchWithProgress === 'function')
            ? fetchWithProgress(path, progressCallback)
            : fetch(path).then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
                return response.arrayBuffer();
            });
        
        return fetchPromise
            .then(arrayBuffer => {
                if (progressText && typeof formatBytes === 'function') {
                    progressText.text(`Processing ${fileName}...`);
                }
                return GeoTIFF.fromArrayBuffer(arrayBuffer);
            })
            .then(tiff => tiff.getImage())
            .then(image => {
                const pixelScale = image.getFileDirectory().ModelPixelScale;
                const resolution = pixelScale ? pixelScale[0] : 10;
                
                if (progressText && typeof formatBytes === 'function') {
                    progressText.text(`Reading ${fileName} raster data...`);
                }
                
                return image.readRasters().then(rasters => ({
                    data: rasters[0],
                    width: image.getWidth(),
                    height: image.getHeight()
                }));
            })
            .catch(error => {
                console.error(`[Land Cover] Error loading ${path}:`, error);
                throw error;
            });
    }

    // Load both TIFF files in parallel (WorldCover now matches LST dimensions)
    Promise.all([
        loadTiff(lstPath, 'temperature data'),
        loadTiff(wcPath, 'land cover data')
    ])
        .then(([lstData, wcData]) => {
            if (progressText && typeof formatBytes === 'function') {
                progressText.text('Rendering visualization...');
            }
            const lstValues = lstData.data;
            const wcValues = wcData.data;
            const width = lstData.width;
            const height = lstData.height;
            
            // Verify dimensions match
            if (wcData.width !== width || wcData.height !== height) {
                throw new Error(`Dimension mismatch: LST(${width}x${height}) vs WC(${wcData.width}x${wcData.height})`);
            }
            
            // WorldCover now matches LST dimensions - no resampling needed

            // Calculate display dimensions with fallback
            const containerNode = container.node();
            if (!containerNode) {
                throw new Error('Container node lost during loading');
            }
            const containerWidth = containerNode.getBoundingClientRect().width;
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

            // Create main layout wrapper
            const mainWrapper = container.append('div')
                .attr('class', 'landcover-main-wrapper')
                .style('width', '100%')
                .style('display', 'flex')
                .style('flex-direction', 'column')
                .style('gap', '16px');
            
            // Create legend section above everything
            const legendSection = mainWrapper.append('div')
                .attr('class', 'dashboard-legend-section')
                .style('background', 'var(--bg-card)')
                .style('border', '1px solid var(--border-light)')
                .style('border-radius', '8px')
                .style('padding', '12px 16px')
                .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)');
            
            // Legend title
            legendSection.append('div')
                .style('font-size', '12px')
                .style('font-weight', '600')
                .style('color', 'var(--text-primary)')
                .style('margin-bottom', '10px')
                .style('text-transform', 'uppercase')
                .style('letter-spacing', '0.5px')
                .text('Land Cover Classes');
            
            // Legend items - horizontal layout (names match bar chart)
            const landCoverClasses = [
                { id: 1, name: 'Dense Vegetation', color: 'rgb(100, 150, 100)' },
                { id: 2, name: 'Sparse Vegetation', color: 'rgb(140, 180, 140)' },
                { id: 4, name: 'Bare Soil', color: 'rgb(180, 120, 100)' },
                { id: 3, name: 'Built-up', color: 'rgb(80, 80, 80)' }
            ];
            
            const legendItemsContainer = legendSection.append('div')
                .style('display', 'flex')
                .style('flex-wrap', 'wrap')
                .style('gap', '20px')
                .style('justify-content', 'center');
            
            landCoverClasses.forEach(cls => {
                const legendItem = legendItemsContainer.append('div')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('gap', '6px')
                    .style('font-size', '12px')
                    .style('color', 'var(--text-primary)');
                
                legendItem.append('div')
                    .style('width', '16px')
                    .style('height', '16px')
                    .style('background', cls.color)
                    .style('border-radius', '3px')
                    .style('border', '1px solid var(--border-medium)')
                    .style('flex-shrink', '0')
                    .style('box-shadow', '0 1px 2px rgba(0,0,0,0.1)');
                
                legendItem.append('span')
                    .style('font-weight', '500')
                    .text(cls.name);
            });
            
            // Create dashboard-style layout wrapper for map and stats
            const dashboardWrapper = mainWrapper.append('div')
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
                .style('flex', '1 1 65%')
                .style('min-width', '500px')
                .style('aspect-ratio', `${displayWidth} / ${displayHeight}`)
                .style('max-width', '100%')
                .style('background', '#e8e8e8')
                .style('border-radius', '8px')
                .style('overflow', 'hidden')
                .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');
            
            // Create dashboard panel (stats only - controls will be below)
            const dashboardPanel = dashboardWrapper.append('div')
                .attr('class', 'landcover-dashboard-panel')
                .style('flex', '0 0 300px')
                .style('min-width', '250px')
                .style('max-width', '100%')
                .style('display', 'flex')
                .style('flex-direction', 'column')
                .style('gap', '16px');

            // Create canvas layers (all in same container, stacked)
            const step0Canvas = createStepCanvasForMap(mapContainer, 'step-0', 'WorldCover context', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step1Canvas = createStepCanvasForMap(mapContainer, 'step-1', 'Vegetation heat', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step2Canvas = createStepCanvasForMap(mapContainer, 'step-2', 'Urban heat', rasterWidth, rasterHeight, displayWidth, displayHeight);
            
            // Create WorldCover background for step 1 and 2
            const wcBackground1 = createStepCanvasForMap(mapContainer, 'wc-background-1', 'WorldCover background', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const wcBackground2 = createStepCanvasForMap(mapContainer, 'wc-background-2', 'WorldCover background', rasterWidth, rasterHeight, displayWidth, displayHeight);

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

                    loadingMsg.remove();
                    
                    // Small delay to ensure DOM is ready, then initialize
                    setTimeout(() => {
                        console.log('[Land Cover] Finalizing setup...');
                        try {
                            finalizeSetup({ 
                            mapContainer,
                            wcBackground1,
                            wcBackground2,
                            step0Canvas, 
                            step1Canvas, 
                            step2Canvas,
                            p1Val,
                            p99Val,
                            dashboardPanel,
                            minVal,
                            maxVal,
                            heatScale,
                            mainWrapper
                        });
                        } catch (finalizeError) {
                            console.error('[Land Cover] Error in finalizeSetup:', finalizeError);
                            console.error('[Land Cover] Stack:', finalizeError.stack);
                        }
                    }, 100);
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
            console.error('[Land Cover] Critical error:', error);
            console.error('[Land Cover] Stack trace:', error.stack);
            loadingMsg.html(`
                <p style="color:#e53e3e;margin-bottom:10px;font-weight:600;">Failed to load visualization</p>
                <p style="color:#718096;font-size:14px;margin-bottom:8px;">${error.message}</p>
                <p style="color:#718096;font-size:12px;margin-top:10px;">
                    Check paths: ${lstPath}, ${wcPath}
                </p>
                <button onclick="initializeGenoaUhiScrolly()" style="margin-top:15px;padding:8px 16px;background:var(--primary-color);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">
                    Retry
                </button>
            `);
        });

    function finalizeSetup({ mapContainer, wcBackground1, wcBackground2, step0Canvas, step1Canvas, step2Canvas, p1Val, p99Val, minVal, maxVal, heatScale, dashboardPanel, mainWrapper }) {
        
        // Validate all required parameters
        if (!step0Canvas || !step1Canvas || !step2Canvas) {
            throw new Error('Missing canvas objects');
        }
        if (!dashboardPanel || !mainWrapper) {
            throw new Error('Missing DOM elements');
        }
        
        // Set z-index for proper layering
        step0Canvas.canvas.style.zIndex = '1';
        wcBackground1.canvas.style.zIndex = '2';
        step1Canvas.canvas.style.zIndex = '3';
        wcBackground2.canvas.style.zIndex = '4';
        step2Canvas.canvas.style.zIndex = '5';
        
        
        // IMPORTANT:
        // Bar chart values come exclusively from Python-precomputed JSON.
        // No temperature statistics are computed in JavaScript.
        const canvasRefs = { step0Canvas, step1Canvas, step2Canvas, wcBackground1, wcBackground2 };
        
        fetch('data/json/bar_landcover_temp.json')
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load bar chart data: ${response.status}`);
                return response.json();
            })
            .then(barData => {
                createDashboardControls(barData, canvasRefs, dashboardPanel);
            })
            .catch(error => {
                console.error('[Land Cover] Error loading temperature data:', error);
                dashboardPanel.append('div')
                    .style('padding', '20px')
                    .style('text-align', 'center')
                    .style('color', '#e53e3e')
                    .style('background', '#fff5f5')
                    .style('border', '1px solid #feb2b2')
                    .style('border-radius', '8px')
                    .html(`
                        <p style="margin-bottom: 8px; font-weight: 600;">Unable to load temperature data</p>
                        <p style="font-size: 13px; opacity: 0.9;">${error.message}</p>
                    `);
            });
    }
    
    function createDashboardControls(barData, canvases, panel) {
        const { step0Canvas, step1Canvas, step2Canvas, wcBackground1, wcBackground2 } = canvases;
        const dashboardPanel = panel;
        const mainWrapper = d3.select('.landcover-main-wrapper');
        
        // Create controls section below map in mainWrapper
        console.log('[Land Cover] Creating layer controls...');
        const controlsSection = mainWrapper.append('div')
            .attr('class', 'dashboard-controls-section-horizontal')
            .style('background', 'var(--bg-card)')
            .style('border', '1px solid var(--border-light)')
            .style('border-radius', '8px')
            .style('padding', '12px 16px')
            .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)')
            .style('width', '100%')
            .style('margin-top', '16px');
        
        // Controls title
        controlsSection.append('div')
            .style('font-size', '13px')
            .style('font-weight', '700')
            .style('color', 'var(--text-primary)')
            .style('margin-bottom', '16px')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '1px')
            .style('text-align', 'center')
            .text('View Selection');
        
        // Layer controls container - horizontal
        const layerControlsContainer = controlsSection.append('div')
            .style('display', 'flex')
            .style('flex-wrap', 'wrap')
            .style('gap', '12px')
            .style('justify-content', 'center')
            .style('align-items', 'center');
        
        // Create radio buttons for exclusive layer selection (3 layers total)
        const layers = [
            { id: 'layer0', label: 'Land Cover Only', canvases: [step0Canvas], backgrounds: [], opacity: 1.0 },
            { id: 'layer1', label: 'Vegetation Heat', canvases: [step1Canvas], backgrounds: [wcBackground1], opacity: 1.0 },
            { id: 'layer2', label: 'Urban Heat', canvases: [step2Canvas], backgrounds: [wcBackground2], opacity: 1.0 }
        ];
        
        console.log('[Land Cover] Creating', layers.length, 'layer controls');
        
        layers.forEach((layer, index) => {
            const layerControl = layerControlsContainer.append('label')
                .style('display', 'inline-flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('gap', '8px')
                .style('cursor', 'pointer')
                .style('font-size', '14px')
                .style('font-weight', '600')
                .style('color', index === 0 ? '#fff' : 'var(--text-secondary)')
                .style('padding', '12px 24px')
                .style('border-radius', '8px')
                .style('border', '2px solid ' + (index === 0 ? 'var(--primary-color)' : 'var(--border-light)'))
                .style('transition', 'all 0.3s ease')
                .style('background', index === 0 ? 'var(--primary-color)' : 'white')
                .style('box-shadow', index === 0 ? '0 4px 12px rgba(232, 93, 4, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)')
                .style('min-width', '140px')
                .style('text-align', 'center')
                .style('user-select', 'none')
                .on('mouseenter', function() {
                    const isChecked = d3.select(this).select('input').property('checked');
                    if (!isChecked) {
                        d3.select(this)
                            .style('background', 'rgba(232, 93, 4, 0.05)')
                            .style('border-color', 'var(--primary-color)')
                            .style('color', 'var(--primary-color)')
                            .style('transform', 'translateY(-2px)')
                            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)');
                    }
                })
                .on('mouseleave', function() {
                    const isChecked = d3.select(this).select('input').property('checked');
                    if (!isChecked) {
                        d3.select(this)
                            .style('background', 'white')
                            .style('border-color', 'var(--border-light)')
                            .style('color', 'var(--text-secondary)')
                            .style('transform', 'translateY(0)')
                            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.05)');
                    }
                });
            
            const radio = layerControl.append('input')
                .attr('type', 'radio')
                .attr('name', 'layer-select')
                .attr('id', layer.id)
                .attr('checked', index === 0 ? true : null)
                .style('display', 'none')
                .on('change', function() {
                    // Update all label styles
                    layerControlsContainer.selectAll('label')
                        .style('background', 'white')
                        .style('border-color', 'var(--border-light)')
                        .style('color', 'var(--text-secondary)')
                        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.05)');
                    
                    // Style active button
                    d3.select(this.parentNode)
                        .style('background', 'var(--primary-color)')
                        .style('border-color', 'var(--primary-color)')
                        .style('color', '#fff')
                        .style('box-shadow', '0 4px 12px rgba(232, 93, 4, 0.3)');
                    
                    // Hide all layers
                    step0Canvas.canvas.style.opacity = '0';
                    step1Canvas.canvas.style.opacity = '0';
                    step2Canvas.canvas.style.opacity = '0';
                    wcBackground1.canvas.style.opacity = '0';
                    wcBackground2.canvas.style.opacity = '0';
                    
                    // Show selected layer with appropriate opacity
                    if (layer.id === 'layer0') {
                        // Land cover only - less transparent (more opaque)
                        layer.canvases.forEach(c => c.canvas.style.opacity = '1.0');
                    } else {
                        // Heat layers - show with background
                        layer.canvases.forEach(c => c.canvas.style.opacity = '1.0');
                        layer.backgrounds.forEach(bg => bg.canvas.style.opacity = '0.3');
                    }
                    
                    updateStatsDisplay();
                });
            
            layerControl.append('span')
                .text(layer.label);
        });
        
        // Create temperature comparison chart section
        const statsSection = dashboardPanel.append('div')
            .attr('class', 'dashboard-stats-section')
            .style('background', 'var(--bg-card)')
            .style('border', '1px solid var(--border-light)')
            .style('border-radius', '8px')
            .style('padding', '4px')
            .style('box-shadow', '0 1px 3px rgba(0,0,0,0.1)');
        
        // Stats title (centered)
        statsSection.append('div')
            .style('font-size', '13px')
            .style('font-weight', '600')
            .style('color', 'var(--text-primary)')
            .style('margin-bottom', '16px')
            .style('text-transform', 'uppercase')
            .style('letter-spacing', '0.5px')
            .style('text-align', 'center')
            .text('Temperature Comparison');
        
        // Create proper bar chart with axes
        const chartWidth = 280;
        const chartHeight = 200;
        const chartMargin = { top: 10, right: 20, bottom: 30, left: 90 };
        const plotWidth = chartWidth - chartMargin.left - chartMargin.right;
        const plotHeight = chartHeight - chartMargin.top - chartMargin.bottom;
        
        const chartSvg = statsSection.append('svg')
            .attr('width', chartWidth)
            .attr('height', chartHeight)
            .style('overflow', 'visible')
            .style('display', 'block')
            .style('margin', '0 auto');
        
        const chartG = chartSvg.append('g')
            .attr('transform', `translate(${chartMargin.left},${chartMargin.top})`);
        
        // Data for chart from JSON - reorder to match legend
        const orderMap = {
            'Dense Vegetation': 0,
            'Sparse Vegetation': 1,
            'Bare Soil': 2,
            'Built-up': 3
        };
        
        // Match bar colors exactly to legend colors
        const colorMap = {
            'Dense Vegetation': 'rgb(100, 150, 100)',
            'Sparse Vegetation': 'rgb(140, 180, 140)',
            'Bare Soil': 'rgb(180, 120, 100)',
            'Built-up': 'rgb(80, 80, 80)'
        };
        
        const chartData = barData
            .sort((a, b) => orderMap[a.land_cover] - orderMap[b.land_cover])
            .map(d => ({
                type: d.land_cover,
                temp: d.mean_temperature,
                color: colorMap[d.land_cover] || '#999999'
            }));
        
        
        // Scales
        const maxTemp = Math.max(...barData.map(d => d.mean_temperature));
        const xScale = d3.scaleLinear()
            .domain([0, Math.ceil(maxTemp / 10) * 10]) // Round up to nearest 10
            .range([0, plotWidth]);
        
        const yScale = d3.scaleBand()
            .domain(chartData.map(d => d.type))
            .range([0, plotHeight])
            .padding(0.3);
        
        // Add X axis without tick labels
        const xAxis = d3.axisBottom(xScale)
            .ticks(4)
            .tickFormat(() => ''); // Remove individual labels
        
        chartG.append('g')
            .attr('transform', `translate(0,${plotHeight})`)
            .call(xAxis)
            .style('color', 'var(--text-secondary)');
        
        // Add single axis label "LST (°C)"
        chartG.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', plotHeight + 25)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '11px')
            .style('font-weight', '500')
            .text('LST (°C)');
        
        chartG.selectAll('.domain, .tick line')
            .style('stroke', 'var(--border-medium)');
        
        // Add Y axis - no truncation needed with larger left margin
        const yAxis = d3.axisLeft(yScale);
        
        chartG.append('g')
            .call(yAxis)
            .style('color', 'var(--text-secondary)')
            .style('font-size', '10px')
            .selectAll('text')
            .style('fill', 'var(--text-secondary)')
            .style('font-weight', '500');
        
        chartG.selectAll('.domain')
            .style('stroke', 'var(--border-medium)');
        
        chartG.selectAll('.tick line')
            .remove();
        
        // Add bars
        chartG.selectAll('.bar')
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', d => yScale(d.type))
            .attr('width', d => xScale(d.temp))
            .attr('height', yScale.bandwidth())
            .attr('fill', d => d.color)
            .attr('rx', 3)
            .style('opacity', 0.9);
        
        // Add value labels on bars
        chartG.selectAll('.bar-label')
            .data(chartData)
            .enter()
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', d => xScale(d.temp) + 5)
            .attr('y', d => yScale(d.type) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .style('font-size', '10px')
            .style('font-weight', '600')
            .style('fill', 'var(--text-primary)')
            .text(d => `${d.temp.toFixed(1)}°C`);
        
        function updateStatsDisplay() {
            // Chart is static, no updates needed
        }
        
        // Initialize: show layer 0 (land cover context) by default with full opacity
        step0Canvas.canvas.style.opacity = '1.0';
        step1Canvas.canvas.style.opacity = '0';
        step2Canvas.canvas.style.opacity = '0';
        wcBackground1.canvas.style.opacity = '0';
        wcBackground2.canvas.style.opacity = '0';
    } // End of createDashboardControls
} // End of initializeGenoaUhiScrolly

