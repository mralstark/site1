'use client';
// SVG charts need an image role; native img cannot represent live vector data.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useState } from 'react';
import type { Analysis } from '@/lib/analytics';
export const number = (n: number, digits = 0) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(
        n,
      )
    : '∞';
export const date = (s: string) =>
  new Date(s + 'T00:00:00Z')
    .toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
    .replace('.', '');
export function Sparkline({
  values,
  color = 'var(--lime)',
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(...values, 1),
    min = Math.min(...values);
  const points = values
    .map(
      (v, i) =>
        `${(i * 100) / (values.length - 1)},${32 - ((v - min) / (max - min || 1)) * 25}`,
    )
    .join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 100 36" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function ForecastChart({
  result,
  band,
}: {
  result: Analysis;
  band: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const history = result.history.slice(-28),
    future = result.forecast;
  const points = [
    ...history.map((r) => ({
      date: r.date,
      value: r.backlog,
      low: r.backlog,
      high: r.backlog,
      baseline: r.backlog,
    })),
    ...future.map((r) => ({
      date: r.date,
      value: r.median,
      low: r.low,
      high: r.high,
      baseline: r.baseline,
    })),
  ];
  const width = 880,
    height = 280,
    left = 45,
    right = 18,
    top = 24,
    bottom = 33;
  const max =
    Math.max(...points.map((p) => Math.max(p.high, p.baseline)), 10) * 1.15;
  const x = (i: number) =>
      left + (i / (points.length - 1)) * (width - left - right),
    y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  const path = (
    start: number,
    end: number,
    key: 'value' | 'low' | 'high' | 'baseline',
  ) =>
    points
      .slice(start, end)
      .map((p, i) => `${i ? 'L' : 'M'}${x(i + start)},${y(p[key])}`)
      .join(' ');
  const split = history.length - 1,
    selected = hover === null ? null : points[hover];
  const area =
    path(split, points.length, 'high') +
    ' ' +
    points
      .slice(split)
      .map((_, i) => {
        const j = points.length - 1 - i;
        return `L${x(j)},${y(points[j].low)}`;
      })
      .join(' ') +
    ' Z';
  return (
    <div className="chart-wrap">
      <svg
        className="forecast-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Очередь: сейчас ${result.backlog}, прогноз ${number(result.last.median)} задач; диапазон ${number(result.last.low)}–${number(result.last.high)}.`}
      >
        <defs>
          <linearGradient id="range" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4f56c" stopOpacity=".16" />
            <stop offset="100%" stopColor="#c4f56c" stopOpacity=".015" />
          </linearGradient>
          <linearGradient id="history" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4f56c" stopOpacity=".06" />
            <stop offset="100%" stopColor="#c4f56c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              y1={y(max * t)}
              x2={width - right}
              y2={y(max * t)}
              stroke="#2a2e2c"
              strokeDasharray="3 5"
            />
            <text
              x={left - 12}
              y={y(max * t) + 4}
              textAnchor="end"
              className="axis-label"
            >
              {number(max * t)}
            </text>
          </g>
        ))}
        <rect
          x={x(split)}
          y={top}
          width={width - right - x(split)}
          height={height - top - bottom}
          fill="#c4f56c"
          opacity=".018"
        />
        <path
          d={
            path(0, history.length, 'value') +
            ` L${x(split)},${y(0)} L${left},${y(0)} Z`
          }
          fill="url(#history)"
        />
        {band && <path d={area} fill="url(#range)" />}
        <line
          x1={x(split)}
          y1={top}
          x2={x(split)}
          y2={height - bottom}
          stroke="#727c65"
          strokeDasharray="4 5"
        />
        <text x={x(split) + 12} y={top + 10} className="chart-callout">
          ПРОГНОЗ
        </text>
        <path
          d={path(split, points.length, 'baseline')}
          fill="none"
          stroke="#879582"
          strokeWidth="1.5"
          strokeDasharray="3 6"
        />
        <path
          d={path(0, history.length, 'value')}
          fill="none"
          stroke="#c4f56c"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d={path(split, points.length, 'value')}
          fill="none"
          stroke="#c4f56c"
          strokeWidth="2.5"
          strokeDasharray="7 5"
          strokeLinejoin="round"
        />
        <circle
          cx={x(split)}
          cy={y(result.backlog)}
          r="5"
          fill="#c4f56c"
          stroke="#181b18"
          strokeWidth="3"
        />
        {[0, Math.floor(split / 2), split, points.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 7}
            textAnchor={i === points.length - 1 ? 'end' : 'middle'}
            className="axis-label"
          >
            {date(points[i].date)}
          </text>
        ))}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - 9}
            y={top + 15}
            width={18}
            height={height - top - bottom - 15}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${date(p.date)}: ${number(p.value)} задач${i > split ? `; P10–P90: ${number(p.low)}–${number(p.high)}` : ''}`}</title>
          </rect>
        ))}
        {selected && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              y1={top}
              x2={x(hover)}
              y2={height - bottom}
              stroke="#c4f56c"
              opacity=".25"
            />
            <circle cx={x(hover)} cy={y(selected.value)} r="4" fill="#c4f56c" />
            <rect
              x={Math.min(x(hover) + 10, width - 165)}
              y={Math.max(top, y(selected.value) - 53)}
              width="147"
              height="42"
              rx="7"
              fill="#30372c"
              stroke="#65724e"
            />
            <text
              x={Math.min(x(hover) + 21, width - 154)}
              y={Math.max(top, y(selected.value) - 53) + 17}
              fill="#f1f3ec"
              fontSize="13"
            >
              {date(selected.date)} · {number(selected.value)} задач
            </text>
            <text
              x={Math.min(x(hover) + 21, width - 154)}
              y={Math.max(top, y(selected.value) - 53) + 33}
              fill="#b1bdab"
              fontSize="12"
            >
              {hover > split ? 'Расчётный сценарий' : 'Наблюдение'}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
