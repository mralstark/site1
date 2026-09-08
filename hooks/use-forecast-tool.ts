'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  analyze,
  parseCsv,
  type Observation,
  type Settings,
} from '@/lib/analytics';

type ForecastTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ToolDocument = Document & {
  modelContext?: {
    registerTool(
      tool: ForecastTool,
      options: { signal: AbortSignal },
    ): void | Promise<void>;
  };
};
export function useForecastTool(
  apply: (rows: Observation[], settings: Settings) => void,
) {
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);
  useEffect(() => {
    const context = (document as ToolDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool: ForecastTool = {
      name: 'run_queue_forecast',
      title: 'Рассчитать очередь задач',
      description:
        'Validate daily CSV, replace the visible dataset and scenario, and return the calculated queue forecast. Data remains in this browser tab until refresh.',
      inputSchema: {
        type: 'object',
        properties: {
          csv: { type: 'string', maxLength: 100000 },
          initialBacklog: { type: 'integer', minimum: 0, maximum: 1000000 },
          horizon: { type: 'integer', enum: [7, 14, 30] },
          capacity: { type: 'number', minimum: -50, maximum: 100 },
          demand: { type: 'number', minimum: -50, maximum: 100 },
        },
        required: ['csv', 'initialBacklog', 'horizon', 'capacity', 'demand'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new Error('Expected an object.');
        const args = input as Record<string, unknown>,
          keys = ['csv', 'initialBacklog', 'horizon', 'capacity', 'demand'];
        if (
          Object.keys(args).length !== keys.length ||
          Object.keys(args).some((k) => !keys.includes(k)) ||
          typeof args.csv !== 'string' ||
          keys.slice(1).some((k) => typeof args[k] !== 'number')
        )
          throw new Error(
            'Expected csv and all four numeric scenario parameters.',
          );
        const rows = parseCsv(args.csv),
          settings: Settings = {
            initialBacklog: args.initialBacklog as number,
            horizon: args.horizon as number,
            capacity: args.capacity as number,
            demand: args.demand as number,
          };
        const result = analyze(rows, settings);
        flushSync(() => applyRef.current(rows, settings));
        return {
          days: rows.length,
          currentQueue: result.backlog,
          riskIndex: result.score,
          forecastDate: result.last.date,
          median: result.last.median,
          p10: result.last.low,
          p90: result.last.high,
          baseline: result.last.baseline,
        };
      },
    };
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {
        /* Optional capability; UI remains available. */
      });
    } catch {
      /* Browser proposal may be unavailable. */
    }
    return () => lifecycle.abort();
  }, []);
}
