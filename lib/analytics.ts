export type Observation = { date: string; incoming: number; completed: number };
export type Settings = {
  initialBacklog: number;
  horizon: number;
  capacity: number;
  demand: number;
};
export type ForecastPoint = {
  date: string;
  median: number;
  low: number;
  high: number;
  baseline: number;
  arrivals: number;
  capacity: number;
};
const DAY = 86_400_000;
export const DEFAULT_SETTINGS: Settings = {
  initialBacklog: 40,
  horizon: 14,
  capacity: 0,
  demand: 0,
};
const arrivals = [
  20, 24, 19, 28, 22, 18, 21, 25, 23, 27, 20, 29, 24, 22, 28, 31, 26, 30, 25,
  32, 29, 35, 31, 28, 36, 30, 34, 33,
];
const completions = [
  22, 21, 23, 20, 24, 20, 22, 24, 23, 26, 22, 24, 25, 21, 24, 26, 25, 24, 27,
  23, 26, 25, 28, 26, 27, 25, 28, 26,
];
export const DEMO: Observation[] = arrivals.map((incoming, i) => ({
  date: new Date(Date.UTC(2026, 7, 10) + i * DAY).toISOString().slice(0, 10),
  incoming,
  completed: completions[i],
}));
export const toCsv = (rows: Observation[]) =>
  'date,incoming,completed\n' +
  rows.map((r) => `${r.date},${r.incoming},${r.completed}`).join('\n');
export const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(n * 10) / 10;
export function validateRows(rows: Observation[]) {
  if (rows.length < 7 || rows.length > 366)
    throw new Error('Нужно от 7 до 366 последовательных календарных дней.');
  rows.forEach((r, i) => {
    const t = Date.parse(r.date + 'T00:00:00Z');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(t) ||
      new Date(t).toISOString().slice(0, 10) !== r.date ||
      r.date < '2000-01-01' ||
      r.date > '2099-12-01'
    )
      throw new Error(
        `Строка ${i + 2}: дата должна быть реальной, в формате YYYY-MM-DD, с 2000 по 2099 год.`,
      );
    if (
      ![r.incoming, r.completed].every(
        (v) => Number.isSafeInteger(v) && v >= 0 && v <= 100_000,
      )
    )
      throw new Error(`Строка ${i + 2}: задачи — целые числа от 0 до 100 000.`);
    if (i && t - Date.parse(rows[i - 1].date + 'T00:00:00Z') !== DAY)
      throw new Error(
        `Строка ${i + 2}: даты должны идти по порядку, без пропусков и повторов.`,
      );
  });
}
export function parseCsv(text: string): Observation[] {
  if (text.length > 100_000)
    throw new Error('Файл слишком большой. Максимум 100 КБ.');
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  const separator = lines[0]?.includes(';')
    ? ';'
    : lines[0]?.includes('\t')
      ? '\t'
      : ',';
  const split = (line: string) =>
    line.split(separator).map((s) => s.trim().replace(/^"([^"\r\n]*)"$/, '$1'));
  const aliases: Record<string, string> = {
    дата: 'date',
    поступило: 'incoming',
    завершено: 'completed',
  };
  const headers = split(lines[0] ?? '').map(
    (s) => aliases[s.toLowerCase()] ?? s.toLowerCase(),
  );
  if (
    headers.length !== 3 ||
    !['date', 'incoming', 'completed'].every((s) => headers.includes(s))
  )
    throw new Error(
      'Ожидаются три столбца: date,incoming,completed. Поддерживаются запятая, точка с запятой и табуляция.',
    );
  const rows = lines.slice(1).map((line, i) => {
    const cells = split(line);
    if (cells.length !== 3 || cells.some((s) => s === ''))
      throw new Error(`Строка ${i + 2}: заполните все три столбца.`);
    const incoming = cells[headers.indexOf('incoming')],
      completed = cells[headers.indexOf('completed')];
    if (!/^\d+$/.test(incoming) || !/^\d+$/.test(completed))
      throw new Error(
        `Строка ${i + 2}: используйте целые неотрицательные числа.`,
      );
    return {
      date: cells[headers.indexOf('date')],
      incoming: Number(incoming),
      completed: Number(completed),
    };
  });
  validateRows(rows);
  return rows;
}
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const low = Math.floor(i);
  return sorted[low] + (sorted[Math.ceil(i)] - sorted[low]) * (i - low);
}
export function analyze(rows: Observation[], settings: Settings) {
  validateRows(rows);
  const { initialBacklog, horizon, capacity, demand } = settings;
  if (
    !Number.isSafeInteger(initialBacklog) ||
    initialBacklog < 0 ||
    initialBacklog > 1_000_000
  )
    throw new Error('Начальная очередь — целое число от 0 до 1 000 000.');
  if (
    ![7, 14, 30].includes(horizon) ||
    !Number.isFinite(capacity) ||
    capacity < -50 ||
    capacity > 100 ||
    !Number.isFinite(demand) ||
    demand < -50 ||
    demand > 100
  )
    throw new Error('Параметры сценария вне допустимого диапазона.');
  let backlog = initialBacklog;
  const history = rows.map((r) => {
    backlog += r.incoming - r.completed;
    if (backlog < 0)
      throw new Error(
        `${r.date}: завершено больше задач, чем было доступно. Уточните начальную очередь.`,
      );
    return { ...r, backlog };
  });
  const recent = rows.slice(-14),
    n = recent.length;
  const incoming = mean(recent.map((r) => r.incoming)),
    throughput = mean(recent.map((r) => r.completed));
  const xmean = (n - 1) / 2;
  const slope =
    recent.reduce((s, r, i) => s + (i - xmean) * (r.incoming - incoming), 0) /
    recent.reduce((s, _, i) => s + (i - xmean) ** 2, 0);
  const residuals = recent.map(
    (r, i) => r.incoming - (incoming + slope * (i - xmean)),
  );
  const variance = mean(recent.map((r) => (r.incoming - incoming) ** 2));
  const variation = incoming ? Math.sqrt(variance) / incoming : 0;
  const load = throughput ? incoming / throughput : incoming ? Infinity : 0;
  const days = throughput ? backlog / throughput : backlog ? Infinity : 0;
  const pressure = clamp((load - 0.8) / 0.7, 0, 1) * 50;
  const queueRisk = clamp(days / 10, 0, 1) * 30;
  const noiseRisk = clamp(variation / 0.5, 0, 1) * 20;
  const score = Math.round(pressure + queueRisk + noiseRisk);
  const projected = Array.from({ length: horizon }, (_, i) =>
    clamp(
      incoming + slope * xmean + slope * 7 * (1 - Math.exp(-(i + 1) / 7)),
      0,
      100_000,
    ),
  );
  // Paired residual/throughput sampling retains their observed daily relationship. Fixed seed ensures reproducibility.
  const seed = rows.reduce(
    (s, r) => Math.imul(s, 31) + r.incoming * 7 + r.completed,
    17,
  );
  const simulations: number[][] = Array.from({ length: horizon }, () => []),
    baselines: number[][] = Array.from({ length: horizon }, () => []);
  for (let run = 0; run < 600; run++) {
    const rng = seeded(seed + Math.imul(run, 2654435761));
    let current = backlog,
      base = backlog;
    for (let day = 0; day < horizon; day++) {
      const sampled = Math.floor(rng() * n),
        arrival = clamp(projected[day] + residuals[sampled], 0, 100_000),
        done = recent[sampled].completed;
      current = Math.max(
        0,
        current + arrival * (1 + demand / 100) - done * (1 + capacity / 100),
      );
      base = Math.max(0, base + arrival - done);
      simulations[day].push(current);
      baselines[day].push(base);
    }
  }
  const endDate = Date.parse(rows.at(-1)!.date + 'T00:00:00Z');
  const forecast: ForecastPoint[] = simulations.map((samples, i) => {
    const sorted = samples.sort((a, b) => a - b),
      baseline = baselines[i].sort((a, b) => a - b);
    return {
      date: new Date(endDate + (i + 1) * DAY).toISOString().slice(0, 10),
      median: round(quantile(sorted, 0.5)),
      low: round(quantile(sorted, 0.1)),
      high: round(quantile(sorted, 0.9)),
      baseline: round(quantile(baseline, 0.5)),
      arrivals: round(projected[i] * (1 + demand / 100)),
      capacity: round(throughput * (1 + capacity / 100)),
    };
  });
  const last = forecast.at(-1)!;
  const recommendation = throughput
    ? Math.ceil(
        ((mean(projected) * (1 + demand / 100) + backlog / horizon) /
          throughput -
          1) *
          100,
      )
    : null;
  const anomalies = recent.filter(
    (r) =>
      incoming > 0 && Math.abs(r.incoming - incoming) > 2 * Math.sqrt(variance),
  ).length;
  return {
    history,
    forecast,
    incoming,
    throughput,
    backlog,
    variation,
    load,
    days,
    score,
    pressure,
    queueRisk,
    noiseRisk,
    last,
    recommendation,
    anomalies,
    change: last.median - backlog,
    sampleDays: n,
  };
}
export type Analysis = ReturnType<typeof analyze>;
export function exportForecast(analysis: Analysis, settings: Settings) {
  return (
    'date,queue_median,queue_p10,queue_p90,queue_baseline,expected_incoming,capacity,capacity_change_pct,demand_change_pct\n' +
    analysis.forecast
      .map((p) =>
        [
          p.date,
          p.median,
          p.low,
          p.high,
          p.baseline,
          p.arrivals,
          p.capacity,
          settings.capacity,
          settings.demand,
        ].join(','),
      )
      .join('\n')
  );
}
