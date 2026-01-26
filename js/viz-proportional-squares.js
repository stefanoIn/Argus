/**
 * viz-proportional-squares.js
 * Proportional Square Visualization for Urban Population Growth
 * Shows 1960 vs latest-year urban population with area-proportional squares
 * Safari-compatible version
 */

let proportionalSquaresData = null;
let proportionalSquaresResizeTimeout = null;

function initializeProportionalSquaresViz() {
  const container = d3.select("#viz-proportional-squares");

  if (container.empty()) {
    console.warn("[ProportionalSquares] Container not found");
    return;
  }

  // Add loading indicator
  container.html(
    '<p style="text-align: center; padding: 40px; color: #666;">Loading visualization...</p>'
  );

  // Load data using fetch with improved Safari compatibility
  console.log("[ProportionalSquares] Fetching data...");

  fetch("data/json/world_urban_population_1960vs2026.json")
    .then(function (response) {
      console.log(
        "[ProportionalSquares] Response received:",
        response.status,
        response.ok
      );
      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      return response.text().then(function (text) {
        console.log("[ProportionalSquares] Data length:", text.length);
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error(
            "[ProportionalSquares] JSON parse error. First 100 chars:",
            text.substring(0, 100)
          );
          throw new Error("Invalid JSON: " + e.message);
        }
      });
    })
    .then(function (data) {
      console.log(
        "[ProportionalSquares] Data parsed successfully, items:",
        data && data.length
      );

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid or empty data received");
      }

      proportionalSquaresData = data;
      createProportionalSquaresChart(data, container);

      // Add resize listener
      window.addEventListener("resize", handleProportionalSquaresResize);
    })
    .catch(function (error) {
      console.error("[ProportionalSquares] Error loading data:", error);
      container.html(
        '<p style="color: red; padding: 20px;">Error loading data: ' +
          error.message +
          "</p>"
      );
    });
}

function createProportionalSquaresChart(data, container) {
  try {
    console.log("[ProportionalSquares] Creating chart with data length:", data.length);
    container.selectAll("*").remove();

    // ---------------------------------------------
    // Extract 1960 data and LATEST YEAR in dataset
    // ---------------------------------------------
    var data1960 = null;
    var dataLatest = null;

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row || typeof row.year !== "number" || typeof row.population !== "number") {
        continue;
      }

      if (row.year === 1960) data1960 = row;

      if (!dataLatest || row.year > dataLatest.year) {
        dataLatest = row;
      }
    }

    if (!data1960 || !dataLatest) {
      console.error("[ProportionalSquares] Missing required data");
      console.error("[ProportionalSquares] data1960:", data1960);
      console.error("[ProportionalSquares] dataLatest:", dataLatest);
      container.html(
        '<p style="color: red; padding: 20px;">Error: Missing required data (need 1960 and at least one later year)</p>'
      );
      return;
    }

    const year1960 = data1960.year;
    const yearLatest = dataLatest.year;

    const pop1960 = data1960.population;
    const popLatest = dataLatest.population;

    console.log(
      "[ProportionalSquares] Population",
      year1960 + ":",
      pop1960,
      "Population",
      yearLatest + ":",
      popLatest
    );

    // Calculate proportional side lengths
    const baseSize = 100;
    const ratio = popLatest / pop1960;
    const size1960 = baseSize;
    const sizeLatest = baseSize * Math.sqrt(ratio);

    const containerNode = container.node();
    const containerWidth = containerNode.getBoundingClientRect().width;

    // Calculate dimensions with proper spacing - responsive
    const margin = { 
      top: 80, 
      right: Math.max(20, containerWidth * 0.03), 
      bottom: 60, 
      left: Math.max(20, containerWidth * 0.03) 
    };
    const spacing = Math.max(30, Math.min(60, containerWidth * 0.08));
    const maxSquareSize = Math.max(size1960, sizeLatest);
    const width = Math.max(300, containerWidth - margin.left - margin.right);
    const height = maxSquareSize + 100;

    // Scale to fit available width
    const availableWidth = width - spacing;
    const totalSquareWidth = size1960 + sizeLatest;
    const scale = Math.min(1, availableWidth / totalSquareWidth);

    const scaledSize1960 = size1960 * scale;
    const scaledSizeLatest = sizeLatest * scale;

    // Create SVG - responsive with viewBox
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;
    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto")
      .style("max-width", "100%");

    // Get computed color for Safari compatibility
    const textColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--text-primary")
        .trim() || "#1a202c";

    // Add title - responsive font sizes
    const titleFontSize = containerWidth < 500 ? "16px" : (containerWidth < 800 ? "17px" : "18px");
    const subtitleFontSize = containerWidth < 500 ? "11px" : (containerWidth < 800 ? "12px" : "13px");
    
    svg
      .append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", titleFontSize)
      .style("font-weight", "700")
      .style("fill", textColor)
      .text("Urban Population Growth: A Visual Comparison");

    svg
      .append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 48)
      .attr("text-anchor", "middle")
      .style("font-size", subtitleFontSize)
      .style("fill", "#6b7280")
      .text("Square areas proportional to global urban population");

    const g = svg
      .append("g")
      .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    // Center the squares horizontally
    const totalWidth = scaledSize1960 + spacing + scaledSizeLatest;
    const startX = (width - totalWidth) / 2;

    // ======================
    // 1960 Square
    // ======================
    const square1960 = g.append("g").attr("class", "square-1960");

    const y1960 = height - scaledSize1960 - 40;

    square1960
      .append("rect")
      .attr("x", startX)
      .attr("y", y1960)
      .attr("width", 0)
      .attr("height", 0)
      .attr("fill", "#f97316")
      .attr("stroke", "#ea580c")
      .attr("stroke-width", 2)
      .attr("opacity", 0.7)
      .transition()
      .duration(1000)
      .attr("width", scaledSize1960)
      .attr("height", scaledSize1960);

    // 1960 Label - responsive font sizes
    const labelFontSize = containerWidth < 500 ? "14px" : (containerWidth < 800 ? "16px" : "18px");
    const popFontSize1960 = containerWidth < 500 ? "16px" : (containerWidth < 800 ? "18px" : "20px");
    const peopleFontSize1960 = containerWidth < 500 ? "10px" : (containerWidth < 800 ? "11px" : "12px");
    
    square1960
      .append("text")
      .attr("x", startX + scaledSize1960 / 2)
      .attr("y", y1960 - 15)
      .attr("text-anchor", "middle")
      .style("font-size", labelFontSize)
      .style("font-weight", "700")
      .style("fill", "#ea580c")
      .style("opacity", 0)
      .text(String(year1960))
      .transition()
      .delay(500)
      .duration(600)
      .style("opacity", 1);

    // 1960 Population value
    square1960
      .append("text")
      .attr("x", startX + scaledSize1960 / 2)
      .attr("y", y1960 + scaledSize1960 / 2 - 5)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", popFontSize1960)
      .style("font-weight", "700")
      .style("fill", "white")
      .style("opacity", 0)
      .text((pop1960 / 1e9).toFixed(2) + "B")
      .transition()
      .delay(1000)
      .duration(600)
      .style("opacity", 1);

    square1960
      .append("text")
      .attr("x", startX + scaledSize1960 / 2)
      .attr("y", y1960 + scaledSize1960 / 2 + 17)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", peopleFontSize1960)
      .style("font-weight", "500")
      .style("fill", "white")
      .style("opacity", 0)
      .text("people")
      .transition()
      .delay(1000)
      .duration(600)
      .style("opacity", 1);

    // ======================
    // Latest Year Square
    // ======================
    const squareLatest = g.append("g").attr("class", "square-latest");

    const xLatest = startX + scaledSize1960 + spacing;
    const yLatest = height - scaledSizeLatest - 40;

    squareLatest
      .append("rect")
      .attr("x", xLatest)
      .attr("y", height - 50)
      .attr("width", 0)
      .attr("height", 0)
      .attr("fill", "#dc2626")
      .attr("stroke", "#b91c1c")
      .attr("stroke-width", 2)
      .attr("opacity", 0.7)
      .transition()
      .delay(600)
      .duration(1200)
      .attr("y", yLatest)
      .attr("width", scaledSizeLatest)
      .attr("height", scaledSizeLatest);

    // Latest Year Label - responsive font sizes
    const popFontSizeLatest = containerWidth < 500 ? "20px" : (containerWidth < 800 ? "23px" : "26px");
    const peopleFontSizeLatest = containerWidth < 500 ? "11px" : (containerWidth < 800 ? "12px" : "14px");
    
    squareLatest
      .append("text")
      .attr("x", xLatest + scaledSizeLatest / 2)
      .attr("y", yLatest - 15)
      .attr("text-anchor", "middle")
      .style("font-size", labelFontSize)
      .style("font-weight", "700")
      .style("fill", "#b91c1c")
      .style("opacity", 0)
      .text(String(yearLatest))
      .transition()
      .delay(1200)
      .duration(600)
      .style("opacity", 1);

    // Latest population value
    squareLatest
      .append("text")
      .attr("x", xLatest + scaledSizeLatest / 2)
      .attr("y", yLatest + scaledSizeLatest / 2 - 8)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", popFontSizeLatest)
      .style("font-weight", "700")
      .style("fill", "white")
      .style("opacity", 0)
      .text((popLatest / 1e9).toFixed(2) + "B")
      .transition()
      .delay(1800)
      .duration(600)
      .style("opacity", 1);

    squareLatest
      .append("text")
      .attr("x", xLatest + scaledSizeLatest / 2)
      .attr("y", yLatest + scaledSizeLatest / 2 + 20)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", peopleFontSizeLatest)
      .style("font-weight", "500")
      .style("fill", "white")
      .style("opacity", 0)
      .text("people")
      .transition()
      .delay(1800)
      .duration(600)
      .style("opacity", 1);

    // ======================
    // Growth indicator
    // ======================
    const growthMultiplier = ratio.toFixed(1);

    const growthIndicator = g
      .append("g")
      .attr("class", "growth-indicator")
      .style("opacity", 0);

    // Growth indicator - responsive font size
    const growthFontSize = containerWidth < 500 ? "14px" : (containerWidth < 800 ? "16px" : "18px");
    
    growthIndicator
      .append("text")
      .attr("x", width / 2)
      .attr("y", height + 30)
      .attr("text-anchor", "middle")
      .style("font-size", growthFontSize)
      .style("font-weight", "700")
      .style("fill", "#dc2626")
      .text(growthMultiplier + "× growth in " + (yearLatest - year1960) + " years");

    growthIndicator
      .transition()
      .delay(2400)
      .duration(800)
      .style("opacity", 1);

    console.log("[ProportionalSquares] Chart created successfully");
  } catch (error) {
    console.error("[ProportionalSquares] Error creating chart:", error);
    console.error("[ProportionalSquares] Error stack:", error.stack);
    container.html(
      '<p style="color: red; padding: 20px;">Error rendering visualization: ' +
        error.message +
        "</p>"
    );
  }
}

function handleProportionalSquaresResize() {
  if (proportionalSquaresResizeTimeout) {
    clearTimeout(proportionalSquaresResizeTimeout);
  }

  proportionalSquaresResizeTimeout = setTimeout(function () {
    if (proportionalSquaresData) {
      const container = d3.select("#viz-proportional-squares");
      if (!container.empty()) {
        createProportionalSquaresChart(proportionalSquaresData, container);
      }
    }
  }, 250);
}
