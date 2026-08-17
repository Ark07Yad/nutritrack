import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { todayKey, parseKey } from '../lib/calc';
import { cycleStatus, weightContext } from '../lib/cycle';
import { showCycle } from './Cycle';
import { AnimatedNumber, Badge, Button, Card, Icon, NumberInput, SectionTitle, stagger } from './ui';

const DAY = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weekly weigh-in.
 *
 * Typing a decimal into a text field is a small thing to get wrong and a
 * surprisingly effective way to stop people weighing in at all. Two changes fix
 * most of it: default to the last known weight so the common case is a couple
 * of taps on ±0.1, and compare against a **rolling average** rather than the
 * previous single reading.
 *
 * The average matters more than the input. Day-to-day weight swings by a kilo
 * or more on food volume, salt, hydration and — for half the population — where
 * you are in your cycle. Comparing Monday to last Monday reads that noise as
 * signal, which is how people conclude a working diet has failed. Comparing
 * seven-day averages is what actually tracks fat change.
 */
export default function WeighIn({ compact = false }) {
  const { state, dispatch } = useStore();
  const p = state.profile;
  const today = todayKey();
  const [open, setOpen] = useState(false);

  const weighInDay = p.weighInDay ?? 1;
  const imperial = p.units === 'imperial';
  const unit = imperial ? 'lb' : 'kg';
  const toDisplay = (kg) => (imperial ? kg * 2.20462 : kg);
  const toKg = (v) => (imperial ? v / 2.20462 : v);

  const analysis = useMemo(() => {
    const entries = Object.entries(state.days)
      .filter(([, d]) => typeof d.weight === 'number' && d.weight > 0)
      .map(([key, d]) => ({ key, at: parseKey(key).getTime(), weight: d.weight }))
      .sort((a, b) => a.at - b.at);

    const windowAvg = (endAt, days = 7) => {
      const from = endAt - days * DAY;
      const inRange = entries.filter((e) => e.at > from && e.at <= endAt);
      if (!inRange.length) return null;
      return inRange.reduce((s, e) => s + e.weight, 0) / inRange.length;
    };

    const now = Date.now();
    const thisWeek = windowAvg(now);
    const lastWeek = windowAvg(now - 7 * DAY);
    const latest = entries.at(-1) || null;

    const daysSince = latest ? Math.floor((now - latest.at) / DAY) : null;

    return {
      entries,
      latest,
      daysSince,
      loggedToday: !!state.days[today]?.weight,
      thisWeek,
      lastWeek,
      // Only meaningful once both windows have data — a single reading against
      // a single reading is exactly the comparison this is trying to avoid.
      change: thisWeek != null && lastWeek != null ? thisWeek - lastWeek : null,
      trustworthy: entries.length >= 4,
    };
  }, [state.days, today]);

  const startWeight = analysis.latest?.weight ?? p.weight ?? 70;
  const [draft, setDraft] = useState(() => toDisplay(startWeight));

  const isWeighInDay = new Date().getDay() === weighInDay;
  const due = !analysis.loggedToday && (isWeighInDay || (analysis.daysSince ?? 99) >= 7);

  const save = (displayValue) => {
    const kg = Number(toKg(displayValue).toFixed(1));
    dispatch({ type: 'logWeight', date: today, weight: kg });
    setOpen(false);
  };

  const cycle = showCycle(p) ? cycleStatus(state.cycle) : null;
  const cycleNote = cycle ? weightContext(cycle) : null;

  /* Compact form: a single prompt for the dashboard. */
  if (compact && !open) {
    if (analysis.loggedToday) {
      return (
        <div className="surface rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint mb-1.5">
            <Icon name="scale" className="size-3.5" /> Weight
          </div>
          <div className="text-[22px] font-semibold tabular leading-none">
            <AnimatedNumber value={toDisplay(state.days[today].weight)} decimals={1} />
            <span className="text-[12px] font-normal text-faint ml-1">{unit}</span>
          </div>
          <div className="text-[11px] text-faint mt-2">
            {analysis.change != null
              ? `${analysis.change > 0 ? '+' : ''}${toDisplay(analysis.change).toFixed(2)} ${unit} vs last week`
              : 'Logged today'}
          </div>

          {/*
            The cycle note belongs here more than anywhere. A rise of a kilo in
            the week before a period is water, and this card — seen daily, right
            next to the number that moved — is where that gets misread as the
            diet failing. Only a phase where it is actually true renders.
          */}
          {cycleNote && (
            <p className="text-[10.5px] text-warn mt-2 leading-snug">
              {cycleNote.split('. ')[0]}.
            </p>
          )}
        </div>
      );
    }
    return (
      <button
        onClick={() => { setDraft(toDisplay(startWeight)); setOpen(true); }}
        className={`surface rounded-2xl p-3.5 text-left w-full transition-all hover:[background:var(--surface-hover)]
                    ${due ? 'border border-brand-400/40' : ''}`}
      >
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint mb-1.5">
          <Icon name="scale" className="size-3.5" /> Weight
        </div>
        <div className="text-[15px] font-semibold">
          {due ? 'Weigh-in due' : 'Log weight'}
        </div>
        <div className="text-[11px] text-faint mt-2">
          {analysis.daysSince == null
            ? 'Tap to record your first'
            : `Last logged ${analysis.daysSince === 0 ? 'today' : `${analysis.daysSince} day${analysis.daysSince === 1 ? '' : 's'} ago`}`}
        </div>
      </button>
    );
  }

  /* Full form: the stepper, the average, and the trend. */
  return (
    <Card className="p-5" glow={due}>
      <SectionTitle
        icon="scale"
        action={
          analysis.loggedToday
            ? <Badge tone="good">logged today</Badge>
            : due ? <Badge tone="warn">due</Badge> : null
        }
      >
        Weekly weigh-in
      </SectionTitle>

      {/* Big stepper — the point is that this takes two taps, not typing. */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDraft((v) => Math.max(20, +(v - 0.1).toFixed(1)))}
          aria-label="Decrease"
          className="size-12 rounded-2xl grid place-items-center surface active:scale-90 transition-transform shrink-0"
        >
          <Icon name="minus" className="size-5" />
        </button>

        <div className="flex-1 text-center">
          <NumberInput
            unstyled
            value={+draft.toFixed(1)}
            min={20}
            max={imperial ? 900 : 400}
            decimals={1}
            fallback={toDisplay(startWeight)}
            onChange={(v) => setDraft(v ?? toDisplay(startWeight))}
            className="w-full text-center text-[38px] font-semibold tabular bg-transparent outline-none
                       border-b border-transparent focus:border-brand-400/50 transition-colors"
          />
          <div className="text-[11px] text-faint mt-1">{unit}</div>
        </div>

        <button
          onClick={() => setDraft((v) => Math.min(900, +(v + 0.1).toFixed(1)))}
          aria-label="Increase"
          className="size-12 rounded-2xl grid place-items-center surface active:scale-90 transition-transform shrink-0"
        >
          <Icon name="plus" className="size-5" />
        </button>
      </div>

      <div className="flex gap-1.5 justify-center mt-3 flex-wrap">
        {[-1, -0.5, +0.5, +1].map((d) => (
          <button
            key={d}
            onClick={() => setDraft((v) => +(v + d).toFixed(1))}
            className="px-2.5 py-1 rounded-full text-[11.5px] surface text-dim hover:text-[color:var(--text)] transition-colors"
          >
            {d > 0 ? '+' : ''}{d}
          </button>
        ))}
        {analysis.latest && (
          <button
            onClick={() => setDraft(toDisplay(analysis.latest.weight))}
            className="px-2.5 py-1 rounded-full text-[11.5px] surface text-dim hover:text-[color:var(--text)] transition-colors"
          >
            same as last
          </button>
        )}
      </div>

      <Button variant="primary" size="lg" className="w-full mt-4" onClick={() => save(draft)}>
        <Icon name="check" className="size-4" /> Save {(+draft).toFixed(1)} {unit}
      </Button>

      {/* Rolling averages — the number that actually matters. */}
      {analysis.thisWeek != null && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            ['7-day avg', toDisplay(analysis.thisWeek).toFixed(1), unit],
            ['Week before', analysis.lastWeek != null ? toDisplay(analysis.lastWeek).toFixed(1) : '—', unit],
            [
              'Change',
              analysis.change != null
                ? `${analysis.change > 0 ? '+' : ''}${toDisplay(analysis.change).toFixed(2)}`
                : '—',
              unit,
            ],
          ].map(([label, value, u], i) => (
            <div key={label} className="rounded-2xl p-3 text-center animate-rise"
                 style={{ background: 'var(--surface)', ...stagger(i) }}>
              <div className="text-[10.5px] uppercase tracking-wider text-faint">{label}</div>
              <div className="text-[16px] font-semibold tabular mt-1">
                {value}<span className="text-[10px] text-faint ml-0.5">{value === '—' ? '' : u}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!analysis.trustworthy && (
        <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
          Weight swings by a kilo or more day to day on food volume, salt and hydration alone. Four or more
          weigh-ins gives an average worth reading; a single reading against a single reading mostly measures
          noise.
        </p>
      )}

      {cycleNote && (
        <div className="mt-3 p-3 rounded-2xl border border-sky-400/25 bg-sky-500/8 flex gap-2.5">
          <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-dim leading-relaxed">{cycleNote}</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-hair flex items-center justify-between gap-3">
        <span className="text-[12px] text-dim">Remind me on</span>
        <select
          value={weighInDay}
          onChange={(e) => dispatch({ type: 'profile', patch: { weighInDay: Number(e.target.value) } })}
          className="px-3 py-1.5 rounded-xl text-[12.5px] surface outline-none"
        >
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
    </Card>
  );
}
