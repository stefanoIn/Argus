/**
 * viz-italy-electricity.js
 * Italy Electricity Consumption and Temperature - Small Multiples
 * Two stacked panels showing electricity and temperature with shared time axis
 * Panel A: Electricity consumption (TWh)
 * Panel B: Average temperature (°C)
 */

// Store data globally for resize
let italyElectricityData = null;
let italyTemperatureData = null;
let italyElecResizeTimeout = null;

function initializeItalyElectricityViz() {
    const container = d3.select('#viz-italy-electricity');
    
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    // Set container positioning
    container.style('position', 'relative')
        .style('min-height', '600px')
        .style('width', '100%')
        .style('display', 'block');
    
    // Create loading message
    const loadingMsg = container.append('div')
        .style('text-align', 'center')
        .style('padding', '60px 20px')
        .style('color', '#4a5568')
        .style('min-height', '600px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('justify-content', 'center');
    
    loadingMsg.append('p')
        .text('Loading Italy electricity consumption and temperature data...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Load both datasets in parallel
    Promise.all([
        fetch('data/electricity_consumption_italy/electricity_italy_monthly_consumption_mwh_2021_2025.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load electricity data`);
                return response.json();
            }),
        fetch('data/average_monthly_temperature_ERA5/italy_monthly_avg_temperature_c_2021_2025.json')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load temperature data`);
                return response.json();
            })
    ])
        .then(([electricityData, temperatureData]) => {
            if (!electricityData || electricityData.length === 0) {
                throw new Error('No electricity data available');
            }
            if (!temperatureData || temperatureData.length === 0) {
                throw new Error('No temperature data available');
            }
            
            // Store data for resize
            italyElectricityData = electricityData;
            italyTemperatureData = temperatureData;
            
            createSmallMultiplesChart(electricityData, temperatureData, container, loadingMsg);
            
            // Add resize listener
            window.addEventListener('resize', handleItalyElecResize);
        })
        .catch(error => {
            console.error('[Italy Electricity] Error:', error);
            loadingMsg.html(`
                <p style="color: #e53e3e; margin-bottom: 10px; font-weight: 600;">Error loading data</p>
                <p style="color: #718096; font-size: 14px;">${error.message}</p>
                <button onclick="initializeItalyElectricityViz()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                    Retry
                </button>
            `);
        });
}

function handleItalyElecResize() {
    if (italyElecResizeTimeout) {
        clearTimeout(italyElecResizeTimeout);
    }
    
    italyElecResizeTimeout = setTimeout(() => {
        if (italyElectricityData && italyTemperatureData) {
            const container = d3.select('#viz-italy-electricity');
            if (!container.empty()) {
                container.selectAll('*').remove();
                createSmallMultiplesChart(italyElectricityData, italyTemperatureData, container, null);
            }
        }
    }, 250);
}

function createSmallMultiplesChart(electricityData, temperatureData, container, loadingMsg) {
    // Create maps for easy lookup
    const tempMap = new Map();
    temperatureData.forEach(d => {
        const key = `${d.year}-${d.month}`;
        tempMap.set(key, d.avg_temp_c);
    });
    
    // Parse dates and merge data
    const parsedData = electricityData.map(d => {
        const date = new Date(d.year, d.month - 1, 1);
        const key = `${d.year}-${d.month}`;
        const temperature = tempMap.get(key);
        
        return {
            date: date,
            year: d.year,
            month: d.month,
            consumption: d.total_consumption_twh,
            temperature: temperature !== undefined ? temperature : null
        };
    }).filter(d => d.temperature !== null);
    
    // Sort by date
    parsedData.sort((a, b) => a.date - b.date);
    
    // Set up dimensions - increased margins to prevent overlap
    const margin = { top: 20, right: 100, bottom: 80, left: 100 };
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = Math.max(1000, containerWidth) - margin.left - margin.right;
    const panelGap = 20;
    const panelHeight = 250;
    const totalHeight = (panelHeight * 2) + panelGap + margin.top + margin.bottom;
    
    // Create SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', totalHeight)
        .style('overflow', 'visible');
    
    // Add descriptive subtitle with data context
    svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#6b7280')
        .style('font-weight', '400')
        .text('Monthly electricity consumption (TWh) and average temperature (°C) in Italy, 2021–2025 | Data: Terna & ERA5-Copernicus');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Shared x-scale
    const xScale = d3.scaleTime()
        .domain(d3.extent(parsedData, d => d.date))
        .range([0, width]);
    
    // Panel A: Electricity Consumption
    const panelAY = 0;
    const panelAG = g.append('g')
        .attr('class', 'panel-a')
        .attr('transform', `translate(0, ${panelAY})`);
    
    const yElecScale = d3.scaleLinear()
        .domain([0, d3.max(parsedData, d => d.consumption)])
        .nice()
        .range([panelHeight, 0]);
    
    // Summer shading for Panel A
    parsedData.forEach(d => {
        if (d.month >= 6 && d.month <= 8) {
            const x = xScale(d.date);
            const nextDate = new Date(d.date);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextX = xScale(nextDate);
            const rectWidth = nextX - x;
            
            panelAG.append('rect')
                .attr('x', x)
                .attr('y', 0)
                .attr('width', rectWidth)
                .attr('height', panelHeight)
                .attr('fill', '#ff6b35')
                .attr('opacity', 0.08);
        }
    });
    
    // Electricity line with animation
    const elecLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yElecScale(d.consumption))
        .curve(d3.curveMonotoneX);
    
    const elecPath = panelAG.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', '#3182ce')
        .attr('stroke-width', 2.5)
        .attr('d', elecLine);
    
    // Store path for animation (will be triggered by IntersectionObserver)
    const elecPathLength = elecPath.node().getTotalLength();
    elecPath
        .attr('stroke-dasharray', `${elecPathLength} ${elecPathLength}`)
        .attr('stroke-dashoffset', elecPathLength)
        .attr('data-animate', 'true');
    
    // Function to animate the line
    function animateElectricityLine() {
        elecPath
            .transition()
            .duration(2000)
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', 0);
    }
    
    // Store animation function on the viz container element
    const vizContainer = document.querySelector('#viz-italy-electricity');
    if (vizContainer) {
        vizContainer._animateElecLine = animateElectricityLine;
    }
    
    // Add circle markers for each data point (electricity)
    const elecCircles = panelAG.selectAll('.elec-circle')
        .data(parsedData)
        .enter()
        .append('circle')
        .attr('class', 'elec-circle')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yElecScale(d.consumption))
        .attr('r', 3)
        .attr('fill', '#3182ce')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('opacity', 0);
    
    // Animate circles to appear after line animation
    function animateElectricityCircles() {
        elecCircles.transition()
            .delay((d, i) => 2000 + (i * 20))
            .duration(300)
            .style('opacity', 1);
    }
    
    // Store circle animation function
    if (vizContainer) {
        vizContainer._animateElecCircles = animateElectricityCircles;
    }
    
    // Y-axis for electricity
    const yElecAxis = d3.axisLeft(yElecScale)
        .ticks(5)
        .tickFormat(d => `${d.toFixed(1)} TWh`);
    
    panelAG.append('g')
        .call(yElecAxis)
        .style('color', '#3182ce')
        .selectAll('text')
        .style('fill', '#3182ce')
        .style('font-size', '11px')
        .style('font-weight', '500');
    
    panelAG.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -75)
        .attr('x', -panelHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#3182ce')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text('Electricity Consumption (TWh)');
    
    // Simplified annotations - only key insights
    // Find the absolute peak across all years (not just summer)
    const maxElec = d3.max(parsedData, d => d.consumption);
    const peakPoint = parsedData.find(d => d.consumption === maxElec);
    
    if (peakPoint) {
        const peakX = xScale(peakPoint.date);
        const peakY = yElecScale(peakPoint.consumption);
        
        const annotation = panelAG.append('g')
            .attr('class', 'annotation peak-annotation')
            .style('opacity', 0);
        
        // Callout circle
        annotation.append('circle')
            .attr('cx', peakX)
            .attr('cy', peakY)
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 2);
        
        // Annotation line
        annotation.append('line')
            .attr('x1', peakX)
            .attr('x2', peakX + 60)
            .attr('y1', peakY)
            .attr('y2', peakY - 40)
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 1.5);
        
        // Annotation text
        annotation.append('text')
            .attr('x', peakX + 65)
            .attr('y', peakY - 42)
            .attr('text-anchor', 'start')
            .style('fill', '#e85d04')
            .style('font-size', '12px')
            .style('font-weight', '700')
            .text('Peak electricity demand');
        
        annotation.append('text')
            .attr('x', peakX + 65)
            .attr('y', peakY - 28)
            .attr('text-anchor', 'start')
            .style('fill', '#718096')
            .style('font-size', '10px')
            .style('font-weight', '500')
            .text('Driven by summer AC use');
        
        annotation.transition()
            .delay(2000)
            .duration(600)
            .style('opacity', 1);
    }
    
    // Panel B: Temperature
    const panelBY = panelHeight + panelGap;
    const panelBG = g.append('g')
        .attr('class', 'panel-b')
        .attr('transform', `translate(0, ${panelBY})`);
    
    const yTempScale = d3.scaleLinear()
        .domain([0, d3.max(parsedData, d => d.temperature)])
        .nice()
        .range([panelHeight, 0]);
    
    // Summer shading for Panel B (same as Panel A)
    parsedData.forEach(d => {
        if (d.month >= 6 && d.month <= 8) {
            const x = xScale(d.date);
            const nextDate = new Date(d.date);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextX = xScale(nextDate);
            const rectWidth = nextX - x;
            
            panelBG.append('rect')
                .attr('x', x)
                .attr('y', 0)
                .attr('width', rectWidth)
                .attr('height', panelHeight)
                .attr('fill', '#ff6b35')
                .attr('opacity', 0.08);
        }
    });
    
    // Temperature line with animation
    const tempLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yTempScale(d.temperature))
        .curve(d3.curveMonotoneX);
    
    const tempPath = panelBG.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', '#e53e3e')
        .attr('stroke-width', 2.5)
        .attr('d', tempLine);
    
    // Store path for animation (will be triggered by IntersectionObserver)
    const tempPathLength = tempPath.node().getTotalLength();
    tempPath
        .attr('stroke-dasharray', `${tempPathLength} ${tempPathLength}`)
        .attr('stroke-dashoffset', tempPathLength)
        .attr('data-animate', 'true');
    
    // Function to animate the line
    function animateTemperatureLine() {
        tempPath
            .transition()
            .duration(2000)
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', 0);
    }
    
    // Store animation function on the viz container element
    const vizContainerTemp = document.querySelector('#viz-italy-electricity');
    if (vizContainerTemp) {
        vizContainerTemp._animateTempLine = animateTemperatureLine;
    }
    
    // Add circle markers for each data point (temperature)
    const tempCircles = panelBG.selectAll('.temp-circle')
        .data(parsedData)
        .enter()
        .append('circle')
        .attr('class', 'temp-circle')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yTempScale(d.temperature))
        .attr('r', 3)
        .attr('fill', '#e53e3e')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('opacity', 0);
    
    // Animate circles to appear after line animation
    function animateTemperatureCircles() {
        tempCircles.transition()
            .delay((d, i) => 2000 + (i * 20))
            .duration(300)
            .style('opacity', 1);
    }
    
    // Store circle animation function
    if (vizContainerTemp) {
        vizContainerTemp._animateTempCircles = animateTemperatureCircles;
    }
    
    // Y-axis for temperature
    const yTempAxis = d3.axisLeft(yTempScale)
        .ticks(5)
        .tickFormat(d => `${d.toFixed(1)}°C`);
    
    panelBG.append('g')
        .call(yTempAxis)
        .style('color', '#e53e3e')
        .selectAll('text')
        .style('fill', '#e53e3e')
        .style('font-size', '11px')
        .style('font-weight', '500');
    
    panelBG.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -75)
        .attr('x', -panelHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#e53e3e')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text('Average Temperature (°C)');
    
    // Simplified temperature annotation - just the peak
    const maxTemp = d3.max(parsedData, d => d.temperature);
    const peakTempPoint = parsedData.find(d => d.temperature === maxTemp);
    
    if (peakTempPoint) {
        const peakX = xScale(peakTempPoint.date);
        const peakY = yTempScale(peakTempPoint.temperature);
        
        const annotation = panelBG.append('g')
            .attr('class', 'annotation peak-annotation')
            .style('opacity', 0);
        
        // Callout circle
        annotation.append('circle')
            .attr('cx', peakX)
            .attr('cy', peakY)
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 2);
        
        // Annotation line
        annotation.append('line')
            .attr('x1', peakX)
            .attr('x2', peakX + 60)
            .attr('y1', peakY)
            .attr('y2', peakY + 40)
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 1.5);
        
        // Annotation text
        annotation.append('text')
            .attr('x', peakX + 65)
            .attr('y', peakY + 44)
            .attr('text-anchor', 'start')
            .style('fill', '#e85d04')
            .style('font-size', '12px')
            .style('font-weight', '700')
            .text('Peak temperature');
        
        annotation.append('text')
            .attr('x', peakX + 65)
            .attr('y', peakY + 58)
            .attr('text-anchor', 'start')
            .style('fill', '#718096')
            .style('font-size', '10px')
            .style('font-weight', '500')
            .text('Summer heat waves');
        
        annotation.transition()
            .delay(2000)
            .duration(600)
            .style('opacity', 1);
    }
    
    // Add visual connector between peak electricity and peak temperature
    if (peakPoint && peakTempPoint && Math.abs(peakPoint.date - peakTempPoint.date) < 90 * 24 * 60 * 60 * 1000) {
        // If peaks are within ~3 months of each other, draw a connection
        const elecPeakX = xScale(peakPoint.date);
        const tempPeakX = xScale(peakTempPoint.date);
        const connectorY = panelHeight + (panelGap / 2);
        
        const connector = g.append('g')
            .attr('class', 'peak-connector')
            .style('opacity', 0);
        
        // Vertical line from electricity peak
        connector.append('line')
            .attr('x1', elecPeakX)
            .attr('y1', panelAY + yElecScale(peakPoint.consumption))
            .attr('x2', elecPeakX)
            .attr('y2', panelAY + connectorY)
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,3')
            .attr('opacity', 0.5);
        
        // Vertical line from temperature peak
        connector.append('line')
            .attr('x1', tempPeakX)
            .attr('y1', panelBY + yTempScale(peakTempPoint.temperature))
            .attr('x2', tempPeakX)
            .attr('y2', panelBY - (panelGap / 2))
            .attr('stroke', '#e85d04')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,3')
            .attr('opacity', 0.5);
        
        connector.transition()
            .delay(2600)
            .duration(600)
            .style('opacity', 1);
    }
    
    // Add annotation for August dip (summer shutdowns)
    const augustData = parsedData.filter(d => d.month === 8);
    if (augustData.length > 0) {
        // Find August with relatively low consumption (use 2024 for clarity)
        const augustPoint = augustData.find(d => d.year === 2024) || augustData[augustData.length - 1];
        
        const augustX = xScale(augustPoint.date);
        const augustY = yElecScale(augustPoint.consumption);
        
        const augustAnnotation = panelAG.append('g')
            .attr('class', 'annotation august-annotation')
            .style('opacity', 0);
        
        // Simple text label with arrow pointing down
        augustAnnotation.append('text')
            .attr('x', augustX)
            .attr('y', augustY - 25)
            .attr('text-anchor', 'middle')
            .style('fill', '#4b5563')
            .style('font-size', '11px')
            .style('font-weight', '700')
            .text('↓ Summer shutdowns');
        
        // Small circle marker on the point
        augustAnnotation.append('circle')
            .attr('cx', augustX)
            .attr('cy', augustY)
            .attr('r', 4)
            .attr('fill', 'none')
            .attr('stroke', '#4b5563')
            .attr('stroke-width', 1.5);
        
        augustAnnotation.transition()
            .delay(2400)
            .duration(600)
            .style('opacity', 1);
    }
    
    // Shared X-axis (only on bottom panel)
    const xAxis = d3.axisBottom(xScale)
        .ticks(d3.timeMonth.every(3))
        .tickFormat(d3.timeFormat('%b %Y'));
    
    panelBG.append('g')
        .attr('transform', `translate(0, ${panelHeight})`)
        .call(xAxis)
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '11px')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end');
    
    panelBG.append('text')
        .attr('x', width / 2)
        .attr('y', panelHeight + 60)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '13px')
        .style('font-weight', '500')
        .text('Time (2021-2025)');
    
    // Grid lines (subtle)
    [panelAG, panelBG].forEach((panel, idx) => {
        const yScale = idx === 0 ? yElecScale : yTempScale;
        panel.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .ticks(5)
                .tickSize(-width)
                .tickFormat(''))
            .style('stroke', 'var(--border-light)')
            .style('stroke-dasharray', '2,2')
            .style('opacity', 0.2);
    });
    
    // Tooltip
    const tooltip = container.append('div')
        .attr('class', 'electricity-tooltip')
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
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Add interactive areas for both panels
    function addInteractiveArea(panelG, yScale, panelY, color, getValue) {
        panelG.selectAll('.interactive-area')
            .data(parsedData)
            .enter()
            .append('rect')
            .attr('class', 'interactive-area')
            .attr('x', d => {
                const x = xScale(d.date);
                const nextDate = new Date(d.date);
                nextDate.setMonth(nextDate.getMonth() + 1);
                return x;
            })
            .attr('y', 0)
            .attr('width', d => {
                const x = xScale(d.date);
                const nextDate = new Date(d.date);
                nextDate.setMonth(nextDate.getMonth() + 1);
                return xScale(nextDate) - x;
            })
            .attr('height', panelHeight)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('mouseenter', function(event, d) {
                const [x, y] = d3.pointer(event, container.node());
                const monthName = monthNames[d.month - 1];
                const value = getValue(d);
                const unit = color === '#3182ce' ? 'TWh' : '°C';
                const formatFunc = color === '#3182ce' ? (v) => v.toFixed(2) : (v) => v.toFixed(1);
                
                tooltip
                    .html(`
                        <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${monthName} ${d.year}</div>
                        <div style="color: ${color}; font-weight: 600; font-size: 16px;">
                            ${formatFunc(value)} ${unit}
                        </div>
                    `)
                    .style('left', (x + 15) + 'px')
                    .style('top', (y - 10) + 'px')
                    .style('opacity', 1);
            })
            .on('mouseleave', function() {
                tooltip.style('opacity', 0);
            });
    }
    
    addInteractiveArea(panelAG, yElecScale, panelAY, '#3182ce', d => d.consumption);
    addInteractiveArea(panelBG, yTempScale, panelBY, '#e53e3e', d => d.temperature);
    
    // Remove loading message
    if (loadingMsg) {
        loadingMsg.remove();
    }
}
