/**
 * viz-heat-deaths.js
 * Heat-Related Mortality Visualization
 * Shows excess deaths attributed to heat in Italy
 */

function initializeHeatDeathsViz() {
    const container = d3.select('#viz-heat-deaths');
    
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    // Set container positioning
    container.style('position', 'relative')
        .style('min-height', '400px')
        .style('width', '100%')
        .style('display', 'block');
    
    // Create loading message
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
        .text('Loading heat-related mortality data...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Load data
    fetch('data/json/heat_mortality.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load mortality data`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.data || data.data.length === 0) {
                throw new Error('No data available');
            }
            
            createHeatDeathsChart(data.data, data.metadata, container, loadingMsg);
        })
        .catch(error => {
            console.error('[Heat Deaths] Error:', error);
            loadingMsg.html(`
                <p style="color: #e53e3e; margin-bottom: 10px; font-weight: 600;">Error loading data</p>
                <p style="color: #718096; font-size: 14px;">${error.message}</p>
                <button onclick="initializeHeatDeathsViz()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Retry
                </button>
            `);
        });
}

function createHeatDeathsChart(data, metadata, container, loadingMsg) {
    // Sort by year
    const sortedData = [...data].sort((a, b) => a.year - b.year);
    
    // Set up dimensions
    const margin = { top: 20, right: 40, bottom: 60, left: 80 };
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = Math.max(600, containerWidth) - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('overflow', 'visible');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d.year))
        .range([0, width])
        .padding(0.3);
    
    const maxDeaths = d3.max(sortedData, d => d.excess_deaths);
    const yScale = d3.scaleLinear()
        .domain([0, maxDeaths * 1.1])
        .nice()
        .range([height, 0]);
    
    // Color scale - gradient from light to dark red
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain([0, maxDeaths]);
    
    // Create bars
    const bars = g.selectAll('.bar')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.year))
        .attr('y', d => yScale(d.excess_deaths))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - yScale(d.excess_deaths))
        .attr('fill', d => colorScale(d.excess_deaths))
        .attr('rx', 4)
        .attr('opacity', 0.9)
        .on('mouseenter', function(event, d) {
            showTooltip(event, d);
            d3.select(this)
                .attr('opacity', 1)
                .attr('stroke', '#e53e3e')
                .attr('stroke-width', 2);
        })
        .on('mouseleave', function() {
            hideTooltip();
            d3.select(this)
                .attr('opacity', 0.9)
                .attr('stroke', 'none');
        });
    
    // Add value labels on bars
    g.selectAll('.bar-label')
        .data(sortedData)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.year) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.excess_deaths) - 8)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .text(d => d.excess_deaths.toLocaleString());
    
    // X axis
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => d);
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '12px');
    
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
        .ticks(6)
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
        .text(`Excess Deaths (${metadata.unit})`);
    
    // Grid lines
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-width)
            .tickFormat(''))
        .style('stroke', 'var(--border-light)')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    
    // Highlight 2022 bar (extreme year)
    const year2022 = sortedData.find(d => d.year === 2022);
    if (year2022) {
        const bar2022 = g.selectAll('.bar')
            .filter(d => d.year === 2022);
        
        bar2022.attr('stroke', '#c53030')
            .attr('stroke-width', 3);
        
        // Add annotation for 2022
        g.append('text')
            .attr('x', xScale(2022) + xScale.bandwidth() / 2)
            .attr('y', yScale(year2022.excess_deaths) - 25)
            .attr('text-anchor', 'middle')
            .style('fill', '#c53030')
            .style('font-size', '10px')
            .style('font-weight', '700')
            .text('Extreme Heat Wave');
    }
    
    // Tooltip
    const tooltip = container.append('div')
        .attr('class', 'heat-deaths-tooltip')
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
    
    function showTooltip(event, d) {
        const [x, y] = d3.pointer(event, container.node());
        
        tooltip
            .html(`
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${d.year}</div>
                <div style="color: #e53e3e; font-weight: 600; font-size: 16px;">
                    ${d.excess_deaths.toLocaleString()} ${metadata.unit}
                </div>
                ${d.year === 2022 ? '<div style="margin-top: 6px; font-size: 11px; color: var(--text-secondary);">Extreme heat wave year</div>' : ''}
            `)
            .style('left', (x + 15) + 'px')
            .style('top', (y - 10) + 'px')
            .style('opacity', 1);
    }
    
    function hideTooltip() {
        tooltip.style('opacity', 0);
    }
    
    // Remove loading message
    loadingMsg.remove();
}
