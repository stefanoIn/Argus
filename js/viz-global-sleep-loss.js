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
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = 340;
    
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    // Add subtitle
    svg.append('text')
        .attr('x', (width + margin.left + margin.right) / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
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
    
    // Axes
    g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickValues(years.filter((y, i) => i % 2 === 0)))
        .style('color', 'var(--text-secondary)');
    
    g.append('g')
        .call(d3.axisLeft(yScale).tickFormat(d => d + '%'))
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
        .attr('y', -55)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
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
    
    // Tooltip (reuse to avoid duplicates)
    d3.select('body').selectAll('.viz-tooltip-sleep-loss').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-sleep-loss')
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
    
    g.selectAll('.bar')
        .on('mouseenter', function(event, d) {
            d3.select(this).attr('opacity', 0.95);
            tooltip
                .style('visibility', 'visible')
                .html(`<strong>${d.Year}</strong><br/>Sleep loss: ${d.Sleep_loss_percentage.toFixed(1)}%`);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('top', (event.pageY - 40) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseleave', function(event, d) {
            d3.select(this).attr('opacity', d.Year === d3.max(data, dd => dd.Year) ? 0.95 : 0.55);
            tooltip.style('visibility', 'hidden');
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
