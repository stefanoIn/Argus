/**
 * viz-genoa-ndvi.js
 * NDVI tiles rendered client-side with a green ramp.
 * Tile values: 1–255 mapped from NDVI [-0.2, 0.9]; 0 = NoData (transparent).
 */
function initializeGenoaNDVIViz() {
    const container = d3.select('#viz-genoa-ndvi');
    if (container.empty()) return;
    container.selectAll('*').remove();

    const tileRoot = 'data/tiles/ndvi';
    const manifestPath = `${tileRoot}/manifest.json`;

    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '40px')
        .style('color', '#4a5568')
        .text('Loading Genoa NDVI tiles...');

    const ndviColors = ['#e6f2e1', '#c7e1b3', '#90c987', '#4a9f5b', '#0a5a2e'];
    const ndviScale = d3.scaleSequential(d3.interpolateRgbBasis(ndviColors))
        .domain([0, 1])
        .clamp(true);

    const ndviLut = new Uint8ClampedArray(256 * 4);
    for (let value = 0; value < 256; value++) {
        const offset = value * 4;
        if (value === 0) {
            ndviLut[offset + 3] = 0;
            continue;
        }
        const ndvi = -0.2 + ((value - 1) * (1.1 / 254));
        const t = Math.min(1, Math.max(0, (ndvi + 0.2) / 1.1));
        const color = d3.rgb(ndviScale(t));
        ndviLut[offset] = color.r;
        ndviLut[offset + 1] = color.g;
        ndviLut[offset + 2] = color.b;
        ndviLut[offset + 3] = 255;
    }

    function loadJson(path) {
        return fetch(path)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            });
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load ${url}`));
            img.src = url;
        });
    }

    loadJson(manifestPath)
        .then(manifest => {
            const grid = manifest.grid;
            if (!grid) throw new Error('Tile manifest missing grid bounds.');

            const tileSize = manifest.tileSize || 256;
            const cols = grid.maxX - grid.minX + 1;
            const rows = grid.maxY - grid.minY + 1;
            const mapWidth = cols * tileSize;
            const mapHeight = rows * tileSize;

            const canvas = container.append('canvas')
                .attr('class', 'tile-canvas')
                .attr('width', mapWidth)
                .attr('height', mapHeight)
                .node();

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.imageSmoothingEnabled = false;

            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tileSize;
            tileCanvas.height = tileSize;
            const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });

            const tilePromises = [];
            for (let y = grid.minY; y <= grid.maxY; y++) {
                for (let x = grid.minX; x <= grid.maxX; x++) {
                    const url = `${tileRoot}/${grid.z}/${x}/${y}.png`;
                    tilePromises.push(loadImage(url).then(img => ({ img, x, y })));
                }
            }

            return Promise.all(tilePromises).then(tiles => {
                tiles.forEach(({ img, x, y }) => {
                    tileCtx.clearRect(0, 0, tileSize, tileSize);
                    tileCtx.drawImage(img, 0, 0);
                    const imageData = tileCtx.getImageData(0, 0, tileSize, tileSize);
                    const data = imageData.data;

                    for (let i = 0; i < data.length; i += 4) {
                        const value = data[i];
                        const lutIndex = value * 4;
                        data[i] = ndviLut[lutIndex];
                        data[i + 1] = ndviLut[lutIndex + 1];
                        data[i + 2] = ndviLut[lutIndex + 2];
                        data[i + 3] = ndviLut[lutIndex + 3];
                    }

                    tileCtx.putImageData(imageData, 0, 0);
                    ctx.drawImage(
                        tileCanvas,
                        (x - grid.minX) * tileSize,
                        (y - grid.minY) * tileSize
                    );
                });

                addLegend();
                loadingMsg.remove();
            });
        })
        .catch(err => {
            console.error(err);
            loadingMsg.html('<p style="color:#e53e3e;">Failed to load NDVI tiles</p>');
        });

    function addLegend() {
        const legend = container.append('div').attr('class', 'tile-legend');
        legend.append('div')
            .attr('class', 'tile-legend-title')
            .text('NDVI (-0.2 to 0.9)');

        legend.append('div')
            .attr('class', 'tile-legend-bar')
            .style('background', `linear-gradient(90deg, ${ndviColors.join(',')})`);

        const labels = legend.append('div').attr('class', 'tile-legend-labels');
        [-0.2, 0.0, 0.35, 0.9].forEach(value => {
            labels.append('span').text(value.toFixed(2));
        });
    }
}
