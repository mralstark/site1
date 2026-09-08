'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  CircleHelp,
  Database,
  Download,
  FlaskConical,
  Gauge,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Waves,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  ForecastChart,
  Sparkline,
  number,
  date,
} from '@/components/forecast-chart';
import {
  analyze,
  DEMO,
  DEFAULT_SETTINGS,
  parseCsv,
  toCsv,
  exportForecast,
  type Observation,
  type Settings,
} from '@/lib/analytics';
import { useForecastTool } from '@/hooks/use-forecast-tool';

function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Home() {
  const [rows, setRows] = useState<Observation[]>(DEMO),
    [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState('overview'),
    [editor, setEditor] = useState(false),
    [method, setMethod] = useState(false),
    [band, setBand] = useState(true),
    [slop, setSlop] = useState(false);
  const [draft, setDraft] = useState(toCsv(DEMO)),
    [draftBacklog, setDraftBacklog] = useState('40'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [source, setSource] = useState('Демонстрационные данные');
  const result = useMemo(() => analyze(rows, settings), [rows, settings]);
  useForecastTool((nextRows, nextSettings) => {
    setRows(nextRows);
    setSettings(nextSettings);
    setSource('Ваши данные');
    setTab('overview');
    setEditor(false);
    setNotice('Прогноз обновлён.');
  });
  const update = (key: 'capacity' | 'demand', v: number | readonly number[]) =>
    setSettings((s) => ({ ...s, [key]: typeof v === 'number' ? v : v[0] }));
  const openEditor = () => {
    setDraft(toCsv(rows));
    setDraftBacklog(String(settings.initialBacklog));
    setError('');
    setEditor(true);
  };
  const apply = () => {
    try {
      const parsed = parseCsv(draft);
      if (!/^\d+$/.test(draftBacklog))
        throw new Error('Начальная очередь — целое неотрицательное число.');
      const next = { ...settings, initialBacklog: Number(draftBacklog) };
      analyze(parsed, next);
      setRows(parsed);
      setSettings(next);
      setSource('Ваши данные');
      setEditor(false);
      setNotice(`Загружено ${parsed.length} дней. Все расчёты обновлены.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать данные.');
    }
  };
  const level =
    result.score >= 65
      ? 'Высокая нагрузка'
      : result.score >= 35
        ? 'Есть напряжение'
        : 'Рабочий ритм';
  const loadText = Number.isFinite(result.load)
    ? `${number(result.load * 100)}%`
    : 'Нет выполнения';
  const applyRecommendation = () => {
    if (result.recommendation !== null) {
      setSettings((s) => ({
        ...s,
        capacity: Math.max(
          0,
          Math.min(100, Math.ceil(result.recommendation! / 5) * 5),
        ),
      }));
      setNotice(
        result.recommendation > 100
          ? 'Применено +100% — максимум сценария. Расчётная потребность выше этого значения.'
          : 'Рекомендованная мощность применена к сценарию с округлением вверх до 5%.',
      );
    }
  };
  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        К расчётам
      </a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="ШУМ — главная">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          ШУМ
          <span className="brand-divider" />
          <span className="brand-description">Лаборатория прогнозов</span>
        </Link>
        <div className="top-actions">
          <span className="local-status">
            <i /> Локальный расчёт
          </span>
          <button
            onClick={() => setMethod(true)}
            className="icon-button"
            aria-label="Как это работает"
          >
            <CircleHelp size={19} />
          </button>
          <span className="avatar">Ш</span>
        </div>
      </header>
      <main id="workspace" className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <FlaskConical size={13} /> ЭКСПЕРИМЕНТ 001 <span>/</span>{' '}
              ОПЕРАЦИОННЫЙ ХАОС
            </div>
            <h1>
              Пульс команды<span className="heading-dot">.</span>
            </h1>
            <p className="page-description">
              Меньше ощущений. Больше измеримого будущего.
            </p>
          </div>
          <div className="heading-actions">
            <Button
              variant="outline"
              className="action-button"
              onClick={() => {
                download(exportForecast(result, settings), 'shum-forecast.csv');
                setNotice('Прогноз сохранён в CSV.');
              }}
            >
              <Download /> Экспорт
            </Button>
            <Button
              className="action-button primary-button"
              onClick={openEditor}
            >
              <Upload /> Загрузить данные
            </Button>
          </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(String(v))}
          className="workspace-tabs"
        >
          <div className="view-toolbar">
            <TabsList variant="line" className="main-tabs">
              <TabsTrigger value="overview">
                <Activity /> Обзор
              </TabsTrigger>
              <TabsTrigger value="data">
                <Database /> Исходные данные{' '}
                <span className="count">{rows.length}</span>
              </TabsTrigger>
            </TabsList>
            <span className="data-source">
              <span className="source-dot" />
              {source}
              <span className="date-range">
                {date(rows[0].date)} — {date(rows.at(-1)!.date)}
              </span>
            </span>
          </div>
          <output aria-live="polite" className={notice ? 'notice' : 'sr-only'}>
            {notice && <Check size={15} />} {notice}
          </output>
          <TabsContent value="overview">
            <section className="metrics" aria-label="Ключевые метрики">
              <article className="metric">
                <div className="metric-label">
                  Входящий поток <ArrowDownRight size={17} />
                </div>
                <div className="metric-value">
                  {number(result.incoming, 1)}
                  <span>задач / день</span>
                </div>
                <div className="metric-bottom">
                  <span>Среднее за {result.sampleDays} дней</span>
                  <Sparkline values={rows.slice(-14).map((r) => r.incoming)} />
                </div>
              </article>
              <article className="metric">
                <div className="metric-label">
                  Пропускная способность <Zap size={16} />
                </div>
                <div className="metric-value">
                  {number(result.throughput, 1)}
                  <span>задач / день</span>
                </div>
                <div className="metric-bottom">
                  <span>Фактическое выполнение</span>
                  <Sparkline
                    values={rows.slice(-14).map((r) => r.completed)}
                    color="#baa3ef"
                  />
                </div>
              </article>
              <article className="metric">
                <div className="metric-label">
                  Очередь сейчас <Layers3 size={17} />
                </div>
                <div className="metric-value">
                  {number(result.backlog)}
                  <span>задач</span>
                </div>
                <div className="metric-bottom">
                  <span>
                    <b className="muted-white">{number(result.days, 1)} дн.</b>{' '}
                    текущей мощности
                  </span>
                  <Sparkline
                    values={result.history.slice(-14).map((r) => r.backlog)}
                    color="#a5c9f4"
                  />
                </div>
              </article>
              <article className="metric risk-metric">
                <div className="metric-label">
                  Индекс перегрузки <Gauge size={17} />
                </div>
                <div className="metric-value">
                  {result.score}
                  <span>/ 100</span>
                  <span
                    className={`risk-badge ${result.score >= 65 ? 'high' : ''}`}
                  >
                    {level}
                  </span>
                </div>
                <div className="risk-track">
                  <i style={{ width: `${result.score}%` }} />
                </div>
                <div className="metric-note">Эвристика, не вероятность</div>
              </article>
            </section>
            <div className="analysis-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Траектория очереди{' '}
                      <span className="live-badge">
                        <i /> МОДЕЛЬ АКТИВНА
                      </span>
                    </h2>
                    <p>Что будет с незавершёнными задачами</p>
                  </div>
                  <fieldset className="periods" aria-label="Горизонт прогноза">
                    {[7, 14, 30].map((n) => (
                      <Button
                        key={n}
                        variant="ghost"
                        aria-pressed={settings.horizon === n}
                        className={settings.horizon === n ? 'selected' : ''}
                        onClick={() =>
                          setSettings((s) => ({ ...s, horizon: n }))
                        }
                      >
                        {n} дн.
                      </Button>
                    ))}
                  </fieldset>
                </div>
                <div className="chart-summary">
                  <span className="chart-number">
                    {number(result.last.median)}
                  </span>
                  <span className="chart-summary-caption">
                    задач к {date(result.last.date)}
                    <span className={result.change > 0 ? 'warm' : 'lime'}>
                      {result.change > 0 ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <ArrowDownRight size={14} />
                      )}{' '}
                      {result.change > 0 ? '+' : ''}
                      {number(result.change)} к текущей очереди
                    </span>
                  </span>
                  <span className="chart-unit">ЗАДАЧИ</span>
                </div>
                <ForecastChart result={result} band={band} />
                <div className="chart-footer">
                  <div className="legend">
                    <span>
                      <i className="legend-line" /> Факт
                    </span>
                    <span>
                      <i className="legend-line dashed" /> Сценарий
                    </span>
                    <span>
                      <i className="legend-line base" /> Без изменений
                    </span>
                  </div>
                  <label className="switch-label" htmlFor="range-switch">
                    <Switch
                      id="range-switch"
                      checked={band}
                      onCheckedChange={setBand}
                      aria-label="Показать диапазон P10–P90"
                    />{' '}
                    Диапазон P10–P90
                  </label>
                </div>
              </section>
              <section className="panel scenario-panel">
                <div className="panel-heading">
                  <h2>
                    <SlidersHorizontal size={17} /> А что, если…
                  </h2>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setSettings((s) => ({ ...s, capacity: 0, demand: 0 }));
                      setNotice('Сценарий сброшен.');
                    }}
                    aria-label="Сбросить сценарий"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <p className="scenario-intro">
                  Измените условия. Будущее пересчитается.
                </p>
                <div className="slider-group">
                  <div className="slider-label">
                    <span id="capacity-label">Мощность команды</span>
                    <output>
                      {settings.capacity > 0 ? '+' : ''}
                      {settings.capacity}%
                    </output>
                  </div>
                  <Slider
                    aria-labelledby="capacity-label"
                    value={[settings.capacity]}
                    min={-50}
                    max={100}
                    step={5}
                    onValueChange={(v) => update('capacity', v)}
                    className="scenario-slider"
                  />
                  <div className="slider-scale">
                    <span>−50%</span>
                    <span>Без изменений</span>
                    <span>+100%</span>
                  </div>
                </div>
                <div className="slider-group">
                  <div className="slider-label">
                    <span id="demand-label">Входящий поток</span>
                    <output className="violet">
                      {settings.demand > 0 ? '+' : ''}
                      {settings.demand}%
                    </output>
                  </div>
                  <Slider
                    aria-labelledby="demand-label"
                    value={[settings.demand]}
                    min={-50}
                    max={100}
                    step={5}
                    onValueChange={(v) => update('demand', v)}
                    className="scenario-slider violet-slider"
                  />
                  <div className="slider-scale">
                    <span>−50%</span>
                    <span>Без изменений</span>
                    <span>+100%</span>
                  </div>
                </div>
                <div className="scenario-outcome">
                  <span>Эффект сценария к {date(result.last.date)}</span>
                  <strong>
                    {result.last.median - result.last.baseline > 0 ? '+' : ''}
                    {number(result.last.median - result.last.baseline)}{' '}
                    <small>задач в очереди</small>
                  </strong>
                  <span>относительно работы без изменений</span>
                </div>
                <div className="scenario-note">
                  <span className="small-orbit">✳</span>
                  <span>
                    Будущее ещё не случилось.
                    <br />
                    Самое время его отредактировать.
                  </span>
                </div>
              </section>
              <section className="panel signals-panel">
                <div className="panel-heading">
                  <h2>
                    <Waves size={17} /> Сигналы из шума
                  </h2>
                  <span className="subtle-tag">3 ЭВРИСТИКИ</span>
                </div>
                <div className="signal-row">
                  <span
                    className={`signal-icon ${result.load > 1 ? 'warm-bg' : 'lime-bg'}`}
                  >
                    <Activity size={18} />
                  </span>
                  <div>
                    <h3>
                      {result.load > 1
                        ? 'Задачи приходят быстрее, чем уходят'
                        : 'Поток укладывается в мощность'}
                    </h3>
                    <p>Отношение входящего потока к выполнению — {loadText}.</p>
                  </div>
                  <span
                    className={`signal-status ${result.load > 1 ? 'warm' : 'lime'}`}
                  >
                    {result.load > 1 ? 'Дисбаланс' : 'Баланс'}
                  </span>
                </div>
                <div className="signal-row">
                  <span className="signal-icon violet-bg">
                    <Layers3 size={18} />
                  </span>
                  <div>
                    <h3>
                      {result.days > 5
                        ? 'Очередь требует внимания'
                        : 'Очередь в пределах пяти дней'}
                    </h3>
                    <p>
                      {number(result.days, 1)} дня работы без новых поступлений.
                    </p>
                  </div>
                  <span className="signal-status violet">Очередь</span>
                </div>
                <div className="signal-row">
                  <span className="signal-icon blue-bg">
                    <AudioLines size={18} />
                  </span>
                  <div>
                    <h3>
                      {result.variation > 0.3
                        ? 'Поток заметно колеблется'
                        : 'Входящий поток достаточно стабилен'}
                    </h3>
                    <p>
                      Коэффициент вариации {number(result.variation * 100)}%.
                      Выбросов: {result.anomalies}.
                    </p>
                  </div>
                  <span className="signal-status blue">Ритм</span>
                </div>
              </section>
              <section className="panel insight-panel">
                <div className="panel-heading">
                  <h2>
                    <Sparkles size={17} /> Синтез смысла
                  </h2>
                  <label
                    htmlFor="slop-switch"
                    className="slop-switch"
                    title="Ироничная формулировка по шаблону"
                  >
                    <span>СЛОП</span>
                    <Switch
                      id="slop-switch"
                      size="sm"
                      checked={slop}
                      onCheckedChange={setSlop}
                      aria-label="Корпоративный нейрослоп"
                    />
                  </label>
                </div>
                <p className="insight-text">
                  {slop
                    ? `Квантовый синергизатор обнаружил ${number(result.backlog)} единиц операционной энтропии. ${result.recommendation === null ? 'Нужен хотя бы один завершённый тикет, чтобы разогнать маховик продуктивности.' : `Рекомендуется масштабировать пропускной дзен на ${Math.max(0, result.recommendation)}%.`}`
                    : result.recommendation === null
                      ? 'В данных нет завершённых задач. Сначала определите доступную мощность команды.'
                      : result.recommendation <= 0
                        ? 'Текущей мощности достаточно, чтобы погасить очередь на выбранном горизонте. Сохраните рабочий ритм.'
                        : `Чтобы разобрать очередь за ${settings.horizon} дней, модели нужно около +${result.recommendation}% мощности при выбранном потоке.`}
                </p>
                <Button
                  variant="ghost"
                  className="insight-action"
                  onClick={applyRecommendation}
                  disabled={result.recommendation === null}
                >
                  {result.recommendation !== null && result.recommendation > 100
                    ? 'Проверить +100% мощности'
                    : 'Примерить рекомендацию'}
                  <ArrowRight size={16} />
                </Button>
                <div className="insight-disclaimer">
                  {slop
                    ? 'Ироничный шаблон · без AI API'
                    : 'Расчётная оценка · проверьте доступность ресурсов'}
                </div>
              </section>
            </div>
            <div className="model-footnote">
              <span>
                <span className="status-dot" /> 600 симуляций · тренд за{' '}
                {result.sampleDays} дней · все вычисления в браузере
              </span>
              <button onClick={() => setMethod(true)}>
                Как устроена модель <ArrowUpRight size={13} />
              </button>
            </div>
          </TabsContent>
          <TabsContent value="data">
            <section className="panel data-panel">
              <div className="panel-heading">
                <div>
                  <h2>Наблюдения, с которых всё начинается</h2>
                  <p>
                    {rows.length} календарных дней · начальная очередь{' '}
                    {number(settings.initialBacklog)} задач
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="action-button"
                  onClick={openEditor}
                >
                  Изменить данные <ArrowRight size={15} />
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Поступило</TableHead>
                    <TableHead>Завершено</TableHead>
                    <TableHead>Изменение</TableHead>
                    <TableHead>Очередь</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.history.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell>
                        {date(r.date)} {r.date.slice(0, 4)}
                      </TableCell>
                      <TableCell>{number(r.incoming)}</TableCell>
                      <TableCell>{number(r.completed)}</TableCell>
                      <TableCell
                        className={r.incoming > r.completed ? 'warm' : 'lime'}
                      >
                        {r.incoming > r.completed ? '+' : ''}
                        {r.incoming - r.completed}
                      </TableCell>
                      <TableCell>{number(r.backlog)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </TabsContent>
        </Tabs>
        <footer className="footer">
          <span className="footer-brand">
            <AudioLines size={17} /> ШУМ <span>v1.0</span>
          </span>
          <span>Из хаоса — в осмысленный следующий шаг.</span>
          <span>Никакой магии. Немного математики.</span>
        </footer>
      </main>
      <Dialog open={editor} onOpenChange={setEditor}>
        <DialogContent className="data-dialog" showCloseButton={false}>
          <div className="dialog-top">
            <DialogTitle>Дайте хаосу структуру</DialogTitle>
            <DialogClose className="icon-button" aria-label="Закрыть">
              ×
            </DialogClose>
          </div>
          <DialogDescription>
            По одной строке на календарный день, включая дни без задач. От 7 до
            366 дней. Данные обрабатываются только в этом окне и не сохраняются
            после обновления.
          </DialogDescription>
          <div className="file-controls">
            <label className="file-picker">
              <Upload size={16} /> Выбрать CSV
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const f = input.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 100_000)
                      throw new Error('Максимальный размер файла — 100 КБ.');
                    setDraft(await f.text());
                    setError('');
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Не удалось прочитать файл.',
                    );
                  }
                  input.value = '';
                }}
              />
            </label>
            <Button
              variant="ghost"
              onClick={() => download(toCsv(DEMO), 'shum-example.csv')}
            >
              Скачать пример <Download size={14} />
            </Button>
          </div>
          <label className="input-label" htmlFor="csv-input">
            Данные CSV <span>date, incoming, completed</span>
          </label>
          <textarea
            id="csv-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <label className="input-label" htmlFor="initial-queue">
            Очередь до первого дня
          </label>
          <input
            id="initial-queue"
            className="number-input"
            inputMode="numeric"
            type="number"
            min="0"
            max="1000000"
            step="1"
            value={draftBacklog}
            onChange={(e) => setDraftBacklog(e.target.value)}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(toCsv(DEMO));
                setDraftBacklog('40');
                setError('');
              }}
            >
              Вставить демоданные
            </Button>
            <Button className="action-button" onClick={apply}>
              Рассчитать <ArrowRight size={16} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={method} onOpenChange={setMethod}>
        <DialogContent className="method-dialog" showCloseButton={false}>
          <div className="dialog-top">
            <DialogTitle>Математика за шумом</DialogTitle>
            <DialogClose className="icon-button" aria-label="Закрыть">
              ×
            </DialogClose>
          </div>
          <DialogDescription>
            Прозрачная модель операционной очереди. Версия 1.0.
          </DialogDescription>
          <div className="method-body">
            <h3>01 / Наблюдения</h3>
            <p>
              Очередь = начальная очередь + поступившие − завершённые задачи.
              Средние и вариация считаются по последним 14 дням (или всем, если
              их меньше). Даты — последовательные календарные дни; пропуски и
              отрицательная очередь отклоняются.
            </p>
            <h3>02 / Прогноз</h3>
            <p>
              Линейный тренд поступлений затухает по формуле 7 × (1 −
              exp(−h/7)). Из последних наблюдений 600 раз выбираются связанные
              пары: остаток тренда и выполненные задачи. Сценарий масштабирует
              входящий поток и выполнение. Каждый день очередь ограничена снизу
              нулём.
            </p>
            <h3>03 / Диапазон и ограничения</h3>
            <p>
              P10–P90 — центральные 80% смоделированных исходов, а не
              гарантированный доверительный интервал. Модель не учитывает
              недельную сезонность, смену процессов, сложность задач и внешние
              события. Пропускная способность оценивается по фактическому
              выполнению. Одинаковые входные данные дают одинаковый прогноз.
            </p>
            <h3>04 / Индекс перегрузки</h3>
            <p>
              От 0 до 100: дисбаланс потока (50 баллов), длина очереди (30) и
              вариация поступлений (20). Формула: 50 × clamp((нагрузка − 0,8) /
              0,7) + 30 × clamp(дни очереди / 10) + 20 × clamp(CV / 0,5), где
              clamp ограничивает значение от 0 до 1. Пороги: 35 и 65.
            </p>
            <h3>05 / Рекомендация</h3>
            <p>
              Мощность для погашения очереди ≈ (средний будущий поток + текущая
              очередь / горизонт) / текущее выполнение − 1. Это ориентир, не
              гарантия. «СЛОП» меняет только формулировку на ироничный локальный
              шаблон. Нейросеть и внешние API не используются.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
