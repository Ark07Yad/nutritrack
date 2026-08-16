import { useMemo } from 'react';
import { useStore } from '../lib/store';
import WeighIn from './WeighIn';
import { useNutrition } from '../lib/useNutrition';
import { MEAL_SLOTS } from '../data/recipes';
import { prettyDate, shortDay, isToday } from '../lib/calc';
import { analyze } from '../lib/coach';
import { AnimatedNumber, Bar, Button, Card, Icon, Ring, SectionTitle, Stat, Badge, fmt, stagger } from './ui';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

export default function Dashboard({ date, onNavigate }) {
  const { dispatch } = useStore();
  const n = useNutrition(date);
  const { plan, macros, totals, day, burned, remaining, profile, limits } = n;

  const over = totals.kcal > plan.target;
  const insights = useMemo(() => analyze(n).slice(0, 3), [n]);

  const chartData = useMemo(
    () =>
      n.history.slice(-14).map(({ key, day: d }) => {
        const kcal = Object.values(d.meals).flat().reduce((s, e) => s + (e.n?.kcal || 0), 0);
        return { day: shortDay(key), full: key, kcal: Math.round(kcal) };
      }),
    [n.history]
  );

  const hasHistory = chartData.some((d) => d.kcal > 0);
  const greeting = getGreeting();

  return (
    <div className="space-y-5 pb-4">
      {/* ── Hero ── */}
      <Card className="p-6 sm:p-7" glow>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[12.5px] text-dim">
              {greeting}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              {isToday(date) ? 'Today' : prettyDate(date)}
            </h1>
          </div>
          <Badge tone={plan.delta === 0 ? 'info' : plan.delta < 0 ? 'good' : 'warn'}>
            {plan.delta === 0 ? 'Maintaining' : `${plan.delta > 0 ? '+' : ''}${Math.round(plan.delta)} kcal/day`}
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <Ring value={totals.kcal} max={plan.target} size={192} stroke={15} over={over}>
            <div className="animate-pop">
              <div className={`text-[38px] font-semibold tabular leading-none ${over ? 'text-flame' : ''}`}>
                {Math.round(Math.abs(remaining))}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-faint mt-1.5">
                kcal {remaining >= 0 ? 'left' : 'over'}
              </div>
            </div>
          </Ring>

          <div className="flex-1 w-full space-y-3.5">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Eaten" value={Math.round(totals.kcal)} icon="plate" />
              <MiniStat label="Burned" value={Math.round(burned)} icon="flame" tone="flame" />
              <MiniStat label="Target" value={Math.round(plan.target)} icon="target" tone="brand" />
            </div>

            <div>
              <Bar label="Protein" value={totals.protein} target={macros.protein} unit="g" compact />
              <Bar label="Carbs" value={totals.carbs} target={macros.carbs} unit="g" compact />
              <Bar label="Fat" value={totals.fat} target={macros.fat} unit="g" compact />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Meals ── */}
      <div>
        <SectionTitle
          icon="plate"
          action={
            <Button size="sm" variant="ghost" onClick={() => onNavigate('diary')}>
              <Icon name="plus" className="size-3.5" /> Log food
            </Button>
          }
        >
          Meals
        </SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MEAL_SLOTS.map((slot, i) => {
            const entries = day.meals[slot.id];
            const kcal = entries.reduce((s, e) => s + (e.n?.kcal || 0), 0);
            const budget = plan.target * slot.share;
            return (
              <button
                key={slot.id}
                onClick={() => onNavigate('diary', slot.id)}
                style={stagger(i)}
                className="surface rounded-3xl p-4 text-left transition-all hover:[background:var(--surface-hover)] active:scale-[0.98] group animate-rise"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-lg">{slot.icon}</span>
                  <Icon name="plus" className="size-4 text-faint group-hover:text-good transition-colors" />
                </div>
                <div className="text-[13px] font-medium">{slot.label}</div>
                <div className="text-[19px] font-semibold tabular mt-1">
                  <AnimatedNumber value={kcal} />
                  <span className="text-[11px] text-faint font-normal ml-1">/ {Math.round(budget)}</span>
                </div>
                <div className="h-1 rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full metal"
                    style={{ width: `${Math.min(100, (kcal / budget) * 100)}%`, transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }}
                  />
                </div>
                <div className="text-[11px] text-faint mt-2 truncate">
                  {entries.length ? `${entries.length} item${entries.length > 1 ? 's' : ''}` : 'Nothing logged'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Quick numbers ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Fibre" value={fmt(totals.fiber)} unit={`/ ${limits.fiber.target} g`}
              tone={totals.fiber >= limits.fiber.target * 0.8 ? 'brand' : 'default'}
              sub={totals.fiber >= limits.fiber.target ? 'Target met' : `${Math.round(limits.fiber.target - totals.fiber)} g to go`} />
        <Stat label="Sodium" value={fmt(totals.sodium)} unit="/ 2300 mg" icon="alert"
              tone={totals.sodium > 2300 ? 'bad' : 'default'}
              sub={totals.sodium > 2300 ? 'Over the ceiling' : `${Math.round(2300 - totals.sodium)} mg headroom`} />
        <WaterCard day={day} date={date} target={limits.water.target} dispatch={dispatch} />
        <WeighIn compact />
      </div>

      {/* ── Trend ── */}
      <Card className="p-5">
        <SectionTitle icon="chart" action={<Button size="sm" variant="subtle" onClick={() => onNavigate('progress')}>All progress</Button>}>
          Last 14 days
        </SectionTitle>
        {hasHistory ? (
          <div className="h-40 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="kcalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="var(--color-brand-400)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis width={38} axisLine={false} tickLine={false}
                       domain={[0, (max) => Math.ceil(Math.max(max, plan.target) * 1.1)]} />
                <Tooltip
                  cursor={{ stroke: 'var(--border-strong)' }}
                  contentStyle={{
                    background: 'var(--bg-elev)', border: '1px solid var(--border)',
                    borderRadius: 14, fontSize: 12, boxShadow: 'var(--shadow-card)', color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                  formatter={(v) => [`${v} kcal`, 'Intake']}
                />
                <ReferenceLine y={Math.round(plan.target)} stroke="var(--color-brand-400)" strokeDasharray="4 4" strokeOpacity={0.55} />
                <Area isAnimationActive={false} type="monotone" dataKey="kcal" stroke="var(--color-brand-400)" strokeWidth={2.4} fill="url(#kcalFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[13px] text-dim py-8 text-center">
            Log a few days and your intake trend appears here, against your {Math.round(plan.target)} kcal target line.
          </p>
        )}
      </Card>

      {/* ── Coach preview ── */}
      <div>
        <SectionTitle icon="spark" action={<Button size="sm" variant="subtle" onClick={() => onNavigate('coach')}>Open coach</Button>}>
          What I'm seeing
        </SectionTitle>
        <div className="grid gap-2.5">
          {insights.map((ins, i) => (
            <InsightRow key={i} insight={ins} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

function MiniStat({ label, value, icon, tone = 'default' }) {
  const tones = { default: '', brand: 'text-good', flame: 'text-flame' };
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-faint">
        <Icon name={icon} className="size-3" /> {label}
      </div>
      <div className={`text-[17px] font-semibold tabular mt-1 ${tones[tone]}`}>
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}

export function InsightRow({ insight, index = 0 }) {
  const tones = {
    good: { icon: 'check', cls: 'bg-brand-500/14 text-good' },
    warn: { icon: 'alert', cls: 'bg-amber-500/14 text-warn' },
    bad:  { icon: 'alert', cls: 'bg-rose-500/14 text-bad' },
    info: { icon: 'info',  cls: 'bg-sky-500/14 text-info' },
  };
  const t = tones[insight.tone] || tones.info;
  return (
    <div className="surface rounded-2xl p-4 flex gap-3.5 animate-rise" style={stagger(index)}>
      <div className={`size-8 rounded-xl grid place-items-center shrink-0 ${t.cls}`}>
        <Icon name={t.icon} className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium">{insight.title}</span>
          {insight.tag && <span className="text-[10px] uppercase tracking-wider text-faint">{insight.tag}</span>}
        </div>
        <p className="text-[12.5px] text-dim mt-1 leading-relaxed">{insight.body}</p>
      </div>
    </div>
  );
}

function WaterCard({ day, date, target, dispatch }) {
  const glasses = day.water || 0;
  const litres = glasses * 0.25;
  const goalGlasses = Math.round(target / 0.25);
  return (
    <div className="surface rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint">
          <Icon name="drop" className="size-3.5" /> Water
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => dispatch({ type: 'setDayField', date, field: 'water', value: Math.max(0, glasses - 1) })}
            className="size-6 rounded-lg grid place-items-center text-faint hover:text-[color:var(--text)] hover:[background:var(--border)] active:scale-90 transition"
            aria-label="Remove a glass"
          ><Icon name="minus" className="size-3" /></button>
          <button
            onClick={() => dispatch({ type: 'setDayField', date, field: 'water', value: glasses + 1 })}
            className="size-6 rounded-lg grid place-items-center text-info hover:bg-sky-500/15 active:scale-90 transition"
            aria-label="Add a glass"
          ><Icon name="plus" className="size-3" /></button>
        </div>
      </div>
      <div className="text-[22px] font-semibold tabular leading-none mt-1.5 text-info">
        {litres.toFixed(2)}<span className="text-[12px] font-normal text-faint ml-1">/ {target} L</span>
      </div>
      <div className="flex gap-[3px] mt-2.5 flex-wrap">
        {Array.from({ length: goalGlasses }).map((_, i) => (
          <div key={i} className={`h-4 w-[7px] rounded-full transition-all duration-300 ${i < glasses ? 'bg-sky-400' : ''}`}
               style={i >= glasses ? { background: 'var(--border)' } : undefined} />
        ))}
      </div>
    </div>
  );
}


function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good evening';
}
