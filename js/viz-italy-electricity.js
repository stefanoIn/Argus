/**
 * viz-italy-electricity.js
 * Italy Electricity Consumption and Temperature - Small Multiples
 * Two stacked panels showing electricity and temperature with shared time axis
 * Panel A: Electricity consumption (TWh)
 * Panel B: Average temperature (°C)
 */

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
            
            createSmallMultiplesChart(electricityData, temperatureData, container, loadingMsg);
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
    
    // Set up dimensions
    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
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
        .domain(d3.extent(parsedData, d => d.consumption))
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
    
    // Electricity line
    const elecLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yElecScale(d.consumption))
        .curve(d3.curveMonotoneX);
    
    panelAG.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', '#3182ce')
        .attr('stroke-width', 2.5)
        .attr('d', elecLine);
    
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
        .attr('y', -60)
        .attr('x', -panelHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#3182ce')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text('Electricity Consumption (TWh)');
    
    // Panel label
    panelAG.append('text')
        .attr('x', width - 5)
        .attr('y', 15)
        .attr('text-anchor', 'end')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .text('Panel A');
    
    // Find and annotate July peaks
    const julyData = parsedData.filter(d => d.month === 7);
    const maxJulyElec = d3.max(julyData, d => d.consumption);
    const peakJuly = julyData.find(d => d.consumption === maxJulyElec);
    
    if (peakJuly) {
        const peakX = xScale(peakJuly.date);
        const peakY = yElecScale(peakJuly.consumption);
        
        // Thin annotation line
        panelAG.append('line')
            .attr('x1', peakX)
            .attr('x2', peakX)
            .attr('y1', peakY)
            .attr('y2', peakY - 20)
            .attr('stroke', '#4a5568')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.6);
        
        // Annotation text
        panelAG.append('text')
            .attr('x', peakX)
            .attr('y', peakY - 25)
            .attr('text-anchor', 'middle')
            .style('fill', '#4a5568')
            .style('font-size', '10px')
            .style('font-weight', '500')
            .text('Peak');
    }
    
    // Panel B: Temperature
    const panelBY = panelHeight + panelGap;
    const panelBG = g.append('g')
        .attr('class', 'panel-b')
        .attr('transform', `translate(0, ${panelBY})`);
    
    const yTempScale = d3.scaleLinear()
        .domain(d3.extent(parsedData, d => d.temperature))
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
    
    // Temperature line
    const tempLine = d3.line()
        .x(d => xScale(d.date))
        .y(d => yTempScale(d.temperature))
        .curve(d3.curveMonotoneX);
    
    panelBG.append('path')
        .datum(parsedData)
        .attr('fill', 'none')
        .attr('stroke', '#e53e3e')
        .attr('stroke-width', 2.5)
        .attr('d', tempLine);
    
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
        .attr('y', -60)
        .attr('x', -panelHeight / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#e53e3e')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .text('Average Temperature (°C)');
    
    // Panel label
    panelBG.append('text')
        .attr('x', width - 5)
        .attr('y', 15)
        .attr('text-anchor', 'end')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .text('Panel B');
    
    // Find and annotate July peaks for temperature
    const maxJulyTemp = d3.max(julyData, d => d.temperature);
    const peakJulyTemp = julyData.find(d => d.temperature === maxJulyTemp);
    
    if (peakJulyTemp) {
        const peakX = xScale(peakJulyTemp.date);
        const peakY = yTempScale(peakJulyTemp.temperature);
        
        // Thin annotation line
        panelBG.append('line')
            .attr('x1', peakX)
            .attr('x2', peakX)
            .attr('y1', peakY)
            .attr('y2', peakY - 20)
            .attr('stroke', '#4a5568')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2')
            .attr('opacity', 0.6);
        
        // Annotation text
        panelBG.append('text')
            .attr('x', peakX)
            .attr('y', peakY - 25)
            .attr('text-anchor', 'middle')
            .style('fill', '#4a5568')
            .style('font-size', '10px')
            .style('font-weight', '500')
            .text('Peak');
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
        .attr('y', panelHeight + 50)
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
    loadingMsg.remove();
}
