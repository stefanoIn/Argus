/**
 * viz-hdd-cdd.js
 * Heating Degree Days (HDD) and Cooling Degree Days (CDD) Visualization
 * Shows area chart of HDD and CDD values over time
 */

// Store data globally for resize
let hddCddData = null;
let hddCddResizeTimeout = null;

function initializeHDDCDDViz() {
    const container = d3.select('#viz-hdd-cdd');
    
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    // Set container positioning
    container.style('position', 'relative')
        .style('min-height', '620px')
        .style('width', '100%')
        .style('display', 'block');
    
    // Create loading message
    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '60px 20px')
        .style('color', '#4a5568')
        .style('min-height', '620px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('justify-content', 'center');
    
    loadingMsg.append('p')
        .text('Loading HDD and CDD data...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Load all datasets in parallel
    Promise.all([
        fetch('data/eurostat_chdd/hdd_italy_by_year.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load HDD data`);
                return response.json();
            }),
        fetch('data/eurostat_chdd/cdd_italy_by_year.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load CDD data`);
                return response.json();
            }),
        fetch('data/eurostat_chdd/hdd_italy_by_month.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load HDD monthly data`);
                return response.json();
            }),
        fetch('data/eurostat_chdd/cdd_italy_by_month.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load CDD monthly data`);
                return response.json();
            })
    ])
        .then(([hddYearlyData, cddYearlyData, hddMonthlyData, cddMonthlyData]) => {
            if (!hddYearlyData || hddYearlyData.length === 0 || !cddYearlyData || cddYearlyData.length === 0) {
                throw new Error('No yearly data available');
            }
            if (!hddMonthlyData || hddMonthlyData.length === 0 || !cddMonthlyData || cddMonthlyData.length === 0) {
                throw new Error('No monthly data available');
            }
            
            // Store data for resize
            hddCddData = { hddYearlyData, cddYearlyData, hddMonthlyData, cddMonthlyData };
            
            createHDDCDDChart(hddYearlyData, cddYearlyData, hddMonthlyData, cddMonthlyData, container, loadingMsg);
            
            // Add resize listener
            window.addEventListener('resize', handleHDDCDDResize);
        })
        .catch(error => {
            console.error('[HDD/CDD] Error:', error);
            loadingMsg.html(`
                <p style="color: #e53e3e; margin-bottom: 10px; font-weight: 600;">Error loading data</p>
                <p style="color: #718096; font-size: 14px;">${error.message}</p>
                <button onclick="initializeHDDCDDViz()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Retry
                </button>
            `);
        });
}

function createHDDCDDChart(hddData, cddData, hddMonthlyData, cddMonthlyData, container, loadingMsg) {
    // Merge data by year
    const hddMap = new Map(hddData.map(d => [d.year, d.consumption]));
    const cddMap = new Map(cddData.map(d => [d.year, d.consumption]));
    
    // Get all unique years and sort
    const allYears = Array.from(new Set([...hddData.map(d => d.year), ...cddData.map(d => d.year)]))
        .sort((a, b) => a - b);
    
    // Create merged dataset
    const mergedData = allYears.map(year => ({
        year: year,
        hdd: hddMap.get(year) || 0,
        cdd: cddMap.get(year) || 0
    }));
    
    // --------------------------------------------
    // Header: make the message immediately clear
    // --------------------------------------------
    const firstYears = mergedData.slice(0, Math.min(5, mergedData.length));
    const lastYears = mergedData.slice(Math.max(0, mergedData.length - 5));
    
    const mean = (arr, key) => {
        const vals = arr.map(d => d[key]).filter(v => Number.isFinite(v));
        return vals.length ? d3.mean(vals) : 0;
    };
    
    const pctChange = (from, to) => {
        if (!Number.isFinite(from) || from === 0) return null;
        return ((to - from) / from) * 100;
    };
    
    const hddEarly = mean(firstYears, 'hdd');
    const hddLate = mean(lastYears, 'hdd');
    const cddEarly = mean(firstYears, 'cdd');
    const cddLate = mean(lastYears, 'cdd');
    
    const hddPct = pctChange(hddEarly, hddLate);
    const cddPct = pctChange(cddEarly, cddLate);
    
    const header = container.append('div')
        .style('display', 'flex')
        .style('flex-wrap', 'wrap')
        .style('justify-content', 'space-between')
        .style('align-items', 'flex-end')
        .style('gap', '12px')
        .style('margin', '0 0 10px 0');
    
    const headerText = header.append('div')
        .style('flex', '1 1 280px')
        .style('min-width', '200px');
    
    headerText.append('div')
        .style('font-size', '16px')
        .style('font-weight', '700')
        .style('color', 'var(--text-primary)')
        .text('Italy is shifting from heating to cooling');
    
    headerText.append('div')
        .style('font-size', '13px')
        .style('color', 'var(--text-secondary)')
        .style('line-height', '1.4')
        .text('HDD (heating need) is declining with milder winters, while CDD (cooling need) is rising with hotter summers.');
    
    const callouts = header.append('div')
        .style('display', 'flex')
        .style('gap', '10px')
        .style('flex', '0 0 auto')
        .style('flex-wrap', 'wrap');
    
    const fmt = d3.format(',.0f');
    const fmtPct = (p) => (p === null ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(0)}%`);
    
    const addCallout = (label, valueText, borderColor) => {
        const c = callouts.append('div')
            .style('background', 'var(--bg-card)')
            .style('border', `1px solid ${borderColor}`)
            .style('border-radius', '8px')
            .style('padding', '10px 12px')
            .style('min-width', '180px')
            .style('flex', '1 1 180px');
        
        c.append('div')
            .style('font-size', '11px')
            .style('color', 'var(--text-secondary)')
            .style('font-weight', '600')
            .text(label);
        
        c.append('div')
            .style('font-size', '14px')
            .style('color', 'var(--text-primary)')
            .style('font-weight', '700')
            .text(valueText);
    };
    
    addCallout(
        'Heating demand (HDD)',
        `${fmt(hddLate)} vs ${fmt(hddEarly)} (${fmtPct(hddPct)})`,
        'rgba(232, 93, 4, 0.35)'
    );
    
    addCallout(
        'Cooling demand (CDD)',
        `${fmt(cddLate)} vs ${fmt(cddEarly)} (${fmtPct(cddPct)})`,
        'rgba(49, 130, 206, 0.35)'
    );
    
    const periodLabel = `${firstYears[0]?.year ?? ''}–${firstYears[firstYears.length - 1]?.year ?? ''} vs ${lastYears[0]?.year ?? ''}–${lastYears[lastYears.length - 1]?.year ?? ''}`;
    
    header.append('div')
        .style('width', '100%')
        .style('font-size', '11px')
        .style('color', 'var(--text-tertiary)')
        .style('margin-top', '-4px')
        .text(`5-year averages: ${periodLabel}`);
    
    // ----------------------------
    // Set up dimensions
    // ----------------------------
    const margin = { top: 10, right: 40, bottom: 50, left: 70 };
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 340 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('overflow', 'visible');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(mergedData, d => d.year))
        .range([0, width]);
    
    const maxHDD = d3.max(mergedData, d => d.hdd) || 0;
    const maxCDD = d3.max(mergedData, d => d.cdd) || 0;
    const maxAbs = Math.max(maxHDD, maxCDD) * 1.15;
    
    // Diverging scale around 0:
    // HDD plotted above 0 (positive), CDD plotted below 0 (negative)
    const yScale = d3.scaleLinear()
        .domain([maxAbs, -maxAbs])
        .range([0, height]);
    
    // Colors (semantic: warm = heating, cool = cooling)
    const hddColor = '#e85d04'; // warm/orange for heating demand
    const cddColor = '#3182ce'; // blue for cooling demand
    
    const yZero = yScale(0);
    
    // Area generators (diverging around 0)
    const hddArea = d3.area()
        .x(d => xScale(d.year))
        .y0(yZero)
        .y1(d => yScale(d.hdd))
        .curve(d3.curveMonotoneX);
    
    const cddArea = d3.area()
        .x(d => xScale(d.year))
        .y0(yZero)
        .y1(d => yScale(-d.cdd))
        .curve(d3.curveMonotoneX);
    
    // 0 baseline
    g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yZero)
        .attr('y2', yZero)
        .attr('stroke', 'var(--border-medium)')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9);

    // Region labels
    g.append('text')
        .attr('x', 0)
        .attr('y', 14)
        .attr('text-anchor', 'start')
        .style('fill', hddColor)
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text('Heating need (HDD)');

    g.append('text')
        .attr('x', 0)
        .attr('y', height - 8)
        .attr('text-anchor', 'start')
        .style('fill', cddColor)
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text('Cooling need (CDD)');
    
    // Add HDD area (above 0)
    g.append('path')
        .datum(mergedData)
        .attr('fill', hddColor)
        .attr('fill-opacity', 0.28)
        .attr('stroke', hddColor)
        .attr('stroke-width', 2)
        .attr('d', hddArea);
    
    // Add CDD area (below 0)
    g.append('path')
        .datum(mergedData)
        .attr('fill', cddColor)
        .attr('fill-opacity', 0.22)
        .attr('stroke', cddColor)
        .attr('stroke-width', 2)
        .attr('d', cddArea);
    
    // Add HDD line on top
    const hddLine = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.hdd))
        .curve(d3.curveMonotoneX);
    
    g.append('path')
        .datum(mergedData)
        .attr('fill', 'none')
        .attr('stroke', hddColor)
        .attr('stroke-width', 2.5)
        .attr('d', hddLine);
    
    // Add CDD line on top
    const cddLine = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(-d.cdd))
        .curve(d3.curveMonotoneX);
    
    g.append('path')
        .datum(mergedData)
        .attr('fill', 'none')
        .attr('stroke', cddColor)
        .attr('stroke-width', 2.5)
        .attr('d', cddLine);
    
    // Add dots for HDD
    g.selectAll('.hdd-dot')
        .data(mergedData)
        .enter()
        .append('circle')
        .attr('class', 'hdd-dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.hdd))
        .attr('r', 2.3)
        .attr('fill', hddColor)
        .attr('opacity', 0.7)
        .on('mouseenter', function(event, d) {
            showTooltip(event, d, 'hdd');
        })
        .on('mouseleave', hideTooltip);
    
    // Add dots for CDD
    g.selectAll('.cdd-dot')
        .data(mergedData)
        .enter()
        .append('circle')
        .attr('class', 'cdd-dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(-d.cdd))
        .attr('r', 2.3)
        .attr('fill', cddColor)
        .attr('opacity', 0.7)
        .on('mouseenter', function(event, d) {
            showTooltip(event, d, 'cdd');
        })
        .on('mouseleave', hideTooltip);
    
    // X axis
    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.min(12, allYears.length))
        .tickFormat(d3.format('d'));
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '11px');
    
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '13px')
        .style('font-weight', '500')
        .text('Year');
    
    // Y axis (absolute labels: HDD above, CDD below)
    const yAxis = d3.axisLeft(yScale)
        .ticks(7)
        .tickFormat(d => {
            if (d === 0) return '0';
            return d3.format(',.0f')(Math.abs(d));
        });
    
    g.append('g')
        .call(yAxis)
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '11px');
    
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -60)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text('Degree days (HDD above 0, CDD below 0)');
    
    // Grid lines
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .ticks(7)
            .tickSize(-width)
            .tickFormat(''))
        .style('stroke', 'var(--border-light)')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    
    // Legend - responsive positioning (right-aligned, but ensure it fits)
    const legendWidth = 170;
    const legendX = width < 400 ? width - legendWidth - 10 : width - legendWidth;
    const legend = g.append('g')
        .attr('transform', `translate(${legendX}, 14)`);
    
    const legendItems = [
        { label: 'HDD (heating)', color: hddColor },
        { label: 'CDD (cooling)', color: cddColor }
    ];
    
    legendItems.forEach((item, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);
        
        legendItem.append('rect')
            .attr('x', 0)
            .attr('y', -8)
            .attr('width', 20)
            .attr('height', 12)
            .attr('fill', item.color)
            .attr('fill-opacity', 0.35)
            .attr('stroke', item.color)
            .attr('stroke-width', 1.5);
        
        legendItem.append('text')
            .attr('x', 25)
            .attr('y', 4)
            .style('fill', 'var(--text-primary)')
            .style('font-size', '12px')
            .style('font-weight', '500')
            .text(item.label);
    });
    
    // Tooltip
    const tooltip = container.append('div')
        .attr('class', 'hdd-cdd-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'var(--bg-overlay)')
        .style('color', 'var(--text-primary)')
        .style('padding', '10px 14px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('opacity', 0)
        .style('transition', 'opacity 0.2s')
        .style('z-index', '10')
        .style('box-shadow', 'var(--shadow-lg)')
        .style('border', '1px solid var(--border-medium)');
    
    function showTooltip(event, d, type) {
        const pointer = d3.pointer(event, container.node());
        const x = pointer[0];
        const y = pointer[1];
        
        tooltip
            .html(`
                <div style="font-weight: 700; margin-bottom: 6px; font-size: 12px;">${d.year}</div>
                <div style="margin-bottom: 4px;">
                    <span style="color: ${hddColor}; font-weight: 600;">HDD:</span> 
                    <span>${d.hdd.toFixed(0)}</span>
                </div>
                <div>
                    <span style="color: ${cddColor}; font-weight: 600;">CDD:</span> 
                    <span>${d.cdd.toFixed(0)}</span>
                </div>
            `)
            .style('left', (x + 15) + 'px')
            .style('top', (y - 10) + 'px')
            .style('opacity', 1);
    }
    
    function hideTooltip() {
        tooltip.style('opacity', 0);
    }
    
    // Create monthly heatmaps section
    createMonthlyHeatmaps(hddMonthlyData, cddMonthlyData, container, width, margin);
    
    // Remove loading message
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

function handleHDDCDDResize() {
    if (hddCddResizeTimeout) {
        clearTimeout(hddCddResizeTimeout);
    }
    
    hddCddResizeTimeout = setTimeout(() => {
        if (hddCddData) {
            const container = d3.select('#viz-hdd-cdd');
            if (!container.empty()) {
                container.selectAll('*').remove();
                createHDDCDDChart(
                    hddCddData.hddYearlyData,
                    hddCddData.cddYearlyData,
                    hddCddData.hddMonthlyData,
                    hddCddData.cddMonthlyData,
                    container,
                    null
                );
            }
        }
    }, 250);
}

function createMonthlyHeatmaps(hddMonthlyData, cddMonthlyData, container, mainWidth, mainMargin) {
    // Seasonality strips (average month)
    container.append('div')
        .style('text-align', 'center')
        .style('margin-top', '26px')
        .style('margin-bottom', '14px')
        .style('font-size', '14px')
        .style('font-weight', '700')
        .style('color', 'var(--text-primary)')
        .text('Seasonality (average month)');
    
    container.append('div')
        .style('text-align', 'center')
        .style('margin-top', '-6px')
        .style('margin-bottom', '18px')
        .style('font-size', '12px')
        .style('color', 'var(--text-secondary)')
        .text('Heating concentrates in winter months; cooling concentrates in summer months.');
    
    // Create container for heatmaps
    const heatmapsContainer = container.append('div')
        .style('display', 'flex')
        .style('gap', '18px')
        .style('justify-content', 'center')
        .style('flex-wrap', 'wrap');
    
    // Month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Sort monthly data by month
    const sortedHDD = [...hddMonthlyData].sort((a, b) => a.month - b.month);
    const sortedCDD = [...cddMonthlyData].sort((a, b) => a.month - b.month);
    
    // Find max values for color scaling
    const maxHDD = d3.max(sortedHDD, d => d.consumption);
    const maxCDD = d3.max(sortedCDD, d => d.consumption);
    
    // Create color scales (semantic: heating = warm, cooling = cool)
    const hddColorScale = d3.scaleSequential(d3.interpolateOranges)
        .domain([0, maxHDD]);
    
    const cddColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxCDD]);

    // Contrast-aware label color (works in dark + light themes)
    function labelColorFor(bg) {
        const c = d3.color(bg);
        if (!c) return 'var(--text-primary)';
        // Relative luminance (approx) using sRGB
        const toLin = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const r = toLin(c.r);
        const g = toLin(c.g);
        const b = toLin(c.b);
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        // If background is light, use dark text; else use white text
        return L > 0.55 ? '#0f1419' : '#ffffff';
    }

    // Subtle halo to keep labels readable on mid-tones
    function labelHaloFor(bg) {
        const c = d3.color(bg);
        if (!c) return 'rgba(0,0,0,0.35)';
        const toLin = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const r = toLin(c.r);
        const g = toLin(c.g);
        const b = toLin(c.b);
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        // Light tile → dark text → light halo; Dark tile → white text → dark halo
        return L > 0.55 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
    }
    
    // Strip dimensions - responsive to container width
    const containerWidth = container.node().getBoundingClientRect().width;
    const availableWidth = containerWidth - 40; // Account for padding
    const heatmapWidth = Math.min(520, Math.max(300, availableWidth));
    const heatmapHeight = 120;
    const cellWidth = heatmapWidth / 12;
    const cellHeight = 44;
    
    // Tooltip for heatmaps (create once)
    const heatmapTooltip = container.append('div')
        .attr('class', 'heatmap-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'var(--bg-overlay)')
        .style('color', 'var(--text-primary)')
        .style('padding', '10px 14px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('opacity', 0)
        .style('transition', 'opacity 0.2s')
        .style('z-index', '10')
        .style('box-shadow', 'var(--shadow-lg)')
        .style('border', '1px solid var(--border-medium)');
    
    function showHeatmapTooltip(event, d, monthName, type, color) {
        const pointer = d3.pointer(event, container.node());
        const x = pointer[0];
        const y = pointer[1];
        
        heatmapTooltip
            .html(`
                <div style="font-weight: 700; margin-bottom: 6px; font-size: 12px;">${monthName}</div>
                <div style="color: ${color}; font-weight: 600; font-size: 16px;">
                    ${type}: ${d.consumption.toFixed(0)}
                </div>
                <div style="margin-top: 4px; font-size: 11px; color: var(--text-secondary);">
                    Average across all years
                </div>
            `)
            .style('left', (x + 15) + 'px')
            .style('top', (y - 10) + 'px')
            .style('opacity', 1);
    }
    
    function hideHeatmapTooltip() {
        heatmapTooltip.style('opacity', 0);
    }
    
    // Create HDD heatmap
    const hddHeatmapWrapper = heatmapsContainer.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center');
    
    hddHeatmapWrapper.append('div')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('color', 'var(--text-primary)')
        .style('margin-bottom', '10px')
        .text('Heating Degree Days (HDD)');
    
    const hddSvg = hddHeatmapWrapper.append('svg')
        .attr('width', heatmapWidth)
        .attr('height', heatmapHeight)
        .style('overflow', 'visible');
    
    const hddG = hddSvg.append('g');
    
    // Create cells for HDD
    sortedHDD.forEach((d, i) => {
        const cell = hddG.append('rect')
            .attr('x', i * cellWidth)
            .attr('y', (heatmapHeight - cellHeight) / 2)
            .attr('width', cellWidth - 2)
            .attr('height', cellHeight)
            .attr('fill', hddColorScale(d.consumption))
            .attr('stroke', 'var(--border-light)')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function(event) {
                d3.select(this)
                    .attr('stroke', '#e85d04')
                    .attr('stroke-width', 2);
                showHeatmapTooltip(event, d, monthNames[d.month - 1], 'HDD', hddColorScale(d.consumption));
            })
            .on('mouseleave', function() {
                d3.select(this)
                    .attr('stroke', 'var(--border-light)')
                    .attr('stroke-width', 1);
                hideHeatmapTooltip();
            });
        
        // Add month label
        hddG.append('text')
            .attr('x', i * cellWidth + cellWidth / 2)
            .attr('y', (heatmapHeight - cellHeight) / 2 + cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('fill', labelColorFor(hddColorScale(d.consumption)))
            .style('stroke', labelHaloFor(hddColorScale(d.consumption)))
            .style('stroke-width', 2.5)
            .style('stroke-linejoin', 'round')
            .style('paint-order', 'stroke')
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(monthNames[d.month - 1]);
        
    });
    
    // Create CDD heatmap
    const cddHeatmapWrapper = heatmapsContainer.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center');
    
    cddHeatmapWrapper.append('div')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('color', 'var(--text-primary)')
        .style('margin-bottom', '10px')
        .text('Cooling Degree Days (CDD)');
    
    const cddSvg = cddHeatmapWrapper.append('svg')
        .attr('width', heatmapWidth)
        .attr('height', heatmapHeight)
        .style('overflow', 'visible');
    
    const cddG = cddSvg.append('g');
    
    // Create cells for CDD
    sortedCDD.forEach((d, i) => {
        const cell = cddG.append('rect')
            .attr('x', i * cellWidth)
            .attr('y', (heatmapHeight - cellHeight) / 2)
            .attr('width', cellWidth - 2)
            .attr('height', cellHeight)
            .attr('fill', cddColorScale(d.consumption))
            .attr('stroke', 'var(--border-light)')
            .attr('stroke-width', 1)
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseenter', function(event) {
                d3.select(this)
                    .attr('stroke', '#3182ce')
                    .attr('stroke-width', 2);
                showHeatmapTooltip(event, d, monthNames[d.month - 1], 'CDD', cddColorScale(d.consumption));
            })
            .on('mouseleave', function() {
                d3.select(this)
                    .attr('stroke', 'var(--border-light)')
                    .attr('stroke-width', 1);
                hideHeatmapTooltip();
            });
        
        // Add month label
        cddG.append('text')
            .attr('x', i * cellWidth + cellWidth / 2)
            .attr('y', (heatmapHeight - cellHeight) / 2 + cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('fill', labelColorFor(cddColorScale(d.consumption)))
            .style('stroke', labelHaloFor(cddColorScale(d.consumption)))
            .style('stroke-width', 2.5)
            .style('stroke-linejoin', 'round')
            .style('paint-order', 'stroke')
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(monthNames[d.month - 1]);
        
    });
}
