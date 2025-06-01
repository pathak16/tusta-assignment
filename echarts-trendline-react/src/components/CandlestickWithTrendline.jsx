import React, { useRef, useEffect, useState } from "react";
import * as echarts from "echarts";
import { dummyData } from "../data/rawData";

export default function CandlestickWithTrendline() {
    // Refs to DOM nodes
    const chartContainerRef = useRef(null);
    const canvasRef = useRef(null);
    const tooltipRef = useRef(null);
    const chartInstanceRef = useRef(null);

    // Ref to store drawAllLines so we can call it from outside useEffect
    const drawAllLinesRef = useRef(null);

    // Trendlines and interaction state
    const trendlinesRef = useRef([]);
    const draggingLineRef = useRef(null);
    const isDrawingNewLineRef = useRef(false);
    const newLineStartRef = useRef(null);

    // State for hover/delete icon
    const [hoveredLine, setHoveredLine] = useState(null);
    // hoveredLine shape: { id: number, x: number, y: number }

    // Utility: save to localStorage
    function saveTrendlinesToLocalStorage() {
        const toStore = trendlinesRef.current.map((line) => ({
            id: line.id,
            // Persist data-space rather than pixel-space
            start: { xData: line.start.xData, yData: line.start.yData },
            end: { xData: line.end.xData, yData: line.end.yData },
        }));
        localStorage.setItem("trendlines", JSON.stringify(toStore));
    }

    // Utility: load from localStorage
    function loadTrendlinesFromLocalStorage() {
        try {
            const stored = localStorage.getItem("trendlines");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    trendlinesRef.current = parsed.map((item) => ({
                        id: item.id,
                        // Restore data-space properties exactly as saved
                        start: { xData: item.start.xData, yData: item.start.yData },
                        end: { xData: item.end.xData, yData: item.end.yData },
                    }));
                }
            }
        } catch {
            trendlinesRef.current = [];
        }
    }

    useEffect(() => {
        // ─────────────────────────────────────────────────────────────
        // 1. Initialize ECharts
        const chartDom = chartContainerRef.current;
        const chart = echarts.init(chartDom);
        chartInstanceRef.current = chart;

        // Tooltip DOM
        const tooltipDom = tooltipRef.current;

        // Prepare data
        const rawData = dummyData;
        const dates = rawData.map((item) => item[0]);
        const values = rawData.map((item) => item.slice(1));

        // Candlestick option
        const option = {
            backgroundColor: "#fff",
            animation: false,
            tooltip: { show: false },
            axisPointer: { link: [{ xAxisIndex: 0 }] },
            xAxis: {
                type: "category",
                data: dates,
                boundaryGap: false,
                axisLine: { onZero: false },
                splitLine: { show: false },
                min: "dataMin",
                max: "dataMax",
            },
            yAxis: {
                scale: true,
                splitArea: { show: true },
            },
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: [0],
                    start: 40,
                    end: 100,
                    preventDefaultMouseMove: true,
                    moveOnMouseMove: false,
                },
                {
                    show: true,
                    type: "slider",
                    xAxisIndex: [0],
                    top: "bottom",
                    start: 40,
                    end: 100,
                    preventDefaultMouseMove: true,
                    moveOnMouseMove: false,
                },
            ],
            series: [
                {
                    name: "Candlestick",
                    type: "candlestick",
                    data: values,
                    itemStyle: {
                        color: "#ec0000",
                        color0: "#00da3c",
                        borderColor: "#ec0000",
                        borderColor0: "#00da3c",
                    },
                    markLine: {
                        silent: true,
                        lineStyle: { color: "#333" },
                        data: [],
                    },
                },
            ],
        };
        chart.setOption(option);

        // ─────────────────────────────────────────────────────────────
        // 2. Canvas setup
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Resize canvas
        function resizeCanvas() {
            const box = chartDom.getBoundingClientRect();
            canvas.width = box.width;
            canvas.height = box.height;
            canvas.style.width = box.width + "px";
            canvas.style.height = box.height + "px";
        }

        // Draw handle
        function drawHandle(point) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#2196f3";
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
        }

        // Draw all lines (data-space → pixel-space)
        function drawAllLines() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const line of trendlinesRef.current) {
                const pxStart = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.start.xData, line.start.yData]
                );
                const pxEnd = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.end.xData, line.end.yData]
                );
                ctx.beginPath();
                ctx.moveTo(pxStart[0], pxStart[1]);
                ctx.lineTo(pxEnd[0], pxEnd[1]);
                ctx.strokeStyle = "#2196f3";
                ctx.lineWidth = 2;
                ctx.stroke();
                drawHandle({ x: pxStart[0], y: pxStart[1] });
                drawHandle({ x: pxEnd[0], y: pxEnd[1] });
            }
        }
        drawAllLinesRef.current = drawAllLines;

        // Load persisted lines, then draw immediately
        loadTrendlinesFromLocalStorage();
        resizeCanvas();
        drawAllLines();

        // Mouse utilities
        function getMousePosition(e) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
        function distance(p1, p2) {
            return Math.hypot(p1.x - p2.x, p1.y - p2.y);
        }
        function isPointNearLine(p, line, threshold = 6) {
            // Note: line.start and line.end refer to pixel-coordinates
            const { start, end } = line;
            const A = p.x - start.x;
            const B = p.y - start.y;
            const C = end.x - start.x;
            const D = end.y - start.y;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            const param = lenSq ? dot / lenSq : -1;
            let xx, yy;
            if (param < 0) {
                xx = start.x;
                yy = start.y;
            } else if (param > 1) {
                xx = end.x;
                yy = end.y;
            } else {
                xx = start.x + param * C;
                yy = start.y + param * D;
            }
            return Math.hypot(p.x - xx, p.y - yy) < threshold;
        }

        // Show endpoint tooltip
        function showEndpointTooltip(evt, endpoint) {
            // 1) Convert data-space → pixel-space for endpoint
            const [px, py] = chart.convertToPixel(
                { xAxisIndex: 0, yAxisIndex: 0 },
                [endpoint.xData, endpoint.yData]
            );

            // 2) Convert that pixel back to data-space for label
            const [xVal, yVal] = chart.convertFromPixel(
                { xAxisIndex: 0, yAxisIndex: 0 },
                [px, py]
            );

            let dateLabel;
            if (typeof xVal === "number") {
                const idx = Math.round(xVal);
                dateLabel = dates[idx] || xVal;
            } else {
                dateLabel = xVal;
            }
            const priceLabel = typeof yVal === "number" ? yVal.toFixed(2) : yVal;

            // 3) Position tooltip near mouse
            const OFFSET_X = 12, OFFSET_Y = 12;
            tooltipDom.innerText = `${dateLabel}, ${priceLabel}`;
            tooltipDom.style.left = evt.clientX + OFFSET_X + "px";
            tooltipDom.style.top = evt.clientY + OFFSET_Y + "px";
            tooltipDom.style.display = "block";
        }

        // ==============================
        // Dragging: store initial offsets
        // ==============================
        function onMouseDown(e) {
            console.log("onMouseDown fired", getMousePosition(e));

            e.preventDefault();
            const mouse = getMousePosition(e);

            // Check if clicking on endpoint or line body
            for (const line of trendlinesRef.current) {
                // Convert data‐space → pixel‐space for each endpoint
                const pxStart = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.start.xData, line.start.yData]
                );
                const pxEnd = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.end.xData, line.end.yData]
                );

                // If click near pxStart endpoint
                if (distance(mouse, { x: pxStart[0], y: pxStart[1] }) < 8) {
                    draggingLineRef.current = { line, mode: "start" };
                    return;
                }
                // If click near pxEnd endpoint
                if (distance(mouse, { x: pxEnd[0], y: pxEnd[1] }) < 8) {
                    draggingLineRef.current = { line, mode: "end" };
                    return;
                }
                // If click near the line segment itself → “move” mode
                if (
                    isPointNearLine(
                        mouse,
                        {
                            start: { x: pxStart[0], y: pxStart[1] },
                            end: { x: pxEnd[0], y: pxEnd[1] }
                        },
                        6
                    )
                ) {
                    const startOffset = { x: mouse.x - pxStart[0], y: mouse.y - pxStart[1] };
                    const endOffset = { x: mouse.x - pxEnd[0], y: mouse.y - pxEnd[1] };
                    draggingLineRef.current = {
                        line,
                        mode: "move",
                        offsets: { startOffset, endOffset },
                    };
                    return;
                }
            }

            // Otherwise: start drawing a new line
            // DEFER setting new‐line mode by 0ms so onMouseMove sees it:
            console.log("    → falling back to NEW-LINE mode at", mouse);
            setTimeout(() => {
                isDrawingNewLineRef.current = true;
                newLineStartRef.current = { x: mouse.x, y: mouse.y };
            }, 0);

        }

        function onMouseMove(e) {
            console.log("onMouseMove fired", {
                x: e.clientX,
                y: e.clientY,
                drawingNew: isDrawingNewLineRef.current
            });

            e.preventDefault();
            const mouse = getMousePosition(e);

            // (1) Drawing new line preview
            if (isDrawingNewLineRef.current && newLineStartRef.current) {
                drawAllLines();
                ctx.beginPath();
                ctx.moveTo(newLineStartRef.current.x, newLineStartRef.current.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.strokeStyle = "#4caf50";
                ctx.lineWidth = 2;
                ctx.stroke();
                setHoveredLine(null);
                tooltipDom.style.display = "none";
                return;
            }

            // (2) Dragging existing line or endpoint (data-space)
            if (draggingLineRef.current) {
                const { line, mode, offsets } = draggingLineRef.current;

                if (mode === "start") {
                    // Convert pixel → data, then store
                    const [xVal, yVal] = chart.convertFromPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [mouse.x, mouse.y]
                    );
                    line.start = { xData: xVal, yData: yVal };

                } else if (mode === "end") {
                    const [xVal, yVal] = chart.convertFromPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [mouse.x, mouse.y]
                    );
                    line.end = { xData: xVal, yData: yVal };

                } else if (mode === "move") {
                    const { startOffset, endOffset } = offsets;

                    // Compute new pixel positions
                    const newPxStart = {
                        x: mouse.x - startOffset.x,
                        y: mouse.y - startOffset.y,
                    };
                    const newPxEnd = {
                        x: mouse.x - endOffset.x,
                        y: mouse.y - endOffset.y,
                    };

                    // Convert those to data-space
                    const [newXStart, newYStart] = chart.convertFromPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [newPxStart.x, newPxStart.y]
                    );
                    const [newXEnd, newYEnd] = chart.convertFromPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [newPxEnd.x, newPxEnd.y]
                    );

                    line.start = { xData: newXStart, yData: newYStart };
                    line.end = { xData: newXEnd, yData: newYEnd };
                }

                drawAllLines();
                setHoveredLine(null);
                tooltipDom.style.display = "none";
                return;
            }

            // (3) Hover detection: endpoints first
            let hoveringEndpoint = false;
            for (const line of trendlinesRef.current) {
                // Convert data-space → pixel-space for each endpoint
                const pxStart = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.start.xData, line.start.yData]
                );
                const pxEnd = chart.convertToPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [line.end.xData, line.end.yData]
                );

                if (distance(mouse, { x: pxStart[0], y: pxStart[1] }) < 8) {
                    showEndpointTooltip(e, line.start);
                    hoveringEndpoint = true;
                    setHoveredLine(null);
                    break;
                }
                if (distance(mouse, { x: pxEnd[0], y: pxEnd[1] }) < 8) {
                    showEndpointTooltip(e, line.end);
                    hoveringEndpoint = true;
                    setHoveredLine(null);
                    break;
                }
            }

            if (!hoveringEndpoint) {
                tooltipDom.style.display = "none";

                // (4) Hover detection for line body to show delete icon
                let foundLine = null;
                let midX = 0;
                let midY = 0;

                for (const line of trendlinesRef.current) {
                    // Convert both endpoints to pixels, then test “point near segment”
                    const pxStart = chart.convertToPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [line.start.xData, line.start.yData]
                    );
                    const pxEnd = chart.convertToPixel(
                        { xAxisIndex: 0, yAxisIndex: 0 },
                        [line.end.xData, line.end.yData]
                    );

                    if (
                        isPointNearLine(
                            mouse,
                            {
                                start: { x: pxStart[0], y: pxStart[1] },
                                end: { x: pxEnd[0], y: pxEnd[1] }
                            },
                            6
                        )
                    ) {
                        foundLine = line;
                        // Midpoint in pixel space
                        midX = (pxStart[0] + pxEnd[0]) / 2;
                        midY = (pxStart[1] + pxEnd[1]) / 2;
                        break;
                    }
                }

                if (foundLine) {
                    setHoveredLine({ id: foundLine.id, x: midX, y: midY });
                } else {
                    setHoveredLine(null);
                }
            }
        }


        function onMouseUp(e) {
            e.preventDefault();
            const mouse = getMousePosition(e);

            if (isDrawingNewLineRef.current && newLineStartRef.current) {
                const mousePxStart = newLineStartRef.current;   // { x: <px>, y: <px> }
                const mousePxEnd = { x: mouse.x, y: mouse.y }; // { x: <px>, y: <px> }

                // Convert both endpoints into data-space
                const [dataXStart, dataYStart] = chart.convertFromPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [mousePxStart.x, mousePxStart.y]
                );
                const [dataXEnd, dataYEnd] = chart.convertFromPixel(
                    { xAxisIndex: 0, yAxisIndex: 0 },
                    [mousePxEnd.x, mousePxEnd.y]
                );

                // Push new line using xData/yData
                const newLine = {
                    id: Date.now(),
                    start: { xData: dataXStart, yData: dataYStart },
                    end: { xData: dataXEnd, yData: dataYEnd },
                };
                trendlinesRef.current = [...trendlinesRef.current, newLine];
                saveTrendlinesToLocalStorage();
            }

            draggingLineRef.current = null;
            isDrawingNewLineRef.current = false;
            newLineStartRef.current = null;
            drawAllLines();
            setHoveredLine(null);
            tooltipDom.style.display = "none";
        }

        // ─────────────────────────────────────────────────────────────
        // Attach listeners (passive: false)
        // chartDom.addEventListener("mousedown", onMouseDown, { passive: false });
        // chartDom.addEventListener("mousemove", onMouseMove, { passive: false });
        // chartDom.addEventListener("mouseup", onMouseUp, { passive: false });
        // chartDom.addEventListener("touchstart", onMouseDown, { passive: false });
        // chartDom.addEventListener("touchmove", onMouseMove, { passive: false });
        // chartDom.addEventListener("touchend", onMouseUp, { passive: false });

        //const canvas = canvasRef.current;
        canvas.addEventListener("mousedown", onMouseDown, { passive: false });
        canvas.addEventListener("mousemove", onMouseMove, { passive: false });
        canvas.addEventListener("mouseup", onMouseUp, { passive: false });
        canvas.addEventListener("touchstart", onMouseDown, { passive: false });
        canvas.addEventListener("touchmove", onMouseMove, { passive: false });
        canvas.addEventListener("touchend", onMouseUp, { passive: false });

        // Sync overlay on chart events
        function updateOverlay() {
            resizeCanvas();
            drawAllLines();
        }
        window.addEventListener("resize", updateOverlay);
        chart.on("dataZoom", updateOverlay);
        chart.on("rendered", updateOverlay);
        chart.on("resize", updateOverlay);

        // Cleanup on unmount
        return () => {
            // chartDom.removeEventListener("mousedown", onMouseDown);
            // chartDom.removeEventListener("mousemove", onMouseMove);
            // chartDom.removeEventListener("mouseup", onMouseUp);
            // chartDom.removeEventListener("touchstart", onMouseDown);
            // chartDom.removeEventListener("touchmove", onMouseMove);
            // chartDom.removeEventListener("touchend", onMouseUp);

            canvas.removeEventListener("mousedown",  onMouseDown);
            canvas.removeEventListener("mouseup",    onMouseUp);
            canvas.removeEventListener("mousemove",  onMouseMove);
            canvas.removeEventListener("touchstart", onMouseDown);
            canvas.removeEventListener("touchmove",  onMouseMove);
            canvas.removeEventListener("touchend",   onMouseUp);


            window.removeEventListener("resize", updateOverlay);
            chart.off("dataZoom", updateOverlay);
            chart.off("rendered", updateOverlay);
            chart.off("resize", updateOverlay);

            chart.dispose();
        };
    }, []); // <-- Close useEffect here

    // Delete handler
    function handleDeleteLine() {
        if (!hoveredLine) return;
        trendlinesRef.current = trendlinesRef.current.filter(
            (line) => line.id !== hoveredLine.id
        );
        saveTrendlinesToLocalStorage();
        setHoveredLine(null);
        tooltipRef.current.style.display = "none";
        if (drawAllLinesRef.current) drawAllLinesRef.current();
    }

    // ─────────────────────────────────────────────────────────────
    return (
        <div
            id="chart-container"
            style={{
                position: "relative",
                width: "100%",
                height: "800px",
                touchAction: "none",
                userSelect: "none",
                overflow: "hidden",
            }}
        >
            {/* ECharts container */}
            <div
                id="main-chart"
                ref={chartContainerRef}
                style={{ width: window.innerWidth - 20, height: "100%" }}
            />

            {/* Canvas overlay */}
            <canvas
                id="trendline-canvas"
                ref={canvasRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "auto",
                    touchAction: "none",
                    userSelect: "none",
                    zIndex: 10,
                }}
            />

            {/* Endpoint tooltip */}
            <div
                ref={tooltipRef}
                style={{
                    position: "absolute",
                    padding: "4px 8px",
                    background: "rgba(50, 50, 50, 0.8)",
                    color: "#fff",
                    borderRadius: "4px",
                    pointerEvents: "auto",
                    fontSize: "12px",
                    display: "none",
                    zIndex: 20,
                    whiteSpace: "nowrap",
                }}
            />

            {/* Delete icon */}
            {hoveredLine && (
                <div
                    onClick={handleDeleteLine}
                    style={{
                        position: "absolute",
                        left: `${hoveredLine.x}px`,
                        top: `${hoveredLine.y}px`,
                        transform: "translate(-50%, -50%)",
                        width: "20px",
                        height: "20px",
                        background: "red",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 30,
                        fontSize: "14px",
                        color: "#fff",
                        userSelect: "none",
                    }}
                >
                    ×
                </div>
            )}
        </div>
    );
}
