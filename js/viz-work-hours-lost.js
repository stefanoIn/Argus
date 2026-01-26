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
    const margin = { top: 40, right: 220, bottom: 60, left: 90 }; // Increased right margin for callout text
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 340;
    
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    // Subtitle
    svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
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
    
    // Axes
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8))
        .style('color', 'var(--text-secondary)');
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => {
            if (d >= 1e9) return (d / 1e9).toFixed(0) + 'B';
            if (d >= 1e6) return (d / 1e6).toFixed(0) + 'M';
            return d3.format(',.0f')(d);
        }))
        .style('color', 'var(--text-secondary)');
    
    // Labels
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text('Year');
    
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -65)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text('Work hours lost (global, by sector)');
    
    // Right-side legend - ordered from top to bottom (matching visual stack order)
    const legend = g.append('g')
        .attr('transform', `translate(${width + 20}, 10)`);
    
    // Reverse the seriesKeys array to show top layer first in legend
    const legendOrder = [...seriesKeys].reverse();
    
    legendOrder.forEach((s, i) => {
        const item = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
        item.append('rect')
            .attr('x', 0).attr('y', -9)
            .attr('width', 14).attr('height', 10)
            .attr('fill', s.color)
            .attr('opacity', 0.6);
        item.append('text')
            .attr('x', 18).attr('y', 0)
            .style('font-size', '11px')
            .style('fill', 'var(--text-primary)')
            .text(s.label);
    });
    
    // Per-person headline (not another line plot)
    legend.append('text')
        .attr('x', 0)
        .attr('y', seriesKeys.length * 20 + 20)
        .style('font-size', '11px')
        .style('fill', 'var(--text-secondary)')
        .text('Per person (latest year):');
    
    // Display the full text, breaking into two lines if needed
    const headlineText = legend.append('text')
        .attr('x', 0)
        .attr('y', seriesKeys.length * 20 + 38)
        .style('font-size', '14px')
        .style('font-weight', '700')
        .style('fill', 'var(--text-primary)')
        .attr('text-anchor', 'start');
    
    // First line: hours
    headlineText.append('tspan')
        .attr('x', 0)
        .text(`${latest.TotalSunWHLpp} hrs`);
    
    // Second line: percentage change
    headlineText.append('tspan')
        .attr('x', 0)
        .attr('dy', '1.2em')
        .text(`(${increasePct >= 0 ? '+' : ''}${increasePct.toFixed(0)}% since 1990)`);
    
    // Tooltip (reuse to avoid duplicates)
    d3.select('body').selectAll('.viz-tooltip-workhours').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-workhours')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'var(--bg-overlay)')
        .style('border', '1px solid var(--border-medium)')
        .style('border-radius', '8px')
        .style('padding', '8px 12px')
        .style('font-size', '13px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('pointer-events', 'none')
        .style('z-index', '1000');
    
    const bisect = d3.bisector(d => d.Year).left;
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
            if (!d) return;
            
            // Calculate total and percentages for each sector
            const total = seriesKeys.reduce((sum, s) => sum + (Number(d[s.key]) || 0), 0);
            const parts = seriesKeys.map(s => {
                const value = Number(d[s.key]) || 0;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `<span style="color: ${s.color}; font-weight: 600;">${s.label}:</span> ${value.toLocaleString()} (${pct}%)`;
            });
            
            tooltip
                .style('visibility', 'visible')
                .style('top', (event.pageY - 60) + 'px')
                .style('left', (event.pageX + 10) + 'px')
                .html(`<strong style="font-size: 14px;">${d.Year}</strong><br/><div style="margin-top: 6px;">${parts.join('<br/>')}</div><div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-light); font-weight: 600;">Total: ${total.toLocaleString()} hours</div>`);
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
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
