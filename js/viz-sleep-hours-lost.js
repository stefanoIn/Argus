// Sleep Hours Lost Due to Heat Visualization
// Data: Lancet Countdown Report 2025, Indicator 1.1.3

// Global variables for responsiveness
let sleepHoursData = null;
let sleepHoursResizeTimeout = null;

function handleSleepHoursResize() {
    if (sleepHoursResizeTimeout) {
        clearTimeout(sleepHoursResizeTimeout);
    }
    
    sleepHoursResizeTimeout = setTimeout(() => {
        if (sleepHoursData) {
            const container = d3.select('#viz-sleep-hours-lost');
            if (!container.empty()) {
                container.selectAll('*').remove();
                createSleepHoursChart(sleepHoursData, container, null);
            }
        }
    }, 250);
}

function initializeSleepHoursViz() {
    const container = d3.select('#viz-sleep-hours-lost');
    
    if (container.empty()) {
        console.warn('Sleep hours lost container not found');
        return;
    }
    
    let loadingMsg = container.select('.placeholder-text');
    if (loadingMsg.empty()) {
        loadingMsg = container.append('p')
            .attr('class', 'placeholder-text')
            .text('Loading sleep hours lost data...');
    }
    
    // Load data
    d3.json('data/json/sleep_hours_lost.json')
        .then(data => {
            sleepHoursData = data;
            if (loadingMsg) loadingMsg.remove();
            createSleepHoursChart(data, container, loadingMsg);
            
            // Add resize listener
            window.addEventListener('resize', handleSleepHoursResize);
        })
        .catch(error => {
            console.error('Error loading sleep hours data:', error);
            if (loadingMsg) {
                loadingMsg.text('Error loading data. Please refresh the page.')
                    .style('color', 'var(--accent-color)');
            }
        });
}

function createSleepHoursChart(data, container, loadingMsg) {
    // Set up dimensions
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 450;
    
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
        .text('Annual sleep hours lost per person due to heat exposure in Italy, 1990–2024 | Data: Lancet Countdown 2025');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Parse data
    data.forEach(d => {
        d.year = +d.year;
        d.hours_lost = +d.hours_lost_per_person;
    });
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.hours_lost) * 1.1])
        .nice()
        .range([height, 0]);
    
    // Gradient for area
    const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'sleepGradient')
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
    
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#6366f1')
        .attr('stop-opacity', 0.4);
    
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#6366f1')
        .attr('stop-opacity', 0.05);
    
    // Area generator
    const area = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.hours_lost))
        .curve(d3.curveMonotoneX);
    
    // Line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.hours_lost))
        .curve(d3.curveMonotoneX);
    
    // Draw area
    g.append('path')
        .datum(data)
        .attr('class', 'area')
        .attr('d', area)
        .attr('fill', 'url(#sleepGradient)');
    
    // Draw line
    g.append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 3);
    
    // Add data points
    g.selectAll('.dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.hours_lost))
        .attr('r', 4)
        .attr('fill', '#6366f1')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    
    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format('d'))
        .ticks(8);
    
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${height})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)');
    
    const yAxis = d3.axisLeft(yScale)
        .ticks(6);
    
    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .style('color', 'var(--text-secondary)');
    
    // Axis labels
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Year');
    
    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -55)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Hours Lost per Person');
    
    // Tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(255, 255, 255, 0.95)')
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('padding', '8px 12px')
        .style('font-size', '13px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('pointer-events', 'none')
        .style('z-index', '1000');
    
    // Add hover events
    g.selectAll('.dot')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 6);
            
            tooltip
                .style('visibility', 'visible')
                .html(`<strong>${d.year}</strong><br/>
                       <span style="color: #6366f1;">●</span> ${d.hours_lost.toFixed(2)} hours lost`);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('top', (event.pageY - 40) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', 4);
            
            tooltip.style('visibility', 'hidden');
        });
    
    // Key findings annotation
    const recentData = data[data.length - 1];
    const peakData = data.reduce((max, d) => d.hours_lost > max.hours_lost ? d : max);
    
    // Annotate peak
    const peakX = xScale(peakData.year);
    const peakY = yScale(peakData.hours_lost);
    
    const annotation = g.append('g')
        .attr('class', 'annotation');
    
    annotation.append('line')
        .attr('x1', peakX)
        .attr('y1', peakY - 10)
        .attr('x2', peakX)
        .attr('y2', peakY - 60)
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2');
    
    annotation.append('text')
        .attr('x', peakX)
        .attr('y', peakY - 68)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#6366f1')
        .text(`Peak: ${peakData.hours_lost.toFixed(1)} hrs (${peakData.year})`);
    
    // Trend line (simple linear regression)
    const n = data.length;
    const sumX = d3.sum(data, d => d.year);
    const sumY = d3.sum(data, d => d.hours_lost);
    const sumXY = d3.sum(data, d => d.year * d.hours_lost);
    const sumX2 = d3.sum(data, d => d.year * d.year);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const trendLine = data.map(d => ({
        year: d.year,
        trend: slope * d.year + intercept
    }));
    
    g.append('path')
        .datum(trendLine)
        .attr('class', 'trend-line')
        .attr('d', d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.trend))
        )
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.6);
    
    // Trend annotation
    const trendChange = ((recentData.hours_lost - data[0].hours_lost) / data[0].hours_lost * 100).toFixed(1);
    const trendText = slope > 0 ? `↑ ${trendChange}% increase since 1990` : `↓ ${Math.abs(trendChange)}% decrease since 1990`;
    
    g.append('text')
        .attr('x', width - 10)
        .attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-size', '11px')
        .style('font-style', 'italic')
        .style('fill', '#64748b')
        .text(`Trend: ${trendText}`);
}
