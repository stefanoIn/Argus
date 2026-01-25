// Vulnerable Population Heatwave Exposure Visualization
// Data: Lancet Countdown Report 2025, Indicator 1.1.1

// Global variables for responsiveness
let vulnerableExposureData = null;
let vulnerableExposureResizeTimeout = null;

function handleVulnerableExposureResize() {
    if (vulnerableExposureResizeTimeout) {
        clearTimeout(vulnerableExposureResizeTimeout);
    }
    
    vulnerableExposureResizeTimeout = setTimeout(() => {
        if (vulnerableExposureData) {
            const container = d3.select('#viz-vulnerable-exposure');
            if (!container.empty()) {
                container.selectAll('*').remove();
                createVulnerableExposureChart(vulnerableExposureData, container, null);
            }
        }
    }, 250);
}

function initializeVulnerableExposureViz() {
    const container = d3.select('#viz-vulnerable-exposure');
    
    if (container.empty()) {
        console.warn('Vulnerable exposure container not found');
        return;
    }
    
    let loadingMsg = container.select('.placeholder-text');
    if (loadingMsg.empty()) {
        loadingMsg = container.append('p')
            .attr('class', 'placeholder-text')
            .text('Loading vulnerable population data...');
    }
    
    // Load data
    d3.json('data/json/vulnerable_population_exposure.json')
        .then(data => {
            vulnerableExposureData = data;
            if (loadingMsg) loadingMsg.remove();
            createVulnerableExposureChart(data, container, loadingMsg);
            
            // Add resize listener
            window.addEventListener('resize', handleVulnerableExposureResize);
        })
        .catch(error => {
            console.error('Error loading vulnerable exposure data:', error);
            if (loadingMsg) {
                loadingMsg.text('Error loading data. Please refresh the page.')
                    .style('color', 'var(--accent-color)');
            }
        });
}

function createVulnerableExposureChart(data, container, loadingMsg) {
    // Set up dimensions
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const margin = { top: 40, right: 120, bottom: 60, left: 100 };
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
        .text('Total heatwave exposure events for vulnerable age groups in Italy, 1980–2024 | Data: Lancet Countdown 2025');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Parse data
    data.forEach(d => {
        d.year = +d.year;
        d.infants = +d.infants;
        d.older_adults = +d.older_adults;
    });
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => Math.max(d.infants, d.older_adults)) * 1.1])
        .nice()
        .range([height, 0]);
    
    // Area generators
    const areaInfants = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.infants))
        .curve(d3.curveMonotoneX);
    
    const areaOlderAdults = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.older_adults))
        .curve(d3.curveMonotoneX);
    
    // Line generators
    const lineInfants = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.infants))
        .curve(d3.curveMonotoneX);
    
    const lineOlderAdults = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.older_adults))
        .curve(d3.curveMonotoneX);
    
    // Gradients
    const gradientInfants = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'infantsGradient')
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
    
    gradientInfants.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#f97316')
        .attr('stop-opacity', 0.4);
    
    gradientInfants.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#f97316')
        .attr('stop-opacity', 0.05);
    
    const gradientOlderAdults = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'olderAdultsGradient')
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
    
    gradientOlderAdults.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#dc2626')
        .attr('stop-opacity', 0.4);
    
    gradientOlderAdults.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#dc2626')
        .attr('stop-opacity', 0.05);
    
    // Draw areas
    g.append('path')
        .datum(data)
        .attr('class', 'area-older-adults')
        .attr('d', areaOlderAdults)
        .attr('fill', 'url(#olderAdultsGradient)');
    
    g.append('path')
        .datum(data)
        .attr('class', 'area-infants')
        .attr('d', areaInfants)
        .attr('fill', 'url(#infantsGradient)');
    
    // Draw lines
    g.append('path')
        .datum(data)
        .attr('class', 'line-older-adults')
        .attr('d', lineOlderAdults)
        .attr('fill', 'none')
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 3);
    
    g.append('path')
        .datum(data)
        .attr('class', 'line-infants')
        .attr('d', lineInfants)
        .attr('fill', 'none')
        .attr('stroke', '#f97316')
        .attr('stroke-width', 3);
    
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
        .ticks(6)
        .tickFormat(d => {
            if (d >= 1e9) return (d / 1e9).toFixed(0) + 'B';
            if (d >= 1e6) return (d / 1e6).toFixed(0) + 'M';
            if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
            return d;
        });
    
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
        .attr('y', -70)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Total Exposure Events');
    
    // Legend
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 15}, ${height / 2 - 40})`);
    
    // Older adults legend
    const legendOlder = legend.append('g')
        .attr('transform', 'translate(0, 0)');
    
    legendOlder.append('line')
        .attr('x1', 0)
        .attr('x2', 30)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 3);
    
    legendOlder.append('text')
        .attr('x', 35)
        .attr('y', 5)
        .style('font-size', '12px')
        .style('fill', 'var(--text-primary)')
        .text('Adults 65+');
    
    // Infants legend
    const legendInfants = legend.append('g')
        .attr('transform', 'translate(0, 25)');
    
    legendInfants.append('line')
        .attr('x1', 0)
        .attr('x2', 30)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', '#f97316')
        .attr('stroke-width', 3);
    
    legendInfants.append('text')
        .attr('x', 35)
        .attr('y', 5)
        .style('font-size', '12px')
        .style('fill', 'var(--text-primary)')
        .text('Infants');
    
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
    
    // Add invisible overlay for hover
    const bisect = d3.bisector(d => d.year).left;
    
    g.append('rect')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mousemove', function(event) {
            const [mouseX] = d3.pointer(event);
            const year = Math.round(xScale.invert(mouseX));
            const index = bisect(data, year);
            
            if (index >= 0 && index < data.length) {
                const d = data[index];
                
                tooltip
                    .style('visibility', 'visible')
                    .html(`<strong>${d.year}</strong><br/>
                           <span style="color: #dc2626;">●</span> Adults 65+: ${(d.older_adults / 1e6).toFixed(1)}M<br/>
                           <span style="color: #f97316;">●</span> Infants: ${(d.infants / 1e6).toFixed(1)}M`);
            }
        })
        .on('mousemove', function(event) {
            tooltip
                .style('top', (event.pageY - 60) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
        });
    
    // Key findings annotation
    const recentData = data[data.length - 1];
    const peakOlderData = data.reduce((max, d) => d.older_adults > max.older_adults ? d : max);
    
    // Annotate 2024 (most recent)
    const recentX = xScale(recentData.year);
    const recentY = yScale(recentData.older_adults);
    
    const annotation = g.append('g')
        .attr('class', 'annotation');
    
    annotation.append('circle')
        .attr('cx', recentX)
        .attr('cy', recentY)
        .attr('r', 5)
        .attr('fill', 'white')
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 2);
    
    annotation.append('text')
        .attr('x', recentX - 10)
        .attr('y', recentY - 12)
        .attr('text-anchor', 'end')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .style('fill', '#dc2626')
        .text(`${recentData.year}: ${(recentData.older_adults / 1e6).toFixed(0)}M older adults`);
}
