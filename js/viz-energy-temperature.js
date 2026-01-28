/**
 * viz-energy-temperature.js
 * Energy Consumption vs Temperature Visualization
 * Shows the relationship between electricity consumption and temperature
 */

function initializeEnergyTemperatureViz() {
    const container = d3.select('#viz-energy-temperature');
    
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
        .text('Loading energy consumption and temperature data...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Load data
    fetch('data/json/energy_temperature.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load energy data`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.data || data.data.length === 0) {
                throw new Error('No data available');
            }
            
            createEnergyTemperatureChart(data.data, data.metadata, container, loadingMsg);
        })
        .catch(error => {
            console.error('[Energy Temperature] Error:', error);
            loadingMsg.html(`
                <p style="color: #e53e3e; margin-bottom: 10px; font-weight: 600;">Error loading data</p>
                <p style="color: #718096; font-size: 14px;">${error.message}</p>
                <button onclick="initializeEnergyTemperatureViz()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Retry
                </button>
            `);
        });
}

function createEnergyTemperatureChart(data, metadata, container, loadingMsg) {
    // Parse dates
    const parsedData = data.map(d => ({
        date: new Date(d.date),
        month: d.month,
        year: d.year,
        electricity: d.electricity_gwh,
        temperature: d.temperature_c
    }));
    
    // Set up dimensions - responsive
    const containerWidth = container.node().getBoundingClientRect().width;
    const isMobile = containerWidth < 768;
    const margin = { 
        top: 20, 
        right: isMobile ? 40 : 80, 
        bottom: 60, 
        left: isMobile ? 50 : 80 
    };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG - responsive
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('max-width', '100%')
        .style('overflow', 'visible');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(parsedData, d => d.date))
        .range([0, width]);
    
    const yEnergyScale = d3.scaleLinear()
        .domain(d3.extent(parsedData, d => d.electricity))
        .nice()
        .range([height, 0]);
    
    const yTempScale = d3.scaleLinear()
        .domain(d3.extent(parsedData, d => d.temperature))
        .nice()
        .range([height, 0]);
    
    // Line generators
    const energyLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yEnergyScale(d.electricity))
        .curve(d3.curveMonotoneX);
    
    const tempLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yTempScale(d.temperature))
        .curve(d3.curveMonotoneX);
    
    // Add energy line (left axis)
    const energyColor = '#3182ce';
    g.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', energyColor)
        .attr('stroke-width', 2.5)
        .attr('d', energyLine);
    
    // Add temperature line (right axis)
    const tempColor = '#e53e3e';
    g.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', tempColor)
        .attr('stroke-width', 2.5)
        .attr('d', tempLine);
    
    // Add dots for energy - with touch support
    g.selectAll('.energy-dot')
        .data(parsedData)
        .enter()
        .append('circle')
        .attr('class', 'energy-dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yEnergyScale(d.electricity))
        .attr('r', isMobile ? 4 : 3)
        .attr('fill', energyColor)
        .attr('opacity', 0.7)
        .on('mouseenter', function(event, d) {
            showTooltip(event, d, 'energy');
        })
        .on('touchstart', function(event, d) {
            event.preventDefault();
            const touch = event.touches[0];
            showTooltip({ pageX: touch.pageX, pageY: touch.pageY }, d, 'energy');
        })
        .on('mouseleave', hideTooltip)
        .on('touchend', function() {
            setTimeout(() => hideTooltip(), 2000);
        });
    
    // Add dots for temperature - with touch support
    g.selectAll('.temp-dot')
        .data(parsedData)
        .enter()
        .append('circle')
        .attr('class', 'temp-dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yTempScale(d.temperature))
        .attr('r', isMobile ? 4 : 3)
        .attr('fill', tempColor)
        .attr('opacity', 0.7)
        .on('mouseenter', function(event, d) {
            showTooltip(event, d, 'temp');
        })
        .on('touchstart', function(event, d) {
            event.preventDefault();
            const touch = event.touches[0];
            showTooltip({ pageX: touch.pageX, pageY: touch.pageY }, d, 'temp');
        })
        .on('mouseleave', hideTooltip)
        .on('touchend', function() {
            setTimeout(() => hideTooltip(), 2000);
        });
    
    // Responsive font sizes
    const axisFontSize = isMobile ? '10px' : '11px';
    const labelFontSize = isMobile ? '12px' : '13px';
    
    // X axis - fewer ticks on mobile
    const xTicks = isMobile ? d3.timeMonth.every(6) : d3.timeMonth.every(3);
    const xAxis = d3.axisBottom(xScale)
        .ticks(xTicks)
        .tickFormat(d3.timeFormat(isMobile ? '%b %y' : '%b %Y'));
    
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', axisFontSize);
    
    // Left Y axis (Energy) - fewer ticks on mobile
    const yEnergyTicks = isMobile ? 4 : 6;
    const yEnergyAxis = d3.axisLeft(yEnergyScale)
        .ticks(yEnergyTicks)
        .tickFormat(d => `${d.toLocaleString()} GWh`);
    
    g.append('g')
        .call(yEnergyAxis)
        .style('color', energyColor)
        .selectAll('text')
        .style('fill', energyColor)
        .style('font-size', axisFontSize)
        .style('font-weight', '500');
    
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', isMobile ? -45 : -60)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', energyColor)
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .text(isMobile ? `Electricity (${metadata.unit_energy})` : `Electricity Consumption (${metadata.unit_energy})`);
    
    // Right Y axis (Temperature) - fewer ticks on mobile
    const yTempTicks = isMobile ? 4 : 6;
    const yTempAxis = d3.axisRight(yTempScale)
        .ticks(yTempTicks)
        .tickFormat(d => `${d.toFixed(1)}°C`);
    
    g.append('g')
        .attr('transform', `translate(${width},0)`)
        .call(yTempAxis)
        .style('color', tempColor)
        .selectAll('text')
        .style('fill', tempColor)
        .style('font-size', axisFontSize)
        .style('font-weight', '500');
    
    g.append('text')
        .attr('transform', `translate(${width + (isMobile ? 40 : 50)}, ${height / 2}) rotate(90)`)
        .attr('text-anchor', 'middle')
        .style('fill', tempColor)
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .text(`Temperature (${metadata.unit_temperature})`);
    
    // Grid lines
    g.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(3))
            .tickSize(-height)
            .tickFormat(''))
        .style('stroke', 'var(--border-light)')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    
    // Legend - responsive positioning
    const legendX = isMobile ? width - 150 : width - 200;
    const legend = g.append('g')
        .attr('transform', `translate(${legendX}, 20)`);
    
    const legendItems = [
        { label: isMobile ? 'Electricity' : 'Electricity Consumption', color: energyColor },
        { label: 'Temperature', color: tempColor }
    ];
    
    const legendFontSize = isMobile ? '11px' : '12px';
    legendItems.forEach((item, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);
        
        legendItem.append('line')
            .attr('x1', 0)
            .attr('x2', 20)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', item.color)
            .attr('stroke-width', 2.5);
        
        legendItem.append('text')
            .attr('x', 25)
            .attr('y', 4)
            .style('fill', 'var(--text-primary)')
            .style('font-size', legendFontSize)
            .style('font-weight', '500')
            .text(item.label);
    });
    
    // Tooltip - mobile-friendly
    const tooltip = container.append('div')
        .attr('class', 'energy-temp-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'var(--bg-overlay)')
        .style('color', 'var(--text-primary)')
        .style('padding', isMobile ? '10px 14px' : '10px 14px')
        .style('border-radius', '8px')
        .style('font-size', labelFontSize)
        .style('opacity', 0)
        .style('transition', 'opacity 0.2s')
        .style('z-index', '10')
        .style('box-shadow', 'var(--shadow-lg)')
        .style('border', '1px solid var(--border-medium)')
        .style('max-width', isMobile ? '90%' : 'none');
    
    function showTooltip(event, d, type) {
        const [x, y] = d3.pointer(event, container.node());
        const dateStr = d3.timeFormat(isMobile ? '%b %Y' : '%B %Y')(d.date);
        
        const tooltipX = isMobile ? containerWidth / 2 : (x + 15);
        const tooltipY = isMobile ? (y - 100) : (y - 10);
        const tooltipLeft = isMobile ? '50%' : (tooltipX + 'px');
        const tooltipTransform = isMobile ? 'translate(-50%, 0)' : 'none';
        
        tooltip
            .html(`
                <div style="font-weight: 600; margin-bottom: 6px; font-size: ${isMobile ? '11px' : '12px'};">${dateStr}</div>
                <div style="margin-bottom: 4px;">
                    <span style="color: ${energyColor}; font-weight: 600;">Energy:</span> 
                    <span>${d.electricity.toLocaleString()} ${metadata.unit_energy}</span>
                </div>
                <div>
                    <span style="color: ${tempColor}; font-weight: 600;">Temperature:</span> 
                    <span>${d.temperature.toFixed(1)}${metadata.unit_temperature}</span>
                </div>
            `)
            .style('left', tooltipLeft)
            .style('top', tooltipY + 'px')
            .style('transform', tooltipTransform)
            .style('opacity', 1);
    }
    
    function hideTooltip() {
        tooltip.style('opacity', 0);
    }
    
    // Remove loading message
    loadingMsg.remove();
}
