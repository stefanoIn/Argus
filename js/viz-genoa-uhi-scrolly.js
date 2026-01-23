/**
 * viz-genoa-uhi-scrolly.js
 * 3-step semantic visualization: WorldCover context → Vegetation heat → Urban heat
 * 
 * Conceptual approach:
 * - Step 0: WorldCover semantic map (muted/desaturated) for spatial context
 * - Step 1: LST tiles masked by vegetation (WorldCover classes 1, 2)
 * - Step 2: LST tiles masked by built-up (WorldCover class 3)
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
        .style('min-height', '600px')
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

            // Create main canvas container
            const map = container.append('div')
                .attr('class', 'tile-map')
                .style('--map-aspect', displayWidth / displayHeight)
                .style('width', '100%')
                .style('max-width', '100%');

            // Create WorldCover background canvas (for transparent overlay in steps 1 and 2)
            const wcBackgroundCanvas = createStepCanvas('wc-background', 'WorldCover background', rasterWidth, rasterHeight, displayWidth, displayHeight);
            
            // Create three canvas layers for the three semantic steps
            const step0Canvas = createStepCanvas('step-0', 'WorldCover context', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step1Canvas = createStepCanvas('step-1', 'Vegetation heat', rasterWidth, rasterHeight, displayWidth, displayHeight);
            const step2Canvas = createStepCanvas('step-2', 'Urban heat', rasterWidth, rasterHeight, displayWidth, displayHeight);

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
                        if (dominantWcClass > 0 && dominantWcClass <= 5) {
                            const wcColor = wcColors[dominantWcClass];
                            wcBackgroundCanvas.imageData.data[displayIdx] = wcColor.r;
                            wcBackgroundCanvas.imageData.data[displayIdx + 1] = wcColor.g;
                            wcBackgroundCanvas.imageData.data[displayIdx + 2] = wcColor.b;
                            wcBackgroundCanvas.imageData.data[displayIdx + 3] = Math.floor(wcColor.a * 0.4); // 40% opacity
                        }

                        // Step 0: WorldCover context (muted/desaturated)
                        if (dominantWcClass > 0 && dominantWcClass <= 5) {
                            const wcColor = wcColors[dominantWcClass];
                            step0Canvas.imageData.data[displayIdx] = wcColor.r;
                            step0Canvas.imageData.data[displayIdx + 1] = wcColor.g;
                            step0Canvas.imageData.data[displayIdx + 2] = wcColor.b;
                            step0Canvas.imageData.data[displayIdx + 3] = wcColor.a;
                        }

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
                    // Scale canvas context to match display size
                    wcBackgroundCanvas.ctx.putImageData(wcBackgroundCanvas.imageData, 0, 0);
                    step0Canvas.ctx.putImageData(step0Canvas.imageData, 0, 0);
                    step1Canvas.ctx.putImageData(step1Canvas.imageData, 0, 0);
                    step2Canvas.ctx.putImageData(step2Canvas.imageData, 0, 0);
                    
                    // Canvas elements are already styled to fill container via CSS

                    // Calculate statistics
                    const vegAvg = stats.vegCount ? stats.vegSum / stats.vegCount : NaN;
                    const builtAvg = stats.builtCount ? stats.builtSum / stats.builtCount : NaN;

                    loadingMsg.remove();
                    
                    // Small delay to ensure DOM is ready, then initialize
                    setTimeout(() => {
                        finalizeSetup({ 
                            wcBackgroundCanvas, 
                            step0Canvas, 
                            step1Canvas, 
                            step2Canvas,
                            vegAvg,
                            builtAvg,
                            p1Val,
                            p99Val,
                            minVal,
                            maxVal,
                            heatScale
                        });
                    }, 50);
                }
            }

            function createStepCanvas(stepId, label, canvasWidth, canvasHeight, displayW, displayH) {
                const canvas = map.append('canvas')
                    .attr('class', `tile-layer semantic-step`)
                    .attr('data-step', stepId)
                    .attr('width', canvasWidth)
                    .attr('height', canvasHeight)
                    .style('position', 'absolute')
                    .style('top', '0')
                    .style('left', '0')
                    .style('width', '100%')
                    .style('height', '100%')
                    .style('max-width', '100%')
                    .style('max-height', '100%')
                    .style('object-fit', 'contain')
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

    function finalizeSetup({ wcBackgroundCanvas, step0Canvas, step1Canvas, step2Canvas, vegAvg, builtAvg, p1Val, p99Val, minVal, maxVal, heatScale }) {
        let activeStep = -1; // Initialize to -1 so first call always executes

        // Create tooltip for average temperature in top-right corner
        const tooltip = container.append('div')
            .attr('class', 'semantic-tooltip')
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
            .style('z-index', '100')
            .style('box-shadow', 'var(--shadow-lg)')
            .style('border', '1px solid var(--border-medium)')
            .style('min-width', '160px')
            .style('text-align', 'center')
            .style('right', '20px')
            .style('top', '20px')
            .style('max-width', 'calc(100% - 40px)');

        function updateSliderLabels(stepIndex) {
            const labels = document.querySelectorAll('.slider-label-item');
            labels.forEach((label, index) => {
                if (index === stepIndex) {
                    label.classList.add('active');
                } else {
                    label.classList.remove('active');
                }
            });
        }

        function updateTooltip(stepIndex) {
            tooltip.selectAll('*').remove();
            
            if (stepIndex === 0) {
                // Step 0: Land cover - no temperature average
                tooltip.style('opacity', 0);
            } else if (stepIndex === 1) {
                // Step 1: Vegetation
                if (Number.isFinite(vegAvg)) {
                    tooltip
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px; opacity: 0.9;">Average Temperature</div>
                            <div style="font-size: 20px; font-weight: 700; color: #48bb78; line-height: 1.2;">
                                ${vegAvg.toFixed(1)}°C
                            </div>
                            <div style="font-size: 11px; opacity: 0.85; margin-top: 6px;">
                                Vegetation (trees + low veg)
                            </div>
                        `)
                        .style('opacity', 1);
                } else {
                    tooltip.style('opacity', 0);
                }
            } else if (stepIndex === 2) {
                // Step 2: Built-up
                if (Number.isFinite(builtAvg)) {
                    tooltip
                        .html(`
                            <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px; opacity: 0.9;">Average Temperature</div>
                            <div style="font-size: 20px; font-weight: 700; color: #e53e3e; line-height: 1.2;">
                                ${builtAvg.toFixed(1)}°C
                            </div>
                            <div style="font-size: 11px; opacity: 0.85; margin-top: 6px;">
                                Built-up / urban
                            </div>
                        `)
                        .style('opacity', 1);
                } else {
                    tooltip.style('opacity', 0);
                }
            }
        }

        function setActiveStep(stepIndex) {
            // Always update, even if same step (fixes initial load issue)
            activeStep = stepIndex;

            // Hide all step canvases
            wcBackgroundCanvas.canvas.classList.remove('is-visible');
            step0Canvas.canvas.classList.remove('is-visible');
            step1Canvas.canvas.classList.remove('is-visible');
            step2Canvas.canvas.classList.remove('is-visible');

            // Show active step with WorldCover background for steps 1 and 2
            if (stepIndex === 0) {
                step0Canvas.canvas.classList.add('is-visible');
            } else if (stepIndex === 1) {
                wcBackgroundCanvas.canvas.classList.add('is-visible');
                step1Canvas.canvas.classList.add('is-visible');
            } else if (stepIndex === 2) {
                wcBackgroundCanvas.canvas.classList.add('is-visible');
                step2Canvas.canvas.classList.add('is-visible');
            }

            // Update slider value
            const slider = document.getElementById('semantic-slider');
            if (slider) slider.value = stepIndex;

            // Update slider labels
            updateSliderLabels(stepIndex);
            
            // Update tooltip with average temperature
            updateTooltip(stepIndex);
        }

        // Initialize: show step 0 (land cover)
        // Ensure step 0 is visible on initial load
        setActiveStep(0);
        
        // Force a reflow to ensure the canvas is displayed
        step0Canvas.canvas.offsetHeight;

        // Set up slider
        const slider = document.getElementById('semantic-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const step = parseInt(e.target.value);
                setActiveStep(step);
            });
        }

        // Set up label clicks
        const labels = document.querySelectorAll('.slider-label-item');
        labels.forEach((label, index) => {
            label.addEventListener('click', () => {
                setActiveStep(index);
            });
        });
    }
}
