/**
 * viz-urban-population.js
 * Visualization showing global urban population growth over time
 */

// Store data globally for resize
let urbanPopData = null;
let urbanPopResizeTimeout = null;

function initializeUrbanPopulationViz(existingData = null) {
    const container = document.querySelector('#viz-urban-population');
    if (!container) {
        console.warn('[UrbanPop] Container not found');
        return;
    }

    // Clear any existing content
    container.innerHTML = '';

    // Set up dimensions
    const containerWidth = container.offsetWidth || 800;
    const margin = { top: 40, right: 120, bottom: 80, left: 100 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', containerWidth)
        .attr('height', height + margin.top + margin.bottom)
        .attr('class', 'urban-pop-svg');

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add title
    svg.append('text')
        .attr('x', containerWidth / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', '700')
        .style('fill', 'var(--text-primary)')
        .text('Global Urban Population Growth (1960-2026)');

    // Use existing data if available (for resize), otherwise load
    const dataPromise = existingData ? Promise.resolve(existingData) : d3.json('data/json/world_urban_population.json');
    
    dataPromise.then(data => {
            console.log(`[UrbanPop] ${existingData ? 'Using cached' : 'Loaded'} ${data.length} data points`);
            
            // Store data for resize
            urbanPopData = data;
            
            // Add resize listener (only once)
            if (!window.urbanPopResizeListenerAdded) {
                window.addEventListener('resize', handleUrbanPopResize);
                window.urbanPopResizeListenerAdded = true;
            }

            // Split data into historical (up to 2024) and projected (2025-2026)
            const historicalData = data.filter(d => d.year <= 2024);
            const projectedData = data.filter(d => d.year >= 2024); // Include 2024 to connect smoothly

            // Create scales
            const xScale = d3.scaleLinear()
                .domain(d3.extent(data, d => d.year))
                .range([0, width]);

            const yScale = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.population)])
                .nice()
                .range([height, 0]);

            // Create area generator
            const area = d3.area()
                .x(d => xScale(d.year))
                .y0(height)
                .y1(d => yScale(d.population))
                .curve(d3.curveMonotoneX);

            // Create line generator
            const line = d3.line()
                .x(d => xScale(d.year))
                .y(d => yScale(d.population))
                .curve(d3.curveMonotoneX);

            // Add gradient for historical area fill
            const gradient = svg.append('defs')
                .append('linearGradient')
                .attr('id', 'urbanPopGradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '0%')
                .attr('y2', '100%');

            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#e85d04')
                .attr('stop-opacity', 0.4);

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', '#e85d04')
                .attr('stop-opacity', 0.05);

            // Add gradient for projected area fill (lighter)
            const projectedGradient = svg.select('defs')
                .append('linearGradient')
                .attr('id', 'urbanPopProjectedGradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '0%')
                .attr('y2', '100%');

            projectedGradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#9ca3af')
                .attr('stop-opacity', 0.3);

            projectedGradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', '#9ca3af')
                .attr('stop-opacity', 0.05);

            // Add historical area
            const areaPath = g.append('path')
                .datum(historicalData)
                .attr('fill', 'url(#urbanPopGradient)')
                .attr('d', area);

            // Add projected area
            const projectedAreaPath = g.append('path')
                .datum(projectedData)
                .attr('fill', 'url(#urbanPopProjectedGradient)')
                .attr('d', area);

            // Add historical line
            const linePath = g.append('path')
                .datum(historicalData)
                .attr('fill', 'none')
                .attr('stroke', '#e85d04')
                .attr('stroke-width', 3)
                .attr('d', line);

            // Add projected line (dashed, gray)
            const projectedLinePath = g.append('path')
                .datum(projectedData)
                .attr('fill', 'none')
                .attr('stroke', '#6b7280')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '8,4')
                .attr('d', line);

            // Add axes
            const xAxis = d3.axisBottom(xScale)
                .ticks(10)
                .tickFormat(d3.format('d'));

            const yAxis = d3.axisLeft(yScale)
                .ticks(6)
                .tickFormat(d => {
                    if (d >= 1e9) return `${(d / 1e9).toFixed(1)}B`;
                    if (d >= 1e6) return `${(d / 1e6).toFixed(0)}M`;
                    return d;
                });

            g.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(xAxis)
                .style('color', 'var(--text-secondary)')
                .selectAll('text')
                .style('font-size', '11px');

            g.append('g')
                .call(yAxis)
                .style('color', 'var(--text-secondary)')
                .selectAll('text')
                .style('font-size', '11px');

            // Add axis labels
            g.append('text')
                .attr('x', width / 2)
                .attr('y', height + 50)
                .attr('text-anchor', 'middle')
                .style('font-size', '13px')
                .style('font-weight', '600')
                .style('fill', 'var(--text-primary)')
                .text('Year');

            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -70)
                .attr('x', -height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '13px')
                .style('font-weight', '600')
                .style('fill', 'var(--text-primary)')
                .text('Urban Population');

            // Add key annotations
            // 1960 starting point
            const startData = data[0];
            g.append('circle')
                .attr('cx', xScale(startData.year))
                .attr('cy', yScale(startData.population))
                .attr('r', 5)
                .attr('fill', '#e85d04')
                .attr('stroke', 'white')
                .attr('stroke-width', 2);

            g.append('text')
                .attr('x', xScale(startData.year))
                .attr('y', yScale(startData.population) - 15)
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('font-weight', '600')
                .style('fill', '#e85d04')
                .text(`${(startData.population / 1e9).toFixed(2)}B`);

            // 2024 transition point (historical → projected)
            const year2024Data = data.find(d => d.year === 2024);
            g.append('circle')
                .attr('cx', xScale(year2024Data.year))
                .attr('cy', yScale(year2024Data.population))
                .attr('r', 5)
                .attr('fill', '#e85d04')
                .attr('stroke', 'white')
                .attr('stroke-width', 2);

            g.append('text')
                .attr('x', xScale(year2024Data.year))
                .attr('y', yScale(year2024Data.population) - 15)
                .attr('text-anchor', 'middle')
                .style('font-size', '11px')
                .style('font-weight', '600')
                .style('fill', '#e85d04')
                .text(`${(year2024Data.population / 1e9).toFixed(2)}B`);

            // 2026 endpoint (projected - gray)
            const endData = data[data.length - 1];
            g.append('circle')
                .attr('cx', xScale(endData.year))
                .attr('cy', yScale(endData.population))
                .attr('r', 5)
                .attr('fill', '#6b7280')
                .attr('stroke', 'white')
                .attr('stroke-width', 2);

            g.append('text')
                .attr('x', xScale(endData.year) + 10)
                .attr('y', yScale(endData.population))
                .attr('text-anchor', 'start')
                .style('font-size', '12px')
                .style('font-weight', '700')
                .style('fill', '#6b7280')
                .text(`${(endData.population / 1e9).toFixed(2)}B`);

            g.append('text')
                .attr('x', xScale(endData.year) + 10)
                .attr('y', yScale(endData.population) + 15)
                .attr('text-anchor', 'start')
                .style('font-size', '10px')
                .style('font-weight', '500')
                .style('fill', '#9ca3af')
                .text('projected 2026');

            // Add callout for growth rate
            const growthFactor = (endData.population / startData.population).toFixed(1);
            const midYear = 1992;
            const midData = data.find(d => d.year === midYear);

            if (midData) {
                const callout = g.append('g')
                    .attr('class', 'growth-callout')
                    .style('opacity', 0);

                // Position callout above the line with more clearance
                callout.append('rect')
                    .attr('x', xScale(midYear) - 60)
                    .attr('y', yScale(midData.population) - 75)
                    .attr('width', 120)
                    .attr('height', 40)
                    .attr('fill', 'white')
                    .attr('stroke', '#e85d04')
                    .attr('stroke-width', 2)
                    .attr('rx', 5);

                callout.append('text')
                    .attr('x', xScale(midYear))
                    .attr('y', yScale(midData.population) - 57)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '16px')
                    .style('font-weight', '700')
                    .style('fill', '#e85d04')
                    .text(`${growthFactor}×`);

                callout.append('text')
                    .attr('x', xScale(midYear))
                    .attr('y', yScale(midData.population) - 41)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('font-weight', '600')
                    .style('fill', 'var(--text-secondary)')
                    .text('population growth');

                callout.transition()
                    .delay(800)
                    .duration(600)
                    .style('opacity', 1);
            }

            // Add legend for historical vs projected
            const legend = g.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${width - 180}, ${-10})`);

            // Historical line
            legend.append('line')
                .attr('x1', 0)
                .attr('x2', 30)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', '#e85d04')
                .attr('stroke-width', 3);

            legend.append('text')
                .attr('x', 35)
                .attr('y', 4)
                .style('font-size', '12px')
                .style('font-weight', '500')
                .style('fill', 'var(--text-primary)')
                .text('Historical (1960-2024)');

            // Projected line
            legend.append('line')
                .attr('x1', 0)
                .attr('x2', 30)
                .attr('y1', 20)
                .attr('y2', 20)
                .attr('stroke', '#6b7280')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '8,4');

            legend.append('text')
                .attr('x', 35)
                .attr('y', 24)
                .style('font-size', '12px')
                .style('font-weight', '500')
                .style('fill', 'var(--text-primary)')
                .text('Projected (2025-2026)');

            // Add tooltip
            const tooltip = d3.select('body').append('div')
                .attr('class', 'viz-tooltip')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('background', 'white')
                .style('border', '1px solid #ddd')
                .style('border-radius', '4px')
                .style('padding', '8px 12px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

            // Add invisible overlay for tooltip interaction
            const bisect = d3.bisector(d => d.year).left;

            g.append('rect')
                .attr('width', width)
                .attr('height', height)
                .style('fill', 'none')
                .style('pointer-events', 'all')
                .on('mousemove', function(event) {
                    const [mouseX] = d3.pointer(event, this);
                    const year = Math.round(xScale.invert(mouseX));
                    const index = bisect(data, year);
                    const d = data[index];

                    if (d) {
                        tooltip.transition().duration(200).style('opacity', 1);
                        tooltip.html(`
                            <strong>${d.year}</strong><br/>
                            Population: <strong>${(d.population / 1e9).toFixed(2)} billion</strong>
                        `)
                            .style('left', (event.pageX + 15) + 'px')
                            .style('top', (event.pageY - 28) + 'px');
                    }
                })
                .on('mouseout', function() {
                    tooltip.transition().duration(200).style('opacity', 0);
                });

            console.log('[UrbanPop] Visualization rendered successfully');
        })
        .catch(error => {
            console.error('[UrbanPop] Error loading data:', error);
            container.innerHTML = `<p style="color: red; padding: 20px;">Error loading urban population data: ${error.message}</p>`;
        });
}

function handleUrbanPopResize() {
    if (urbanPopResizeTimeout) {
        clearTimeout(urbanPopResizeTimeout);
    }
    
    urbanPopResizeTimeout = setTimeout(() => {
        if (urbanPopData) {
            const container = document.querySelector('#viz-urban-population');
            if (container) {
                initializeUrbanPopulationViz(urbanPopData);
            }
        }
    }, 250);
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUrbanPopulationViz);
} else {
    // DOM already loaded
    setTimeout(initializeUrbanPopulationViz, 100);
}
