/**
 * viz-sankey-landcover.js
 * Sankey diagram showing relationship between land cover types and temperature classes
 * Answers: "Which surfaces contribute most to extreme heat?"
 * 
 * Uses pre-computed statistics from JSON (faster, no pixel processing in browser)
 */

let sankeyData = null; // Store data for resize
let sankeyResizeTimeout = null;

function initializeSankeyLandCoverViz() {
    const container = d3.select('#viz-sankey-landcover');
    if (container.empty()) return;
    
    container.selectAll('*').remove();
    
    // Ensure container is properly styled for centering
    container
        .style('display', 'block')
        .style('width', '100%')
        .style('text-align', 'center');
    
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
        .text('Loading land cover and temperature statistics...')
        .style('font-size', '16px')
        .style('margin', '0');
    
    // Load pre-computed statistics from JSON
    const dataPath = 'data/json/sankey_landcover_temp.json';
    
    // Load pre-computed data
    fetch(dataPath)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load ${dataPath}`);
            return response.json();
        })
        .then(data => {
            loadingMsg.remove();
            
            
            // Convert array of flows to associations object and store area data
            const associations = {};
            const flowAreas = {}; // Store area for each flow
            let totalAreaKm2 = 0;
            
            data.forEach(flow => {
                const key = `${flow.source}→${flow.target}`;
                associations[key] = flow.pixel_count;
                flowAreas[key] = flow.area_km2;
                totalAreaKm2 += flow.area_km2;
            });
            
            
            
            // Build Sankey data structure
            const landCoverTypes = ['Dense Vegetation', 'Sparse Vegetation', 'Bare Soil', 'Built-up'];
            const tempClasses = ['Cool', 'Moderate', 'Warm', 'Hot'];
            
            // Create nodes
            const nodes = [];
            const nodeMap = new Map();
            let nodeIndex = 0;
            
            // Add land cover nodes (left side)
            landCoverTypes.forEach((type, i) => {
                nodes.push({
                    id: nodeIndex,
                    name: type,
                    type: 'landcover',
                    x: 0,
                    y: i
                });
                nodeMap.set(type, nodeIndex++);
            });
            
            // Add temperature class nodes (right side)
            tempClasses.forEach((tempClass, i) => {
                nodes.push({
                    id: nodeIndex,
                    name: tempClass,
                    type: 'temperature',
                    x: 1,
                    y: i
                });
                nodeMap.set(tempClass, nodeIndex++);
            });
            
            // Create links from pre-computed flows
            const links = [];
            let totalFlowPixels = 0;
            landCoverTypes.forEach(landCover => {
                tempClasses.forEach(tempClass => {
                    const key = `${landCover}→${tempClass}`;
                    const value = associations[key] || 0;
                    if (value > 0) {
                        links.push({
                            source: nodeMap.get(landCover),
                            target: nodeMap.get(tempClass),
                            value: value,
                            areaKm2: flowAreas[key] || 0  // Store area from JSON
                        });
                        totalFlowPixels += value;
                    }
                });
            });
            
            // Store data for resize
            sankeyData = { container, nodes, links, totalAreaKm2, totalFlowPixels };
            
            // Render Sankey diagram
            renderSankey(container, nodes, links, totalAreaKm2, totalFlowPixels);
            
            // Add resize handler for responsiveness
            window.addEventListener('resize', function() {
                clearTimeout(sankeyResizeTimeout);
                sankeyResizeTimeout = setTimeout(function() {
                    if (sankeyData) {
                        sankeyData.container.selectAll('*').remove();
                        renderSankey(
                            sankeyData.container, 
                            sankeyData.nodes, 
                            sankeyData.links, 
                            sankeyData.totalAreaKm2, 
                            sankeyData.totalFlowPixels
                        );
                    }
                }, 250);
            });
            
        })
        .catch(error => {
            console.error('[Sankey] Error loading data:', error);
            loadingMsg.html(`<p style="color: #e53e3e;">Error loading data: ${error.message}</p>`);
        });
}

function renderSankey(container, nodes, links, totalAreaKm2, totalFlowPixels) {
    // Set up dimensions - balance top and bottom margins for vertical centering
    const containerWidth = container.node().getBoundingClientRect().width || 1200;
    const containerHeight = container.node().getBoundingClientRect().height || 700;
    const maxWidth = 1200;
    const contentWidth = Math.min(maxWidth, containerWidth);
    
    // Calculate optimal height based on container (reduced for shorter diagram)
    const baseHeight = 350;
    const availableHeight = Math.max(baseHeight, containerHeight - 100); // Leave space for margins
    
    // Use smaller margins since legend is removed
    const margin = { top: 40, right: 40, bottom: 0, left: 40 };
    const width = contentWidth - margin.left - margin.right;
    const height = availableHeight - margin.top - margin.bottom;
    
    // Create SVG with proper centering and responsiveness
    const svgWidth = contentWidth;
    const svgHeight = availableHeight;
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('display', 'block')
        .style('margin', '0 auto')
        .style('max-width', '100%')
        .style('width', '100%')
        .style('height', 'auto');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Calculate node positions using Sankey layout
    const nodeWidth = 160;
    const gap = 15;
    
    // Group nodes by type
    const landCoverNodes = nodes.filter(n => n.type === 'landcover');
    const tempNodes = nodes.filter(n => n.type === 'temperature');
    
    // Calculate total flow for each node (for sizing)
    const nodeTotals = new Map();
    links.forEach(link => {
        nodeTotals.set(link.source, (nodeTotals.get(link.source) || 0) + link.value);
        nodeTotals.set(link.target, (nodeTotals.get(link.target) || 0) + link.value);
    });
    
    const totalFlow = d3.sum(Array.from(nodeTotals.values()));
    const availableHeightForNodes = height - (gap * (landCoverNodes.length - 1));
    
    // Calculate final node positions (ensure proper centering)
    const finalSpacing = Math.max(350, width * 0.4);
    const finalTotalWidth = nodeWidth * 2 + finalSpacing;
    const finalLeftX = Math.max(10, (width - finalTotalWidth) / 2);
    const finalRightX = finalLeftX + nodeWidth + finalSpacing;
    
    // Calculate node heights first
    const landCoverNodeHeights = landCoverNodes.map(node => {
        const nodeFlow = nodeTotals.get(node.id) || 0;
        return Math.max(30, (nodeFlow / totalFlow) * availableHeightForNodes);
    });
    
    const tempNodeHeights = tempNodes.map(node => {
        const nodeFlow = nodeTotals.get(node.id) || 0;
        return Math.max(30, (nodeFlow / totalFlow) * availableHeightForNodes);
    });
    
    // Calculate total height needed for each column
    const totalLandCoverHeight = landCoverNodeHeights.reduce((sum, h) => sum + h, 0) + gap * (landCoverNodes.length - 1);
    const totalTempHeight = tempNodeHeights.reduce((sum, h) => sum + h, 0) + gap * (tempNodes.length - 1);
    
    // Center nodes vertically within available height
    const landCoverVerticalOffset = (height - totalLandCoverHeight) / 2;
    const tempVerticalOffset = (height - totalTempHeight) / 2;
    
    // Position land cover nodes (left) - vertically centered
    let currentY = landCoverVerticalOffset;
    landCoverNodes.forEach((node, i) => {
        const nodeHeight = landCoverNodeHeights[i];
        node.x = finalLeftX;
        node.y = currentY;
        node.height = nodeHeight;
        currentY += nodeHeight + gap;
    });
    
    // Position temperature nodes (right) - vertically centered
    currentY = tempVerticalOffset;
    tempNodes.forEach((node, i) => {
        const nodeHeight = tempNodeHeights[i];
        node.x = finalRightX;
        node.y = currentY;
        node.height = nodeHeight;
        currentY += nodeHeight + gap;
    });
    
    // Color scales - match legend colors from Land Cover visualization
    const landCoverColors = {
        'Dense Vegetation': '#649664',  // rgb(100, 150, 100) - Dense Vegetation
        'Sparse Vegetation': '#8CB48C', // rgb(140, 180, 140) - Sparse Vegetation
        'Bare Soil': '#B47864',         // rgb(180, 120, 100) - Bare Soil (brown)
        'Built-up': '#505050'           // rgb(80, 80, 80) - Built-up (dark gray)
    };
    
    // Temperature color scheme (blue to red gradient)
    const tempColorScale = d3.scaleOrdinal()
        .domain(['Cool', 'Moderate', 'Warm', 'Hot'])
        .range(['#3b82f6', '#60a5fa', '#f97316', '#ef4444']); // Blue -> Light blue -> Orange -> Red
    
    // Create gradient definitions for links
    const defs = svg.append('defs');
    
    links.forEach((link, i) => {
        const sourceNode = nodes[link.source];
        const targetNode = nodes[link.target];
        const sourceColor = sourceNode.type === 'landcover' 
            ? landCoverColors[sourceNode.name] 
            : tempColorScale(sourceNode.name);
        const targetColor = targetNode.type === 'temperature'
            ? tempColorScale(targetNode.name)
            : landCoverColors[targetNode.name];
        
        const gradient = defs.append('linearGradient')
            .attr('id', `gradient-${i}`)
            .attr('x1', '0%')
            .attr('x2', '100%');
        
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', sourceColor)
            .attr('stop-opacity', 0.6);
        
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', targetColor)
            .attr('stop-opacity', 0.6);
    });
    
    // Create a custom link generator for our layout (Sankey-style curved paths)
    function createLinkPath(link) {
        const source = nodes[link.source];
        const target = nodes[link.target];
        
        const sourceX = source.x + nodeWidth;
        const sourceY = source.y + (source.height / 2);
        const targetX = target.x;
        const targetY = target.y + (target.height / 2);
        
        // Calculate control points for smooth Sankey curve
        const dx = targetX - sourceX;
        const controlPoint1X = sourceX + dx * 0.3;
        const controlPoint2X = sourceX + dx * 0.7;
        
        // Create smooth Bezier curve (Sankey style)
        return `M${sourceX},${sourceY}C${controlPoint1X},${sourceY} ${controlPoint2X},${targetY} ${targetX},${targetY}`;
    }
    
    // Calculate link width based on value (proportional to flow)
    const maxLinkValue = d3.max(links, d => d.value);
    const minLinkValue = d3.min(links, d => d.value);
    const linkWidthScale = d3.scaleSqrt() // Use sqrt scale for better visual distinction
        .domain([minLinkValue, maxLinkValue])
        .range([2, 25]);
    
    // Draw links
    const linkGroup = g.append('g').attr('class', 'links');
    
    links.forEach((link, i) => {
        const source = nodes[link.source];
        const target = nodes[link.target];
        const linkWidth = linkWidthScale(link.value);
        
        const path = linkGroup.append('path')
            .attr('d', createLinkPath(link))
            .attr('stroke', `url(#gradient-${i})`)
            .attr('stroke-width', linkWidth)
            .attr('fill', 'none')
            .attr('opacity', 0.6)
            .style('cursor', 'pointer');
        
        // Calculate link statistics
        const sourceTotal = nodeTotals.get(link.source);
        const linkPercentageOfSource = sourceTotal > 0 ? ((link.value / sourceTotal) * 100).toFixed(1) : '0.0';
        const targetTotal = nodeTotals.get(link.target);
        const linkPercentageOfTarget = targetTotal > 0 ? ((link.value / targetTotal) * 100).toFixed(1) : '0.0';
        
        // Interactive hover tooltip for links
        path
            .on('mouseover', function(event) {
                // Close any existing tooltips first
                d3.selectAll('.sankey-link-tooltip, .sankey-node-tooltip').remove();
                
                // Highlight this link
                path.attr('opacity', 0.9);
                
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'sankey-link-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'var(--bg-overlay)')
                    .style('color', 'var(--text-primary)')
                    .style('padding', '12px 16px')
                    .style('border-radius', '8px')
                    .style('font-size', '13px')
                    .style('font-family', 'system-ui, sans-serif')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('box-shadow', 'var(--shadow-lg)')
                    .style('border', '1px solid var(--border-medium)')
                    .style('opacity', 0);
                
                // Format area display
                let areaDisplay;
                if (link.areaKm2 >= 1) {
                    areaDisplay = `${link.areaKm2.toFixed(2)} km²`;
                } else if (link.areaHa >= 1) {
                    areaDisplay = `${link.areaHa.toFixed(1)} ha`;
                } else {
                    areaDisplay = `${link.areaM2.toFixed(0)} m²`;
                }
                
                tooltip.html(`
                    <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                        ${source.name} → ${target.name}
                    </div>
                    <div style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">
                        ${areaDisplay}
                    </div>
                    <div style="font-size: 11px; opacity: 0.8; line-height: 1.6;">
                        <div>${linkPercentageOfSource}% of ${source.name}</div>
                        <div>${linkPercentageOfTarget}% of ${target.name}</div>
                    </div>
                `);
                
                // Position tooltip relative to viewport
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            })
            .on('mousemove', function(event) {
                const tooltip = d3.select('.sankey-link-tooltip');
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                path.attr('opacity', 0.6);
                d3.select('.sankey-link-tooltip')
                    .transition()
                    .duration(200)
                    .style('opacity', 0)
                    .remove();
            });
    });
    
    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    
    nodes.forEach(node => {
        const nodeG = nodeGroup.append('g')
            .attr('transform', `translate(${node.x},${node.y})`);
        
        // Node rectangle
        const color = node.type === 'landcover' 
            ? landCoverColors[node.name] 
            : tempColorScale(node.name);
        
        nodeG.append('rect')
            .attr('width', nodeWidth)
            .attr('height', node.height)
            .attr('fill', color)
            .attr('opacity', 0.8)
            .attr('stroke', 'var(--border-medium)')
            .attr('stroke-width', 2)
            .attr('rx', 4)
            .style('cursor', 'pointer');
        
        // Node label (prevent text spilling with better wrapping)
        const maxCharsPerLine = 12;
        let labelText = node.name;
        
        // For temperature classes, use shorter labels
        if (node.type === 'temperature') {
            // Already short: Cool, Moderate, Warm, Hot
            labelText = node.name;
        } else {
            // For land cover, break long names intelligently
            if (node.name.length > maxCharsPerLine) {
                // Split on space if possible
                const words = node.name.split(' ');
                if (words.length > 1) {
                    // Try to split into two lines
                    const mid = Math.ceil(words.length / 2);
                    labelText = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
                }
            }
        }
        
        const labelParts = Array.isArray(labelText) ? labelText : [labelText];
        
        // Calculate vertical centering for multi-line labels
        const lineHeight = 14;
        const totalHeight = labelParts.length * lineHeight;
        const startY = (node.height - totalHeight) / 2 + lineHeight / 2;
        
        labelParts.forEach((part, i) => {
            nodeG.append('text')
                .attr('x', nodeWidth / 2)
                .attr('y', startY + (i * lineHeight))
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .style('fill', 'var(--text-primary)')
                .style('font-size', node.height < 50 ? '11px' : '12px')
                .style('font-weight', '600')
                .style('pointer-events', 'none')
                .text(part);
        });
        
        // Calculate node statistics for tooltip
        const total = nodeTotals.get(node.id);
        const totalPixels = total || 0;
        
        // Calculate node area from the JSON data (not from pixel count calculation)
        // Sum up all flow areas for this node from the original data
        let nodeAreaKm2 = 0;
        links.forEach(link => {
            if (link.source === node.id || link.target === node.id) {
                nodeAreaKm2 += link.areaKm2 || 0;
            }
        });
        
        const percentage = totalAreaKm2 > 0 ? ((nodeAreaKm2 / totalAreaKm2) * 100).toFixed(1) : '0.0';
        
        // Add interactive hover tooltip for nodes
        nodeG.select('rect')
            .on('mouseover', function(event) {
                // Close any existing tooltips first
                d3.selectAll('.sankey-link-tooltip, .sankey-node-tooltip').remove();
                
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'sankey-node-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'var(--bg-overlay)')
                    .style('color', 'var(--text-primary)')
                    .style('padding', '12px 16px')
                    .style('border-radius', '8px')
                    .style('font-size', '13px')
                    .style('font-family', 'system-ui, sans-serif')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('box-shadow', 'var(--shadow-lg)')
                    .style('border', '1px solid var(--border-medium)')
                    .style('opacity', 0);
                
                // Display area
                let nodeAreaDisplay = `${nodeAreaKm2.toFixed(2)} km²`;
                
                tooltip.html(`
                    <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${node.name}</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${color}; margin-bottom: 4px;">
                        ${nodeAreaDisplay}
                    </div>
                    <div style="font-size: 12px; opacity: 0.8;">
                        ${percentage}% of total area
                    </div>
                `);
                
                // Position tooltip relative to viewport
                const rect = svg.node().getBoundingClientRect();
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            })
            .on('mousemove', function(event) {
                const tooltip = d3.select('.sankey-node-tooltip');
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select('.sankey-node-tooltip')
                    .transition()
                    .duration(200)
                    .style('opacity', 0)
                    .remove();
            });
    });
    
    // Add title (centered)
    g.append('text')
        .attr('x', width / 2)
        .attr('y', -15)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-primary)')
        .style('font-size', '17px')
        .style('font-weight', '600')
        .text('Which Surfaces Contribute Most to Extreme Heat?');
    
    // Add subtitle (centered)
    g.append('text')
        .attr('x', width / 2)
        .attr('y', -2)
        .style('text-anchor', 'middle')
        .style('fill', 'var(--text-secondary)')
        .style('font-size', '11px')
        .text(`Flow width represents area for each land cover–temperature combination • Study area: ${totalAreaKm2.toFixed(1)} km²`);
    
}
