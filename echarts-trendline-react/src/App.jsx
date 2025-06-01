import React from "react";
import CandlestickWithTrendline from "./components/CandlestickWithTrendline";

export default function App() {
  return (
    <div style={{ padding: "1rem", width: "100%" , height: "100vh" }}>
      <h2>Candlestick Chart with Draggable Trendlines</h2>
      <CandlestickWithTrendline />
    </div>
  );
}
