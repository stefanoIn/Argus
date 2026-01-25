// Global Vulnerable Population Heatwave Exposure Visualization
// Data: Lancet Countdown Report 2025, Indicator 1.1.1

// Global variables for responsiveness
let vulnerableChoroplethData = null;
let vulnerableChoroplethResizeTimeout = null;

function handleVulnerableChoroplethResize() {
    if (vulnerableChoroplethResizeTimeout) {
        clearTimeout(vulnerableChoroplethResizeTimeout);
    }
    
    vulnerableChoroplethResizeTimeout = setTimeout(() => {
        if (vulnerableChoroplethData) {
            const container = d3.select('#viz-vulnerable-choropleth');
            if (!container.empty()) {
                container.selectAll('*').remove();
                createVulnerableChoroplethChart(vulnerableChoroplethData, container, null);
            }
        }
    }, 250);
}

function initializeVulnerableChoroplethViz() {
    const container = d3.select('#viz-vulnerable-choropleth');
    
    if (container.empty()) {
        console.warn('Vulnerable choropleth container not found');
        return;
    }
    
    let loadingMsg = container.select('.placeholder-text');
    if (loadingMsg.empty()) {
        loadingMsg = container.append('p')
            .attr('class', 'placeholder-text')
            .text('Loading global vulnerability data...');
    }
    
    // Load data
    d3.json('data/json/vulnerable_population_choropleth.json')
        .then(data => {
            vulnerableChoroplethData = data;
            if (loadingMsg) loadingMsg.remove();
            createVulnerableChoroplethChart(data, container, loadingMsg);
            
            // Add resize listener
            window.addEventListener('resize', handleVulnerableChoroplethResize);
        })
        .catch(error => {
            console.error('Error loading vulnerable choropleth data:', error);
            if (loadingMsg) {
                loadingMsg.text('Error loading data. Please refresh the page.')
                    .style('color', 'var(--accent-color)');
            }
        });
}

function createVulnerableChoroplethChart(data, container, loadingMsg) {
    // Set up dimensions
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const margin = { top: 40, right: 100, bottom: 60, left: 180 };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    
    // Sort data by total exposure and get top 30 countries
    const sortedData = data
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 30);
    
    const height = Math.max(600, sortedData.length * 22);
    
    // Add descriptive subtitle
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('overflow', 'visible');
    
    svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#6b7280')
        .style('font-weight', '400')
        .text(`Top 30 countries by total heatwave exposure (infants + adults 65+) in 2024 | Data: Lancet Countdown 2025`);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const yScale = d3.scaleBand()
        .domain(sortedData.map(d => d.country))
        .range([0, height])
        .padding(0.15);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d.total)])
        .nice()
        .range([0, width]);
    
    // Color scale
    const colorScale = d3.scaleSequential()
        .domain([0, d3.max(sortedData, d => d.total)])
        .interpolator(d3.interpolateReds);
    
    // Draw bars
    g.selectAll('.bar')
        .data(sortedData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.country))
        .attr('width', d => xScale(d.total))
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.total))
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer');
    
    // Add value labels
    g.selectAll('.value-label')
        .data(sortedData)
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .attr('x', d => xScale(d.total) + 5)
        .attr('y', d => yScale(d.country) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .style('fill', '#374151')
        .style('font-weight', '600')
        .text(d => (d.total / 1e6).toFixed(0) + 'M');
    
    // Y-axis (country names)
    const yAxis = d3.axisLeft(yScale);
    
    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .style('color', 'var(--text-primary)')
        .selectAll('text')
        .style('font-size', '11px')
        .style('font-weight', d => {
            // Highlight Italy
            return d === 'Italy' ? '700' : '400';
        })
        .style('fill', d => {
            return d === 'Italy' ? '#e85d04' : 'var(--text-primary)';
        });
    
    // X-axis
    const xAxis = d3.axisBottom(xScale)
        .ticks(6)
        .tickFormat(d => {
            if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
            if (d >= 1e6) return (d / 1e6).toFixed(0) + 'M';
            if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
            return d;
        });
    
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${height})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)');
    
    // Axis label
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Total Exposure Events');
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(255, 255, 255, 0.95)')
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('padding', '10px 14px')
        .style('font-size', '13px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('pointer-events', 'none')
        .style('z-index', '1000');
    
    // Add hover events
    g.selectAll('.bar')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('opacity', 0.7)
                .attr('stroke-width', 2);
            
            tooltip
                .style('visibility', 'visible')
                .html(`<strong>${d.country}</strong><br/>
                       <span style="color: #f97316;">●</span> Infants: ${(d.infants / 1e6).toFixed(1)}M<br/>
                       <span style="color: #dc2626;">●</span> Adults 65+: ${(d.older_adults / 1e6).toFixed(1)}M<br/>
                       <strong>Total: ${(d.total / 1e6).toFixed(1)}M exposure events</strong>`);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('top', (event.pageY - 80) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('opacity', 1)
                .attr('stroke-width', 1);
            
            tooltip.style('visibility', 'hidden');
        });
    
    // Highlight Italy with an indicator
    const italyData = sortedData.find(d => d.country === 'Italy');
    if (italyData) {
        const italyY = yScale(italyData.country);
        
        // Add a subtle indicator
        g.append('rect')
            .attr('x', -8)
            .attr('y', italyY)
            .attr('width', 4)
            .attr('height', yScale.bandwidth())
            .attr('fill', '#e85d04')
            .attr('rx', 2);
    }
    
    // Add color legend
    const legendWidth = 200;
    const legendHeight = 10;
    
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - legendWidth}, ${-30})`);
    
    // Create gradient for legend
    const legendGradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');
    
    const colorStops = d3.range(0, 1.01, 0.1);
    colorStops.forEach(stop => {
        legendGradient.append('stop')
            .attr('offset', `${stop * 100}%`)
            .attr('stop-color', colorScale(stop * d3.max(sortedData, d => d.total)));
    });
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1);
    
    legend.append('text')
        .attr('x', 0)
        .attr('y', legendHeight + 15)
        .style('font-size', '10px')
        .style('fill', 'var(--text-secondary)')
        .text('Low');
    
    legend.append('text')
        .attr('x', legendWidth)
        .attr('y', legendHeight + 15)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('fill', 'var(--text-secondary)')
        .text('High exposure');
    
    // Key findings annotation
    const topCountry = sortedData[0];
    
    g.append('text')
        .attr('x', 0)
        .attr('y', -40)
        .style('font-size', '12px')
        .style('font-style', 'italic')
        .style('fill', '#64748b')
        .text(`Highest: ${topCountry.country} with ${(topCountry.total / 1e6).toFixed(0)}M total exposure events`);
}
