/**
 * viz-hdd-cdd.js
 * Heating Degree Days (HDD) and Cooling Degree Days (CDD) Visualization
 * Shows area chart of HDD and CDD values over time
 */

function initializeHDDCDDViz() {
    const container = d3.select('#viz-hdd-cdd');
    
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    // Set container positioning
    container.style('position', 'relative')
        .style('min-height', '800px')
        .style('width', '100%')
        .style('display', 'block');
    
    // Create loading message
    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '60px 20px')
        .style('color', '#4a5568')
        .style('min-height', '800px')
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
            
            createHDDCDDChart(hddYearlyData, cddYearlyData, hddMonthlyData, cddMonthlyData, container, loadingMsg);
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
    
    // Set up dimensions
    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = Math.max(800, containerWidth) - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    
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
    
    const maxHDD = d3.max(mergedData, d => d.hdd);
    const maxCDD = d3.max(mergedData, d => d.cdd);
    const maxValue = Math.max(maxHDD, maxCDD);
    
    const yScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .nice()
        .range([height, 0]);
    
    // Colors
    const hddColor = '#3182ce'; // Blue for heating
    const cddColor = '#e53e3e'; // Red for cooling
    
    // Area generators
    const hddArea = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.hdd))
        .curve(d3.curveMonotoneX);
    
    const cddArea = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.cdd))
        .curve(d3.curveMonotoneX);
    
    // Add HDD area
    g.append('path')
        .datum(mergedData)
        .attr('fill', hddColor)
        .attr('fill-opacity', 0.6)
        .attr('stroke', hddColor)
        .attr('stroke-width', 2)
        .attr('d', hddArea);
    
    // Add CDD area
    g.append('path')
        .datum(mergedData)
        .attr('fill', cddColor)
        .attr('fill-opacity', 0.6)
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
        .y(d => yScale(d.cdd))
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
        .attr('r', 3)
        .attr('fill', hddColor)
        .attr('opacity', 0.8)
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
        .attr('cy', d => yScale(d.cdd))
        .attr('r', 3)
        .attr('fill', cddColor)
        .attr('opacity', 0.8)
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
    
    // Y axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(8)
        .tickFormat(d => d.toLocaleString());
    
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
        .text('Degree Days');
    
    // Grid lines
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .ticks(8)
            .tickSize(-width)
            .tickFormat(''))
        .style('stroke', 'var(--border-light)')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    
    // Legend
    const legend = g.append('g')
        .attr('transform', `translate(${width - 180}, 20)`);
    
    const legendItems = [
        { label: 'HDD (Heating Degree Days)', color: hddColor },
        { label: 'CDD (Cooling Degree Days)', color: cddColor }
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
            .attr('fill-opacity', 0.6)
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
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${d.year}</div>
                <div style="margin-bottom: 4px;">
                    <span style="color: ${hddColor}; font-weight: 600;">HDD:</span> 
                    <span>${d.hdd.toFixed(2)}</span>
                </div>
                <div>
                    <span style="color: ${cddColor}; font-weight: 600;">CDD:</span> 
                    <span>${d.cdd.toFixed(2)}</span>
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
    loadingMsg.remove();
}

function createMonthlyHeatmaps(hddMonthlyData, cddMonthlyData, container, mainWidth, mainMargin) {
    // Add question text above heatmaps
    const questionText = container.append('div')
        .style('text-align', 'center')
        .style('margin-top', '40px')
        .style('margin-bottom', '20px')
        .style('font-size', '16px')
        .style('font-weight', '600')
        .style('color', 'var(--text-primary)')
        .text('When do we use heating and cooling?');
    
    // Create container for heatmaps
    const heatmapsContainer = container.append('div')
        .style('display', 'flex')
        .style('gap', '30px')
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
    
    // Create color scales
    const hddColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxHDD]);
    
    const cddColorScale = d3.scaleSequential(d3.interpolateReds)
        .domain([0, maxCDD]);
    
    // Heatmap dimensions
    const heatmapWidth = Math.min(400, (mainWidth + mainMargin.left + mainMargin.right) / 2 - 40);
    const heatmapHeight = 300;
    const cellWidth = heatmapWidth / 12;
    const cellHeight = 50;
    
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
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${monthName}</div>
                <div style="color: ${color}; font-weight: 600; font-size: 16px;">
                    ${type}: ${d.consumption.toFixed(2)}
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
                    .attr('stroke', '#3182ce')
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
            .style('fill', d.consumption > maxHDD / 2 ? 'white' : 'var(--text-primary)')
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(monthNames[d.month - 1]);
        
        // Add value label below
        hddG.append('text')
            .attr('x', i * cellWidth + cellWidth / 2)
            .attr('y', (heatmapHeight - cellHeight) / 2 + cellHeight + 15)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '10px')
            .text(d.consumption.toFixed(1));
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
                    .attr('stroke', '#e53e3e')
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
            .style('fill', d.consumption > maxCDD / 2 ? 'white' : 'var(--text-primary)')
            .style('font-size', '11px')
            .style('font-weight', '600')
            .text(monthNames[d.month - 1]);
        
        // Add value label below
        cddG.append('text')
            .attr('x', i * cellWidth + cellWidth / 2)
            .attr('y', (heatmapHeight - cellHeight) / 2 + cellHeight + 15)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--text-secondary)')
            .style('font-size', '10px')
            .text(d.consumption.toFixed(1));
    });
}
