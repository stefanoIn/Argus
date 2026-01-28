/**
 * viz-work-hours-lost.js
 * Global Potential Work Hours Lost Due to Heat (1990-2024)
 * Data: Lancet Countdown 2025
 */

let workHoursLostData = null;
let workHoursLostResizeTimeout = null;

function initializeWorkHoursLostViz() {
    const container = d3.select('#viz-work-hours-lost');
    
    if (container.empty()) {
        console.warn('[WorkHoursLost] Container not found');
        return;
    }
    
    fetch('data/json/global_potential_work_hours_lost.json')
        .then(response => response.json())
        .then(data => {
            workHoursLostData = data;
            createWorkHoursLostChart(data, container);
            
            // Add resize listener
            window.addEventListener('resize', handleWorkHoursLostResize);
        })
        .catch(error => {
            console.error('[WorkHoursLost] Error loading data:', error);
            container.html(`<p style="color: red; padding: 20px;">Error loading data: ${error.message}</p>`);
        });
}

function createWorkHoursLostChart(data, container) {
    container.selectAll('*').remove();
    
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const isMobile = containerWidth < 768;
    
    // Responsive margins - smaller on mobile
    const margin = { 
        top: 40, 
        right: isMobile ? 40 : 220, 
        bottom: isMobile ? 120 : 60, // Extra space for legend on mobile
        left: isMobile ? 50 : 90 
    };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 340;
    
    // Calculate total SVG dimensions
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;
    
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('max-width', '100%');
    
    // Subtitle - responsive font size
    const subtitleFontSize = isMobile ? '11px' : '13px';
    svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', subtitleFontSize)
        .style('fill', 'var(--text-secondary)')
        .style('font-weight', '400')
        .text('Global work hours lost to heat by sector, 1990–2024 | Data: Lancet Countdown 2025');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Build totals by sector (hours lost)
    // Using distinct colors: orange, red, blue, purple
    const seriesKeys = [
        { key: 'WHL400sunAgr', label: 'Agriculture (sun)', color: '#f97316' }, // Distinct orange
        { key: 'WHL400sunConstr', label: 'Construction (sun)', color: '#dc2626' }, // Red (distinct from orange)
        { key: 'WHL300Manuf', label: 'Manufacturing', color: '#2563eb' }, // Blue
        { key: 'WHL200Serv', label: 'Services', color: '#9333ea' } // Purple
    ];
    
    const maxYear = d3.max(data, d => d.Year);
    const latest = data.find(d => d.Year === maxYear) || data[data.length - 1];
    const first = data[0];
    const increasePct = first && latest ? (((latest.TotalSunWHLpp - first.TotalSunWHLpp) / first.TotalSunWHLpp) * 100) : 0;
    
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Year))
        .range([0, width]);
    
    const stacked = d3.stack()
        .keys(seriesKeys.map(s => s.key))
        .value((d, key) => Number(d[key]) || 0)(data);
    
    const maxTotal = d3.max(data, d => seriesKeys.reduce((acc, s) => acc + (Number(d[s.key]) || 0), 0)) || 0;
    const yScale = d3.scaleLinear()
        .domain([0, maxTotal * 1.08])
        .nice()
        .range([height, 0]);
    
    const area = d3.area()
        .x(d => xScale(d.data.Year))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveMonotoneX);
    
    // Grid
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-width)
            .tickFormat(''))
        .style('stroke', 'var(--border-light)')
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.35);
    
    // Stacked areas with hover effects
    g.selectAll('.layer')
        .data(stacked)
        .enter()
        .append('path')
        .attr('class', 'layer')
        .attr('d', area)
        .attr('fill', (d, i) => seriesKeys[i].color)
        .attr('opacity', 0.35)
        .attr('stroke', (d, i) => seriesKeys[i].color)
        .attr('stroke-width', 1.2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d, i) {
            d3.select(this)
                .attr('opacity', 0.6)
                .attr('stroke-width', 2);
        })
        .on('mouseout', function() {
            d3.select(this)
                .attr('opacity', 0.35)
                .attr('stroke-width', 1.2);
        });
    
    // Axes - responsive tick count
    const xTicks = isMobile ? 6 : 8;
    const axisFontSize = isMobile ? '10px' : '11px';
    
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(xTicks))
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('font-size', axisFontSize);
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => {
            if (d >= 1e9) return (d / 1e9).toFixed(0) + 'B';
            if (d >= 1e6) return (d / 1e6).toFixed(0) + 'M';
            return d3.format(',.0f')(d);
        }))
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('font-size', axisFontSize);
    
    // Labels - responsive font sizes
    const labelFontSize = isMobile ? '12px' : '14px';
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text('Year');
    
    // Y-axis label - shorter on mobile
    const yLabelText = isMobile ? 'Work hours lost' : 'Work hours lost (global, by sector)';
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', isMobile ? -40 : -65)
        .attr('text-anchor', 'middle')
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text(yLabelText);
    
    // Legend - positioned right on desktop, below on mobile
    const legendFontSize = isMobile ? '10px' : '11px';
    const legendItemHeight = isMobile ? 18 : 20;
    
    if (isMobile) {
        // Mobile: legend below chart, centered
        const legend = g.append('g')
            .attr('transform', `translate(${width / 2}, ${height + 30})`);
        
        // Reverse the seriesKeys array to show top layer first in legend
        const legendOrder = [...seriesKeys].reverse();
        
        // Create two columns for mobile
        const itemsPerColumn = Math.ceil(legendOrder.length / 2);
        const columnWidth = width / 2;
        
        legendOrder.forEach((s, i) => {
            const col = Math.floor(i / itemsPerColumn);
            const row = i % itemsPerColumn;
            const item = legend.append('g')
                .attr('transform', `translate(${col * columnWidth - columnWidth / 2}, ${row * legendItemHeight})`);
            
            item.append('rect')
                .attr('x', -60).attr('y', -7)
                .attr('width', 12).attr('height', 8)
                .attr('fill', s.color)
                .attr('opacity', 0.6);
            item.append('text')
                .attr('x', -45).attr('y', 0)
                .style('font-size', legendFontSize)
                .style('fill', 'var(--text-primary)')
                .style('text-anchor', 'start')
                .text(s.label);
        });
        
        // Per-person headline below legend
        const headlineY = itemsPerColumn * legendItemHeight + 20;
        legend.append('text')
            .attr('x', 0)
            .attr('y', headlineY)
            .attr('text-anchor', 'middle')
            .style('font-size', legendFontSize)
            .style('fill', 'var(--text-secondary)')
            .text('Per person (latest year):');
        
        const headlineText = legend.append('text')
            .attr('x', 0)
            .attr('y', headlineY + 18)
            .attr('text-anchor', 'middle')
            .style('font-size', isMobile ? '12px' : '14px')
            .style('font-weight', '700')
            .style('fill', 'var(--text-primary)');
        
        headlineText.append('tspan')
            .attr('x', 0)
            .text(`${latest.TotalSunWHLpp} hrs`);
        
        headlineText.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .text(`(${increasePct >= 0 ? '+' : ''}${increasePct.toFixed(0)}% since 1990)`);
    } else {
        // Desktop: legend on right side
        const legend = g.append('g')
            .attr('transform', `translate(${width + 20}, 10)`);
        
        // Reverse the seriesKeys array to show top layer first in legend
        const legendOrder = [...seriesKeys].reverse();
        
        legendOrder.forEach((s, i) => {
            const item = legend.append('g').attr('transform', `translate(0, ${i * legendItemHeight})`);
            item.append('rect')
                .attr('x', 0).attr('y', -9)
                .attr('width', 14).attr('height', 10)
                .attr('fill', s.color)
                .attr('opacity', 0.6);
            item.append('text')
                .attr('x', 18).attr('y', 0)
                .style('font-size', legendFontSize)
                .style('fill', 'var(--text-primary)')
                .text(s.label);
        });
        
        // Per-person headline
        legend.append('text')
            .attr('x', 0)
            .attr('y', seriesKeys.length * legendItemHeight + 20)
            .style('font-size', legendFontSize)
            .style('fill', 'var(--text-secondary)')
            .text('Per person (latest year):');
        
        const headlineText = legend.append('text')
            .attr('x', 0)
            .attr('y', seriesKeys.length * legendItemHeight + 38)
            .style('font-size', '14px')
            .style('font-weight', '700')
            .style('fill', 'var(--text-primary)')
            .attr('text-anchor', 'start');
        
        headlineText.append('tspan')
            .attr('x', 0)
            .text(`${latest.TotalSunWHLpp} hrs`);
        
        headlineText.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .text(`(${increasePct >= 0 ? '+' : ''}${increasePct.toFixed(0)}% since 1990)`);
    }
    
    // Tooltip (reuse to avoid duplicates) - mobile-friendly
    d3.select('body').selectAll('.viz-tooltip-workhours').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-workhours')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'var(--bg-overlay)')
        .style('border', '1px solid var(--border-medium)')
        .style('border-radius', '8px')
        .style('padding', isMobile ? '10px 14px' : '8px 12px')
        .style('font-size', isMobile ? '12px' : '13px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('touch-action', 'none'); // Prevent scrolling when touching tooltip
    
    const bisect = d3.bisector(d => d.Year).left;
    
    // Function to show tooltip
    const showTooltip = function(event, d) {
        if (!d) return;
        
        // Calculate total and percentages for each sector
        const total = seriesKeys.reduce((sum, s) => sum + (Number(d[s.key]) || 0), 0);
        const parts = seriesKeys.map(s => {
            const value = Number(d[s.key]) || 0;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `<span style="color: ${s.color}; font-weight: 600;">${s.label}:</span> ${value.toLocaleString()} (${pct}%)`;
        });
        
        const tooltipFontSize = isMobile ? '12px' : '13px';
        const tooltipTitleSize = isMobile ? '13px' : '14px';
        
        // Position tooltip - adjust for mobile
        const tooltipX = isMobile ? containerWidth / 2 : (event.pageX + 10);
        const tooltipY = isMobile ? (event.pageY - 100) : (event.pageY - 60);
        const tooltipLeft = isMobile ? '50%' : (tooltipX + 'px');
        const tooltipTransform = isMobile ? 'translate(-50%, 0)' : 'none';
        
        tooltip
            .style('visibility', 'visible')
            .style('top', tooltipY + 'px')
            .style('left', tooltipLeft)
            .style('transform', tooltipTransform)
            .style('max-width', isMobile ? '90%' : 'none')
            .style('font-size', tooltipFontSize)
            .html(`<strong style="font-size: ${tooltipTitleSize};">${d.Year}</strong><br/><div style="margin-top: 6px;">${parts.join('<br/>')}</div><div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-light); font-weight: 600;">Total: ${total.toLocaleString()} hours</div>`);
    };
    
    g.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mousemove', function(event) {
            const [mx] = d3.pointer(event);
            const year = Math.round(xScale.invert(mx));
            const idx = bisect(data, year);
            const d = data[Math.min(Math.max(idx, 0), data.length - 1)];
            showTooltip(event, d);
        })
        .on('touchmove', function(event) {
            event.preventDefault();
            const touch = event.touches[0];
            const [mx] = d3.pointer(touch, this);
            const year = Math.round(xScale.invert(mx));
            const idx = bisect(data, year);
            const d = data[Math.min(Math.max(idx, 0), data.length - 1)];
            showTooltip({ pageX: touch.pageX, pageY: touch.pageY }, d);
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
        })
        .on('touchend', function() {
            // Keep tooltip visible on touch end for mobile users to read
            setTimeout(() => {
                tooltip.style('visibility', 'hidden');
            }, 2000);
        });
}

function handleWorkHoursLostResize() {
    if (workHoursLostResizeTimeout) {
        clearTimeout(workHoursLostResizeTimeout);
    }
    
    workHoursLostResizeTimeout = setTimeout(() => {
        if (workHoursLostData) {
            const container = d3.select('#viz-work-hours-lost');
            if (!container.empty()) {
                createWorkHoursLostChart(workHoursLostData, container);
            }
        }
    }, 250);
}
