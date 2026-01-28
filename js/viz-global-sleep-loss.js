/**
 * viz-global-sleep-loss.js
 * Global Sleep Loss Percentage Due to Heat (2015-2024)
 * Data: Lancet Countdown 2025
 */

let globalSleepLossData = null;
let globalSleepLossResizeTimeout = null;

function initializeGlobalSleepLossViz() {
    const container = d3.select('#viz-global-sleep-loss');
    
    if (container.empty()) {
        console.warn('[GlobalSleepLoss] Container not found');
        return;
    }
    
    fetch('data/json/global_sleep_lost.json')
        .then(response => response.json())
        .then(data => {
            globalSleepLossData = data;
            createGlobalSleepLossChart(data, container);
            
            // Add resize listener
            window.addEventListener('resize', handleGlobalSleepLossResize);
        })
        .catch(error => {
            console.error('[GlobalSleepLoss] Error loading data:', error);
            container.html(`<p style="color: red; padding: 20px;">Error loading data: ${error.message}</p>`);
        });
}

function createGlobalSleepLossChart(data, container) {
    container.selectAll('*').remove();
    
    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;
    const isMobile = containerWidth < 768;
    
    // Responsive margins
    const margin = { 
        top: 40, 
        right: isMobile ? 30 : 80, 
        bottom: 60, 
        left: isMobile ? 50 : 80 
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
    
    // Add subtitle - responsive font size
    const subtitleFontSize = isMobile ? '11px' : '13px';
    svg.append('text')
        .attr('x', svgWidth / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', subtitleFontSize)
        .style('fill', 'var(--text-secondary)')
        .style('font-weight', '400')
        .text('Percentage of sleep lost due to heat exposure globally, 2015–2024 | Data: Lancet Countdown 2025');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales (bar chart reads better for 10 years)
    const years = data.map(d => d.Year);
    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.25);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.Sleep_loss_percentage) * 1.15])
        .nice()
        .range([height, 0]);
    
    const color = '#8b5cf6';
    const lastYear = d3.max(data, d => d.Year);
    
    // Bars
    g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.Year))
        .attr('width', xScale.bandwidth())
        .attr('y', d => yScale(d.Sleep_loss_percentage))
        .attr('height', d => height - yScale(d.Sleep_loss_percentage))
        .attr('rx', 4)
        .attr('fill', color)
        .attr('opacity', d => d.Year === lastYear ? 0.95 : 0.55);
    
    // Axes - responsive font sizes
    const axisFontSize = isMobile ? '10px' : '11px';
    const labelFontSize = isMobile ? '12px' : '14px';
    
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickValues(years.filter((y, i) => i % 2 === 0)))
        .style('color', 'var(--text-secondary)')
        .selectAll('text')
        .style('font-size', axisFontSize);
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => d + '%'))
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
        .attr('y', isMobile ? -40 : -55)
        .attr('text-anchor', 'middle')
        .style('font-size', labelFontSize)
        .style('font-weight', '600')
        .style('fill', 'var(--text-primary)')
        .text('Sleep Loss (%)');
    
    // Annotation for 2024 peak
    const peak2024 = data[data.length - 1];
    const peakX = (xScale(peak2024.Year) || 0) + xScale.bandwidth() / 2;
    const peakY = yScale(peak2024.Sleep_loss_percentage);
    
    const annotation = g.append('g');
    annotation.append('line')
        .attr('x1', peakX)
        .attr('y1', peakY - 10)
        .attr('x2', peakX)
        .attr('y2', peakY - 60)
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2');
    
    annotation.append('text')
        .attr('x', peakX)
        .attr('y', peakY - 68)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#8b5cf6')
        .text(`2024: ${peak2024.Sleep_loss_percentage.toFixed(1)}%`);
    
    // Tooltip (reuse to avoid duplicates) - mobile-friendly
    d3.select('body').selectAll('.viz-tooltip-sleep-loss').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-sleep-loss')
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
        const tooltipY = isMobile ? (event.pageY - 100) : (event.pageY - 40);
        const tooltipLeft = isMobile ? '50%' : (tooltipX + 'px');
        const tooltipTransform = isMobile ? 'translate(-50%, 0)' : 'none';
        
        tooltip
            .style('visibility', 'visible')
            .style('top', tooltipY + 'px')
            .style('left', tooltipLeft)
            .style('transform', tooltipTransform)
            .style('max-width', isMobile ? '90%' : 'none')
            .html(`<strong>${d.Year}</strong><br/>Sleep loss: ${d.Sleep_loss_percentage.toFixed(1)}%`);
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
                    .style('top', (event.pageY - 40) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            }
        })
        .on('mouseleave', function(event, d) {
            d3.select(this).attr('opacity', d.Year === d3.max(data, dd => dd.Year) ? 0.95 : 0.55);
            tooltip.style('visibility', 'hidden');
        })
        .on('touchend', function() {
            setTimeout(() => {
                tooltip.style('visibility', 'hidden');
            }, 2000);
        });
}

function handleGlobalSleepLossResize() {
    if (globalSleepLossResizeTimeout) {
        clearTimeout(globalSleepLossResizeTimeout);
    }
    
    globalSleepLossResizeTimeout = setTimeout(() => {
        if (globalSleepLossData) {
            const container = d3.select('#viz-global-sleep-loss');
            if (!container.empty()) {
                createGlobalSleepLossChart(globalSleepLossData, container);
            }
        }
    }, 250);
}
