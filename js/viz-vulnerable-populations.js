/**
 * viz-vulnerable-populations.js
 * Global Heatwave Exposure for Vulnerable Populations (Infants and 65+)
 * Data: Lancet Countdown 2025
 */

let vulnerablePopData = null;
let vulnerablePopResizeTimeout = null;
let vulnerablePopState = { country: 'GLOBAL', mode: 'both' }; // mode: both | over65 | infants

function initializeVulnerablePopulationsViz() {
    const container = d3.select('#viz-vulnerable-populations');
    
    if (container.empty()) {
        console.warn('[VulnerablePop] Container not found');
        return;
    }
    
    fetch('data/json/vulnerable_people_expsore_days.json')
        .then(response => response.json())
        .then(data => {
            vulnerablePopData = data;
            createVulnerablePopulationsChart(data, container);
            
            // Add resize listener
            window.addEventListener('resize', handleVulnerablePopResizeViz);
        })
        .catch(error => {
            console.error('[VulnerablePop] Error loading data:', error);
            container.html(`<p style="color: red; padding: 20px;">Error loading data: ${error.message}</p>`);
        });
}

function createVulnerablePopulationsChart(data, container) {
    container.selectAll('*').remove();

    // Override generic `.visualization` flex-centering styles for this multi-panel layout
    container
        .style('display', 'block')
        .style('min-height', '0')
        .style('height', 'auto')
        .style('padding', '0')
        .style('margin', '0 auto')
        .style('max-width', '1100px')
        .style('box-sizing', 'border-box');
    
    // ----------------------------
    // Controls + explainer
    // ----------------------------
    const controls = container.append('div')
        .style('display', 'flex')
        .style('flex-wrap', 'wrap')
        .style('align-items', 'center')
        .style('justify-content', 'space-between')
        .style('gap', '10px')
        .style('margin', '0 0 10px 0')
        .style('width', '100%')
        .style('box-sizing', 'border-box');
    
    const left = controls.append('div')
        .style('display', 'flex')
        .style('gap', '10px')
        .style('align-items', 'center')
        .style('flex-wrap', 'wrap');
    
    left.append('div')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('color', 'var(--text-secondary)')
        .text('Country');
    
    const countries = Array.from(d3.group(data, d => d.ISO3), ([iso3, rows]) => ({
        iso3,
        name: rows[0]?.Country || iso3
    }))
        .filter(d => d.iso3 && d.iso3 !== 'null')
        .sort((a, b) => d3.ascending(a.name, b.name));
    
    const countrySelect = left.append('select')
        .style('padding', '6px 10px')
        .style('border-radius', '8px')
        .style('border', '1px solid var(--border-medium)')
        .style('background', 'var(--bg-card)')
        .style('color', 'var(--text-primary)')
        .style('font-size', '12px');
    
    countrySelect.append('option').attr('value', 'GLOBAL').text('Global (sum of all countries)');
    countries.forEach(c => {
        countrySelect.append('option').attr('value', c.iso3).text(c.name);
    });
    countrySelect.property('value', vulnerablePopState.country);
    
    const right = controls.append('div')
        .style('display', 'flex')
        .style('gap', '8px')
        .style('align-items', 'center')
        .style('flex-wrap', 'wrap');
    
    const modes = [
        { id: 'both', label: 'Both' },
        { id: 'over65', label: 'Adults 65+' },
        { id: 'infants', label: 'Infants' }
    ];
    
    const modeButtons = right.selectAll('button')
        .data(modes)
        .enter()
        .append('button')
        .attr('type', 'button')
        .style('padding', '6px 10px')
        .style('border-radius', '8px')
        .style('border', '1px solid var(--border-medium)')
        .style('background', d => d.id === vulnerablePopState.mode ? 'var(--primary-color)' : 'var(--bg-card)')
        .style('color', d => d.id === vulnerablePopState.mode ? 'var(--text-inverse)' : 'var(--text-primary)')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('cursor', 'pointer')
        .text(d => d.label);
    
    container.append('p')
        .style('margin', '0 0 14px 0')
        .style('font-size', '12px')
        .style('line-height', '1.5')
        .style('color', 'var(--text-secondary)')
        .style('max-width', '820px')
        .html('<strong>What is a person-day/person-event?</strong> It counts cumulative exposure: 1 person exposed for 1 day = 1 person-day. For example, 1,000 people exposed for 10 days = 10,000 person-days. Values here are annual totals.');
    
    // Chart containers
    const chartWrap = container.append('div')
        .style('display', 'grid')
        .style('grid-template-columns', '1fr')
        .style('gap', '16px');
    
    const svgTime = chartWrap.append('svg');
    const svgRank = chartWrap.append('svg');
    
    // Tooltip (reuse to avoid duplicates)
    d3.select('body').selectAll('.viz-tooltip-vulnerable').remove();
    const tooltip = d3.select('body').append('div')
        .attr('class', 'viz-tooltip viz-tooltip-vulnerable')
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
    
    const fmtBig = (v) => {
        if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
        return String(Math.round(v));
    };
    
    function getSeriesRows() {
        if (vulnerablePopState.country === 'GLOBAL') return data;
        return data.filter(d => d.ISO3 === vulnerablePopState.country);
    }
    
    function aggregateByYear(rows) {
        const yearly = d3.rollup(
            rows,
            v => ({
                infants: d3.sum(v, d => Number(d.exposures_total_infants) || 0),
                over65: d3.sum(v, d => Number(d.exposures_total_65) || 0)
            }),
            d => d.Year
        );
        
        return Array.from(yearly, ([year, values]) => ({
            year,
            infants: values.infants,
            over65: values.over65
        })).sort((a, b) => a.year - b.year);
    }
    
    function render() {
        const containerNode = container.node();
        const containerWidth = containerNode.getBoundingClientRect().width;
        const gap = 16;
        const isWide = containerWidth >= 980;
        const rankCol = isWide ? 420 : containerWidth;
        const timeCol = isWide ? Math.max(300, containerWidth - rankCol - gap) : containerWidth;
        
        chartWrap
            .style('grid-template-columns', isWide ? `minmax(0, 1fr) ${rankCol}px` : '1fr')
            .style('align-items', 'start')
            .style('width', '100%')
            .style('box-sizing', 'border-box');
        
        // --- Time series chart
        const margin = { top: 35, right: 20, bottom: 45, left: 90 };
        const width = Math.max(260, timeCol - margin.left - margin.right);
        const height = 300;
        
        const rows = getSeriesRows();
        const series = aggregateByYear(rows);
        const maxY = d3.max(series, d => {
            if (vulnerablePopState.mode === 'over65') return d.over65;
            if (vulnerablePopState.mode === 'infants') return d.infants;
            return Math.max(d.over65, d.infants);
        }) || 0;
        
        const xScale = d3.scaleLinear()
            .domain(d3.extent(series, d => d.year))
            .range([0, width]);
        
        const yScale = d3.scaleLinear()
            .domain([0, maxY * 1.12])
            .nice()
            .range([height, 0]);
        
        const cOver65 = 'var(--accent-color)';
        const cInfants = 'var(--primary-color)';
        
        svgTime
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);
        svgTime.selectAll('*').remove();
        
        svgTime.append('text')
            .attr('x', (width + margin.left + margin.right) / 2)
            .attr('y', 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('fill', 'var(--text-secondary)')
            .style('font-weight', '400')
            .text('Heatwave exposure (person-days) by age group, 1980–2024 | Data: Lancet Countdown 2025');
        
        const g = svgTime.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Grid
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(''))
            .style('stroke', 'var(--border-light)')
            .style('stroke-dasharray', '2,2')
            .style('opacity', 0.35);
        
        const line = (key) => d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d[key]))
            .curve(d3.curveMonotoneX);
        
        const area = (key) => d3.area()
            .x(d => xScale(d.year))
            .y0(height)
            .y1(d => yScale(d[key]))
            .curve(d3.curveMonotoneX);
        
        if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'over65') {
            g.append('path')
                .datum(series)
                .attr('d', area('over65'))
                .attr('fill', cOver65)
                .attr('opacity', 0.12);
            g.append('path')
                .datum(series)
                .attr('d', line('over65'))
                .attr('fill', 'none')
                .attr('stroke', cOver65)
                .attr('stroke-width', 3)
                .attr('opacity', 0.9);
        }
        
        if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'infants') {
            g.append('path')
                .datum(series)
                .attr('d', area('infants'))
                .attr('fill', cInfants)
                .attr('opacity', 0.12);
            g.append('path')
                .datum(series)
                .attr('d', line('infants'))
                .attr('fill', 'none')
                .attr('stroke', cInfants)
                .attr('stroke-width', 3)
                .attr('opacity', 0.9);
        }
        
        // Axes
        g.append('g')
            .attr('transform', `translate(0, ${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8))
            .style('color', 'var(--text-secondary)');
        
        g.append('g')
            .call(d3.axisLeft(yScale).tickFormat(d => fmtBig(Math.abs(d))))
            .style('color', 'var(--text-secondary)');
        
        // Labels
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + 38)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', '700')
            .style('fill', 'var(--text-primary)')
            .text('Year');
        
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -70)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', '700')
            .style('fill', 'var(--text-primary)')
            .text('Exposure (person-days)');
        
        // Legend (inside)
        const legend = g.append('g').attr('transform', `translate(${width - 190}, 10)`);
        if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'over65') {
            const l1 = legend.append('g');
            l1.append('line').attr('x1', 0).attr('x2', 24).attr('y1', 0).attr('y2', 0)
                .attr('stroke', cOver65).attr('stroke-width', 3);
            l1.append('text').attr('x', 30).attr('y', 4).style('font-size', '11px').style('fill', 'var(--text-primary)')
                .text('Adults 65+');
        }
        if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'infants') {
            const l2 = legend.append('g').attr('transform', `translate(0, 18)`);
            l2.append('line').attr('x1', 0).attr('x2', 24).attr('y1', 0).attr('y2', 0)
                .attr('stroke', cInfants).attr('stroke-width', 3);
            l2.append('text').attr('x', 30).attr('y', 4).style('font-size', '11px').style('fill', 'var(--text-primary)')
                .text('Infants');
        }
        
        // Hover tooltip (by year)
        const bisect = d3.bisector(d => d.year).left;
        g.append('rect')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const year = Math.round(xScale.invert(mx));
                const idx = bisect(series, year);
                const d = series[Math.min(Math.max(idx, 0), series.length - 1)];
                if (!d) return;
                
                const title = vulnerablePopState.country === 'GLOBAL'
                    ? 'Global (sum)'
                    : (countries.find(c => c.iso3 === vulnerablePopState.country)?.name || vulnerablePopState.country);
                
                const lines = [];
                if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'over65') {
                    lines.push(`<span style="color:${cOver65};font-weight:700;">Adults 65+:</span> ${fmtBig(d.over65)}`);
                }
                if (vulnerablePopState.mode === 'both' || vulnerablePopState.mode === 'infants') {
                    lines.push(`<span style="color:${cInfants};font-weight:700;">Infants:</span> ${fmtBig(d.infants)}`);
                }
                
                tooltip
                    .style('visibility', 'visible')
                    .html(`<strong>${d.year}</strong><br/><span style="color:var(--text-secondary);">${title}</span><br/>${lines.join('<br/>')}`);
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('top', (event.pageY - 70) + 'px')
                    .style('left', (event.pageX + 12) + 'px');
            })
            .on('mouseout', function() {
                tooltip.style('visibility', 'hidden');
            });
        
        // --- Ranking chart (latest year)
        const latestYear = d3.max(data, d => d.Year);
        const byCountry = d3.rollups(
            data.filter(d => d.Year === latestYear),
            v => ({
                infants: d3.sum(v, d => Number(d.exposures_total_infants) || 0),
                over65: d3.sum(v, d => Number(d.exposures_total_65) || 0)
            }),
            d => d.ISO3
        )
            .map(([iso3, v]) => ({
                iso3,
                country: (countries.find(c => c.iso3 === iso3)?.name) || iso3,
                infants: v.infants,
                over65: v.over65,
                total: v.infants + v.over65
            }))
            .filter(d => d.iso3 && d.iso3 !== 'GLOBAL');
        
        const sortKey = vulnerablePopState.mode === 'infants' ? 'infants' : (vulnerablePopState.mode === 'over65' ? 'over65' : 'total');
        const top = byCountry
            .slice()
            .sort((a, b) => d3.descending(a[sortKey], b[sortKey]))
            .slice(0, 10);
        
        const rMargin = { top: 30, right: 18, bottom: 30, left: 160 };
        const rWidth = Math.max(220, rankCol - rMargin.left - rMargin.right);
        const rHeight = 260;
        
        svgRank
            .attr('width', rWidth + rMargin.left + rMargin.right)
            .attr('height', rHeight + rMargin.top + rMargin.bottom);
        svgRank.selectAll('*').remove();
        
        svgRank.append('text')
            .attr('x', (rWidth + rMargin.left + rMargin.right) / 2)
            .attr('y', 16)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', '700')
            .style('fill', 'var(--text-primary)')
            .text(`Top countries by exposure in ${latestYear} (person-days)`);
        
        const rg = svgRank.append('g').attr('transform', `translate(${rMargin.left},${rMargin.top})`);
        
        const yBand = d3.scaleBand()
            .domain(top.map(d => d.country))
            .range([0, rHeight])
            .padding(0.2);
        
        const xMax = d3.max(top, d => d[sortKey]) || 0;
        const xLin = d3.scaleLinear()
            .domain([0, xMax * 1.1])
            .range([0, rWidth]);
        
        rg.append('g')
            .attr('transform', `translate(0, ${rHeight})`)
            .call(d3.axisBottom(xLin).ticks(4).tickFormat(d => fmtBig(d)))
            .style('color', 'var(--text-secondary)');
        
        rg.append('g')
            .call(d3.axisLeft(yBand))
            .style('color', 'var(--text-secondary)')
            .selectAll('text')
            .style('font-size', '11px');
        
        // Bars
        const row = rg.selectAll('.row')
            .data(top)
            .enter()
            .append('g')
            .attr('class', 'row')
            .attr('transform', d => `translate(0, ${yBand(d.country)})`);
        
        if (vulnerablePopState.mode === 'both') {
            row.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', yBand.bandwidth())
                .attr('width', d => xLin(d.over65))
                .attr('fill', cOver65)
                .attr('opacity', 0.55)
                .attr('rx', 3);
            
            row.append('rect')
                .attr('x', d => xLin(d.over65))
                .attr('y', 0)
                .attr('height', yBand.bandwidth())
                .attr('width', d => xLin(d.infants))
                .attr('fill', cInfants)
                .attr('opacity', 0.55)
                .attr('rx', 3);
        } else {
            const key = vulnerablePopState.mode === 'over65' ? 'over65' : 'infants';
            const color = vulnerablePopState.mode === 'over65' ? cOver65 : cInfants;
            row.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', yBand.bandwidth())
                .attr('width', d => xLin(d[key]))
                .attr('fill', color)
                .attr('opacity', 0.6)
                .attr('rx', 3);
        }
        
        row.on('mouseenter', function(event, d) {
            tooltip
                .style('visibility', 'visible')
                .html(
                    `<strong>${d.country}</strong><br/>` +
                    `<span style="color:${cOver65};font-weight:700;">Adults 65+:</span> ${fmtBig(d.over65)}<br/>` +
                    `<span style="color:${cInfants};font-weight:700;">Infants:</span> ${fmtBig(d.infants)}`
                );
        })
            .on('mousemove', function(event) {
                tooltip
                    .style('top', (event.pageY - 70) + 'px')
                    .style('left', (event.pageX + 12) + 'px');
            })
            .on('mouseleave', function() {
                tooltip.style('visibility', 'hidden');
            });
    }
    
    // Hook up controls
    countrySelect.on('change', function() {
        vulnerablePopState.country = this.value;
        render();
    });
    
    modeButtons.on('click', function(event, d) {
        vulnerablePopState.mode = d.id;
        modeButtons
            .style('background', x => x.id === vulnerablePopState.mode ? 'var(--primary-color)' : 'var(--bg-card)')
            .style('color', x => x.id === vulnerablePopState.mode ? 'var(--text-inverse)' : 'var(--text-primary)')
            .style('border-color', x => x.id === vulnerablePopState.mode ? 'var(--primary-color)' : 'var(--border-medium)');
        render();
    });
    
    render();
}

function handleVulnerablePopResizeViz() {
    if (vulnerablePopResizeTimeout) {
        clearTimeout(vulnerablePopResizeTimeout);
    }
    
    vulnerablePopResizeTimeout = setTimeout(() => {
        if (vulnerablePopData) {
            const container = d3.select('#viz-vulnerable-populations');
            if (!container.empty()) {
                createVulnerablePopulationsChart(vulnerablePopData, container);
            }
        }
    }, 250);
}
