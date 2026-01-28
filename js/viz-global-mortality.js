/**
 * viz-global-mortality.js
 * Global Heat-Related Mortality (1990-2021)
 * Data: Lancet Countdown 2025
 */

let globalMortalityData = null;
let globalMortalityResizeTimeout = null;

function initializeGlobalMortalityViz() {
    const container = d3.select('#viz-global-mortality');
    
    if (container.empty()) {
        console.warn('[GlobalMortality] Container not found');
        return;
    }
    
    fetch('data/json/global_mortality_rate.json')
        .then(response => response.json())
        .then(data => {
            globalMortalityData = data;
            createGlobalMortalityChart(data, container);
            
            // Add resize listener
            window.addEventListener('resize', handleGlobalMortalityResize);
        })
        .catch(error => {
            console.error('[GlobalMortality] Error loading data:', error);
            container.html(`<p style="color: red; padding: 20px;">Error loading data: ${error.message}</p>`);
        });
}

function createGlobalMortalityChart(data, container) {
    container.selectAll('*').remove();
    
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const isMobile = containerWidth < 768;
    
    // Responsive margins
    const margin = { 
        top: 40, 
        right: isMobile ? 30 : 40, 
        bottom: 60, 
        left: isMobile ? 60 : 100 
    };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 340;
    
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
        .attr('x', svgWidth / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', subtitleFontSize)
        .style('fill', 'var(--text-secondary)')
        .style('font-weight', '400')
        .text('Annual heat-related deaths globally, 1990–2021 | Data: Lancet Countdown 2025');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const years = data.map(d => d.Year);
    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.15);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.AN) * 1.12])
        .nice()
        .range([height, 0]);
    
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
    
    // Bars (spikes)
    const barColor = '#ef4444';
    const highlightYear = 2010;
    
    g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.Year))
        .attr('y', d => yScale(d.AN))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - yScale(d.AN))
        .attr('rx', 2)
        .attr('fill', barColor)
        .attr('opacity', d => d.Year === highlightYear ? 0.95 : 0.45);
    
    // 5-year rolling mean (to show baseline vs spikes)
    const windowSize = 5;
    const rolling = data.map((d, i) => {
        const start = Math.max(0, i - windowSize + 1);
        const slice = data.slice(start, i + 1);
        return { Year: d.Year, mean: d3.mean(slice, s => s.AN) };
    });
    
    const line = d3.line()
        .x(d => (xScale(d.Year) || 0) + xScale.bandwidth() / 2)
        .y(d => yScale(d.mean))
        .curve(d3.curveMonotoneX);
    
    g.append('path')
        .datum(rolling)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', 'var(--text-tertiary)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.9);
    
    // Axes - responsive font sizes and tick counts
    const axisFontSize = isMobile ? '10px' : '11px';
    const labelFontSize = isMobile ? '12px' : '14px';
    const xTickInterval = isMobile ? 8 : 4; // Show fewer ticks on mobile
    
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale)
            .tickValues(years.filter((y, i) => i % xTickInterval === 0))
            .tickFormat(d3.format('d')))
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('font-size', axisFontSize);
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => {
            if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
            if (d >= 1e3) return (d / 1e3).toFixed(0) + 'K';
            return d;
        }))
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('font-size', axisFontSize);
    
    // Labels
    g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text('Year');
    
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', isMobile ? -50 : -70)
        .attr('text-anchor', 'middle')
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text(isMobile ? 'Deaths' : 'Annual heat-related deaths');
    
    // Annotation (2010)
    const peak2010 = data.find(d => d.Year === highlightYear);
    if (peak2010) {
        const x = (xScale(peak2010.Year) || 0) + xScale.bandwidth() / 2;
        const y = yScale(peak2010.AN);
        
        g.append('text')
            .attr('x', x)
            .attr('y', y - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('font-weight', '700')
            .style('fill', barColor)
            .text(`2010 spike: ${(peak2010.AN / 1000).toFixed(0)}K`);
    }
    
    // Tooltip (reuse to avoid duplicates) - mobile-friendly
    d3.select('body').selectAll('.viz-tooltip-mortality').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-mortality')
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
        .style('touch-action', 'none');
    
    const showTooltip = function(event, d) {
        d3.select(this).attr('opacity', 0.95);
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
            .html(
                `<strong>${d.Year}</strong>` +
                `<br/>Deaths: ${d.AN.toLocaleString()}` +
                `<br/>Attributable fraction: ${(d.AF * 100).toFixed(0)}%`
            );
    };
    
    g.selectAll('.bar')
        .on('mouseenter', showTooltip)
        .on('touchstart', function(event, d) {
            event.preventDefault();
            const touch = event.touches[0];
            showTooltip.call(this, { pageX: touch.pageX, pageY: touch.pageY }, d);
        })
        .on('mousemove', function(event) {
            if (!isMobile) {
                tooltip
                    .style('top', (event.pageY - 60) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            }
        })
        .on('mouseleave', function(event, d) {
            d3.select(this).attr('opacity', d.Year === highlightYear ? 0.95 : 0.45);
            tooltip.style('visibility', 'hidden');
        })
        .on('touchend', function() {
            setTimeout(() => {
                tooltip.style('visibility', 'hidden');
            }, 2000);
        });
}

function handleGlobalMortalityResize() {
    if (globalMortalityResizeTimeout) {
        clearTimeout(globalMortalityResizeTimeout);
    }
    
    globalMortalityResizeTimeout = setTimeout(() => {
        if (globalMortalityData) {
            const container = d3.select('#viz-global-mortality');
            if (!container.empty()) {
                createGlobalMortalityChart(globalMortalityData, container);
            }
        }
    }, 250);
}
