/**
 * viz-genoa-ndvi.js
 * Genoa NDVI Visualization from TIFF
 * Web rendering with:
 *  - Neutral mask for NDVI < 0 (non-vegetation)
 *  - Sequential green scale for NDVI 0–1 (vegetation)
 *  - NDVI semantic range (−1 to 1) preserved and explained
 */
function initializeGenoaNDVIViz() {

    const container = d3.select('#viz-genoa-ndvi');
    if (container.empty()) return;
    container.selectAll('*').remove();

    if (typeof GeoTIFF === 'undefined') {
        container.html('<p style="color:#e53e3e;padding:20px;">GeoTIFF library not loaded.</p>');
        return;
    }

    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '40px')
        .style('color', '#4a5568')
        .text('Loading Genoa NDVI data…');

    const tiffPath = 'data/processed/NDVI_genoa_2025-07-09.tif';

    fetch(tiffPath)
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
        })
        .then(b => GeoTIFF.fromArrayBuffer(b))
        .then(t => t.getImage())
        .then(image => image.readRasters().then(rasters => ({
            data: rasters[0],
            width: image.getWidth(),
            height: image.getHeight()
        })))
        .then(({ data, width, height }) => {

            /* -----------------------------
               DISPLAY & DOWNSAMPLING
            ------------------------------*/
            const margin = { top: 20, right: 20, bottom: 110, left: 20 };

            const displayWidth = Math.min(
                900,
                container.node().getBoundingClientRect().width
            );

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
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            /* -----------------------------
               COLOR SCALES
            ------------------------------*/

            // Sequential green scale for vegetation only (NDVI 0–1)
            const vegInterpolator = d3.interpolateRgbBasis([
                '#f7fcf5',
                '#c7e9c0',
                '#74c476',
                '#238b45',
                '#00441b'
            ]);

            const vegColorScale = d3.scaleSequential(vegInterpolator)
                .domain([0, 1])
                .clamp(true);

            // Neutral color for NDVI < 0
            const neutralColor = { r: 229, g: 231, b: 235, a: 255 };

            /* -----------------------------
               CANVAS RENDERING
            ------------------------------*/
            const canvas = document.createElement('canvas');
            canvas.width = rasterWidth;
            canvas.height = rasterHeight;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(rasterWidth, rasterHeight);

            for (let y = 0; y < rasterHeight; y++) {
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
                            // Non-vegetation (water / built-up)
                            ({ r, g, b, a } = neutralColor);
                        } else {
                            // Vegetation (0–1), perceptually emphasized
                            const gamma = 0.7;
                            const v = Math.pow(avg, gamma);
                            const c = d3.rgb(vegColorScale(v));
                            r = c.r; g = c.g; b = c.b; a = 255;
                        }
                    }

                    const i = (y * rasterWidth + x) * 4;
                    imageData.data[i] = r;
                    imageData.data[i + 1] = g;
                    imageData.data[i + 2] = b;
                    imageData.data[i + 3] = a;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            svg.append('image')
                .attr('href', canvas.toDataURL())
                .attr('width', displayWidth)
                .attr('height', displayHeight)
                .style('image-rendering', 'auto');

            /* -----------------------------
               LEGEND
            ------------------------------*/
            const legendWidth = 320;
            const legendHeight = 22;

            const legend = svg.append('g')
                .attr('transform', `translate(${(displayWidth - legendWidth) / 2}, ${displayHeight + 45})`);

            const defs = svg.append('defs');
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

            // Vegetation gradient
            legend.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', legendWidth)
                .attr('height', legendHeight)
                .attr('fill', 'url(#ndvi-veg-gradient)')
                .attr('stroke', '#4a5568');

            // Ticks
            [0, 0.25, 0.5, 0.75, 1].forEach((v, i, arr) => {
                const x = (i / (arr.length - 1)) * legendWidth;
                legend.append('text')
                    .attr('x', x)
                    .attr('y', legendHeight + 16)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '11px')
                    .text(v.toFixed(2));
            });

            // Legend title
            legend.append('text')
                .attr('x', legendWidth / 2)
                .attr('y', -10)
                .attr('text-anchor', 'middle')
                .style('font-size', '13px')
                .style('font-weight', '500')
                .text('Vegetation Density (NDVI 0–1)');

            // Neutral label
            legend.append('rect')
                .attr('x', 0)
                .attr('y', legendHeight + 28)
                .attr('width', 20)
                .attr('height', 12)
                .attr('fill', 'rgb(229,231,235)')
                .attr('stroke', '#4a5568');

            legend.append('text')
                .attr('x', 26)
                .attr('y', legendHeight + 38)
                .style('font-size', '11px')
                .text('NDVI < 0 (water / non-vegetation)');

            loadingMsg.remove();
        })
        .catch(err => {
            console.error(err);
            loadingMsg.html('<p style="color:#e53e3e;">Failed to load NDVI data</p>');
        });
}
