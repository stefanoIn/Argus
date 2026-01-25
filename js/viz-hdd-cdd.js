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
        const [x, y]