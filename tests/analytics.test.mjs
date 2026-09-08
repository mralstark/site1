import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze,
  DEMO,
  DEFAULT_SETTINGS,
  parseCsv,
  toCsv,
  exportForecast,
} from '../lib/analytics.ts';
const flat = (incoming, completed, n = 28) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    incoming,
    completed,
  }));
test('CSV round-trips with BOM, CRLF, quotes, reordered and Russian headers', () => {
  assert.deepEqual(
    parseCsv('\uFEFF' + toCsv(DEMO).replaceAll('\n', '\r\n')),
    DEMO,
  );
  assert.deepEqual(
    parseCsv(
      'завершено;дата;поступило\n' +
        DEMO.map((r) => `${r.completed};"${r.date}";${r.incoming}`).join('\n'),
    ),
    DEMO,
  );
  assert.deepEqual(parseCsv(toCsv(DEMO).replaceAll(',', '\t')), DEMO);
});
test('invalid CSV fails without permissive numeric coercion', () => {
  for (const value of [
    '',
    'date,incoming,completed\n2026-01-01,1,1',
    toCsv(DEMO).replace(',20,22', ',,22'),
    toCsv(DEMO).replace(',20,22', ',-2,22'),
    toCsv(DEMO).replace(',20,22', ',1e3,22'),
    toCsv(DEMO).replace(',20,22', ',3.2,22'),
    toCsv(DEMO).replace('2026-08-10', '2026-02-30'),
    toCsv(DEMO).replace('2026-08-11', '2026-08-10'),
    toCsv(DEMO).replace('2026-08-11', '2026-08-12'),
    'x'.repeat(100001),
  ])
    assert.throws(() => parseCsv(value));
});
test('constant balanced flow preserves queue exactly and has no noise', () => {
  const a = analyze(flat(10, 10), { ...DEFAULT_SETTINGS, initialBacklog: 20 });
  assert.equal(a.backlog, 20);
  assert.equal(a.variation, 0);
  assert.equal(a.throughput, 10);
  assert.equal(a.load, 1);
  for (const p of a.forecast)
    assert.deepEqual([p.low, p.median, p.high, p.baseline], [20, 20, 20, 20]);
});
test('constant overload obeys conservation of work', () => {
  const a = analyze(flat(12, 10), { ...DEFAULT_SETTINGS, initialBacklog: 0 });
  assert.equal(a.backlog, 56);
  assert.equal(a.last.median, 84);
  assert.equal(a.change, 28);
});
test('zero flow and zero capacity never create NaN or negative queues', () => {
  const idle = analyze(flat(0, 0), { ...DEFAULT_SETTINGS, initialBacklog: 0 });
  assert.equal(idle.score, 0);
  assert.equal(idle.last.median, 0);
  assert.equal(idle.recommendation, null);
  const stalled = analyze(flat(10, 0), {
    ...DEFAULT_SETTINGS,
    initialBacklog: 0,
  });
  assert.equal(stalled.load, Infinity);
  assert.equal(stalled.last.median, 420);
  assert.ok(Number.isFinite(stalled.score));
});
test('rejects inconsistent work and invalid scenario settings', () => {
  assert.throws(() =>
    analyze(flat(0, 10), { ...DEFAULT_SETTINGS, initialBacklog: 0 }),
  );
  for (const bad of [
    { horizon: 0 },
    { horizon: 365 },
    { capacity: NaN },
    { capacity: 101 },
    { demand: -51 },
    { initialBacklog: 1.2 },
    { initialBacklog: -1 },
  ])
    assert.throws(() => analyze(DEMO, { ...DEFAULT_SETTINGS, ...bad }));
});
test('forecasts are reproducible, ordered and prefix-consistent across horizons', () => {
  const a = analyze(DEMO, DEFAULT_SETTINGS),
    b = analyze(DEMO, DEFAULT_SETTINGS),
    long = analyze(DEMO, { ...DEFAULT_SETTINGS, horizon: 30 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.forecast, long.forecast.slice(0, 14));
  for (const p of a.forecast) {
    assert.ok(p.low >= 0 && p.low <= p.median && p.median <= p.high);
    assert.equal(p.median, p.baseline);
  }
});
test('increasing capacity reduces queue; demand increases it; baseline is unchanged', () => {
  const a = analyze(DEMO, DEFAULT_SETTINGS),
    capacity = analyze(DEMO, { ...DEFAULT_SETTINGS, capacity: 50 }),
    demand = analyze(DEMO, { ...DEFAULT_SETTINGS, demand: 50 });
  a.forecast.forEach((p, i) => {
    assert.ok(capacity.forecast[i].median <= p.median);
    assert.ok(demand.forecast[i].median >= p.median);
    assert.equal(capacity.forecast[i].baseline, p.baseline);
  });
});
test('queue floors at zero even if future capacity exceeds available work', () => {
  const a = analyze(flat(10, 10), {
    ...DEFAULT_SETTINGS,
    initialBacklog: 0,
    capacity: 100,
  });
  assert.ok(a.forecast.every((p) => p.median === 0 && p.low === 0));
});
test('export includes exact forecast numbers, dates and scenario settings', () => {
  const settings = { ...DEFAULT_SETTINGS, capacity: 25 },
    a = analyze(DEMO, settings),
    csv = exportForecast(a, settings),
    lines = csv.split('\n');
  assert.equal(lines.length, 15);
  assert.equal(lines[1].split(',')[0], a.forecast[0].date);
  assert.equal(Number(lines.at(-1).split(',')[1]), a.last.median);
  assert.equal(lines.at(-1).split(',')[7], '25');
});
test('maximum input is finite and bounded', () => {
  const a = analyze(flat(100000, 0, 366), {
    initialBacklog: 1000000,
    horizon: 30,
    capacity: 100,
    demand: 100,
  });
  assert.ok(
    a.forecast.every((p) =>
      Object.values(p)
        .filter((v) => typeof v === 'number')
        .every(Number.isFinite),
    ),
  );
  assert.ok(a.score >= 0 && a.score <= 100);
});
