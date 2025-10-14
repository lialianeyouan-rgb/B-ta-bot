import React, { useMemo, useState, useRef, FC } from 'react';
import type { Trade } from '../types';

interface PnlChartProps {
  trades: Trade[];
}

interface DataPoint {
  timestamp: number;
  cumulativePnl: number;
}

const PnlChart: FC<PnlChartProps> = ({ trades }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: DataPoint } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data: DataPoint[] = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    let cumulativePnl = 0;
    return sortedTrades.map(trade => {
        if (trade.status === 'success') {
             cumulativePnl += trade.profit;
        }
      return {
        timestamp: trade.timestamp,
        cumulativePnl: cumulativePnl,
      };
    });
  }, [trades]);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 font-mono text-sm">
        Awaiting more trade data to plot performance chart...
      </div>
    );
  }
  
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 40, left: 65 };

  const xMin = data[0].timestamp;
  const xMax = data[data.length - 1].timestamp;
  const yMin = Math.min(0, ...data.map(d => d.cumulativePnl));
  const yMax = Math.max(0, ...data.map(d => d.cumulativePnl));
  
  const yRange = yMax - yMin;
  const yAxisMin = yMin === yMax ? yMin - 1 : yMin - yRange * 0.1;
  const yAxisMax = yMin === yMax ? yMax + 1 : yMax + yRange * 0.1;
  
  const xScale = (timestamp: number) => {
    if (xMax === xMin) return padding.left + (width - padding.left - padding.right) / 2;
    return padding.left + ((timestamp - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
  };
  
  const yScale = (pnl: number) => {
    if (yAxisMax === yAxisMin) return (height - padding.bottom) / 2;
    return (height - padding.bottom) - ((pnl - yAxisMin) / (yAxisMax - yAxisMin)) * (height - padding.top - padding.bottom);
  };

  const pathData = data.map(d => `${xScale(d.timestamp)},${yScale(d.cumulativePnl)}`).join(' L ');
  
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const transformedPoint = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    const closestPoint = data.reduce((prev, curr) => {
      const prevDist = Math.abs(xScale(prev.timestamp) - transformedPoint.x);
      const currDist = Math.abs(xScale(curr.timestamp) - transformedPoint.x);
      return currDist < prevDist ? curr : prev;
    });

    setTooltip({
        x: xScale(closestPoint.timestamp),
        y: yScale(closestPoint.cumulativePnl),
        data: closestPoint,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const yAxisLabels = useMemo(() => {
    const labels = [];
    const numLabels = 5;
    for (let i = 0; i <= numLabels; i++) {
        const value = yAxisMin + (i * (yAxisMax - yAxisMin)) / numLabels;
        labels.push({
            y: yScale(value),
            value: value.toFixed(4)
        });
    }
    return labels;
  }, [yAxisMin, yAxisMax, yScale]);
  
  const xAxisLabels = useMemo(() => {
      const labels = [];
      const numXLabels = 4;
      if (xMax === xMin) {
          labels.push({ x: xScale(xMin), value: new Date(xMin).toLocaleTimeString() });
          return labels;
      }
      for (let i = 0; i <= numXLabels; i++) {
          const timestamp = xMin + (i * (xMax - xMin)) / numXLabels;
          labels.push({
              x: xScale(timestamp),
              value: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })
      }
      return labels;
  }, [xMin, xMax, xScale]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
             <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        {yAxisLabels.map((label, i) => (
            <line key={i} x1={padding.left} y1={label.y} x2={width - padding.right} y2={label.y} stroke="rgba(75, 85, 99, 0.5)" strokeWidth="1"/>
        ))}

        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#6b7280" strokeWidth="1" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#6b7280" strokeWidth="1" />
        
        {yAxisLabels.map((label, i) => (
            <text key={i} x={padding.left - 8} y={label.y} textAnchor="end" alignmentBaseline="middle" fill="#9ca3af" fontSize="12">
                {label.value}
            </text>
        ))}
         <text transform={`translate(20, ${height / 2}) rotate(-90)`} textAnchor="middle" fill="#d1d5db" fontSize="14" fontWeight="semibold">Cumulative P&L (ETH)</text>
        
        {xAxisLabels.map((label, i) => (
             <text key={i} x={label.x} y={height - padding.bottom + 20} textAnchor="middle" fill="#9ca3af" fontSize="12">
                {label.value}
            </text>
        ))}
        
        <path d={`M ${pathData}`} fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" filter="url(#glow)" />

        {tooltip && (
            <>
                <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="#a5b4fc" strokeDasharray="4 4" strokeWidth="1" />
                <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
            </>
        )}
      </svg>
      {tooltip && (
        <div 
            className="absolute p-2 text-xs bg-gray-900 border border-gray-600 rounded-md shadow-lg pointer-events-none text-white font-mono"
            style={{
                left: tooltip.x + 15,
                top: tooltip.y - 15,
                transform: `translate(${ (tooltip.x / width) > 0.8 ? '-120%' : '0%' }, -50%)`,
            }}
        >
            <div>P&L: <strong>{tooltip.data.cumulativePnl.toFixed(5)} ETH</strong></div>
            <div>Time: {new Date(tooltip.data.timestamp).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};

export default PnlChart;
