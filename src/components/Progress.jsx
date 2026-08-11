import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import { shortDay, shortDate, KCAL_PER_KG } from '../lib/calc';
import { Badge, Card, Icon, SectionTitle, Segmented, Stat, fmt } from './ui';
import {
  ComposedChart, Area, LineChart, Line, BarChart, Bar as RBar, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export default function Progress({ date }) {
  const { state } = useStore();
  const n = useNutrition(date);
  const [range, setRange] = useState(14);

  const series = useMemo(() => {
    return n.history.slice(-range).map(({ key, day }) => {
      const entries = Object.values(day.meals).flat();
      const kcal = entries.reduce((s, e) => s + (e.n?.kcal || 0), 0);
      const protein = entries.reduce((s, e) => s + (e.n?.protein || 0), 0);
      const carbs = entries.reduce((s, e) => s + (e.n?.carbs || 0), 0);
      const fat = entries.reduce((s, e) => s + (e.n?.fat || 0), 0);
      const fiber = entries.reduce((s, e) => s + (e.n?.fiber || 0), 0);
      const burned = day.workouts.reduce((s, w) => s + (w.kcal || 0), 0);
      return {
        key,
        label: shortDate(key),
        short: shortDay(key),
        kcal: Math.round(kcal),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        fiber: Math.round(fiber),
        burned: Math.round(burned),
        net: Math.round(kcal - burned),
        weight: day.weight || null,
        logged: entries.length > 0,
      };
    });
  }, [n.history, range]);

  const loggedDays = series.filter((d) => d.logged);
  const weighIns = series.filter((d) => d.weight);

  const avg = (k) => (loggedDays.length ? loggedDays.reduce((s, d) => s + d[k], 0) / loggedDays.length : 0);
  const avgKcal = avg('kcal');
  const avgProtein = avg('protein');
  const avgNet = avg('net');
  const totalBurn = series.reduce((s, d) => s + d.burned, 0);

  const dailyGap = avgNet - n.plan.target;
  const projectedWeekly = (dailyGap * 7) / KCAL_PER_KG;

  const weightChange = weighIns.length >= 2 ? weighIns[weighIns.length - 1].weight - weighIns[0].weight : null;

  const streak = useMemo(() => {
    let s = 0;
    for (let i = n.history.length - 1; i >= 0; i--) {
      if (Object.values(n.history[i].day.meals).flat().length > 0) s++;
      else break;
    }
    return s;
  }, [n.history]);

  const tooltipStyle = {
    background: 'var(--bg-elev)', border: '1px solid var(--border)',
    borderRadius: 14, fontSize: 12, color: 'var(--text)', boxShadow: 'var(--shadow-card)',
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
          <p className="text-[12.5px] text-dim mt-0.5">
            {loggedDays.length} of {range} days logged
          </p>
        </div>
        <Segmented value={range} onChange={setRange} options={RANGES} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Avg intake" value={Math.round(avgKcal)} unit="kcal" icon="plate"
              sub={`Target ${Math.round(n.plan.target)}`}
              tone={Math.abs(avgKcal - n.plan.target) < n.plan.target * 0.08 ? 'brand' : 'default'} />
        <Stat label="Avg protein" value={Math.round(avgProtein)} unit="g" icon="bolt"
              sub={`Target ${n.macros.protein} g`}
              tone={avgProtein >= n.macros.protein * 0.9 ? 'brand' : 'warn'} />
        <Stat label="Total burned" value={fmt(totalBurn)} unit="kcal" icon="flame" tone="warn"
              sub={`${series.filter((d) => d.burned > 0).length} active days`} />
        <Stat label="Logging streak" value={streak} unit={streak === 1 ? 'day' : 'days'} icon="calendar" tone="iris"
              sub={streak >= 7 ? 'Strong habit forming' : 'Consistency beats perfection'} />
      </div>

      {/* Projection */}
      {loggedDays.length >= 3 && (
        <Card className="p-5" glow>
          <SectionTitle icon="target">What your logged data projects</SectionTitle>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Daily balance</div>
              <div className={`text-2xl font-semibold tabular mt-1 ${dailyGap < 0 ? 'text-good' : 'text-flame'}`}>
                {dailyGap > 0 ? '+' : ''}{Math.round(dailyGap)}
              </div>
              <div className="text-[11.5px] text-faint mt-1">kcal vs target, after exercise</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Projected rate</div>
              <div className={`text-2xl font-semibold tabular mt-1 ${projectedWeekly < 0 ? 'text-good' : 'text-flame'}`}>
                {projectedWeekly > 0 ? '+' : ''}{projectedWeekly.toFixed(2)}
              </div>
              <div className="text-[11.5px] text-faint mt-1">kg per week at this average</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-faint">Actual change</div>
              <div className={`text-2xl font-semibold tabular mt-1 ${weightChange === null ? 'text-faint' : weightChange < 0 ? 'text-good' : 'text-flame'}`}>
                {weightChange === null ? '—' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}`}
              </div>
              <div className="text-[11.5px] text-faint mt-1">
                {weightChange === null ? 'Log weight twice to compare' : `kg across ${weighIns.length} weigh-ins`}
              </div>
            </div>
          </div>

          {weightChange !== null && loggedDays.length >= 5 && (
            <div className="mt-4 pt-4 border-t border-hair flex gap-2.5">
              <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
              <p className="text-[12px] text-dim leading-relaxed">
                {Math.abs(weightChange - projectedWeekly * (range / 7)) < 0.7
                  ? 'Your actual weight change is tracking close to what your logged intake predicts — that means your logging is accurate and you can trust these numbers.'
                  : `Your logged intake predicts ${(projectedWeekly * (range / 7)).toFixed(1)} kg over this period but the scale says ${weightChange.toFixed(1)} kg. The usual cause is under-logging — oil, sauces and bites while cooking. Water retention explains gaps of up to a kilo either way.`}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Calories */}
      <Card className="p-5">
        <SectionTitle icon="chart" action={<Badge tone="neutral">dashed line = target</Badge>}>
          Calorie intake
        </SectionTitle>
        <div className="h-52 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pKcal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-400)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-brand-400)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              {/* Keep the target line inside the plot area even on very low days. */}
              <YAxis width={42} axisLine={false} tickLine={false}
                     domain={[0, (max) => Math.ceil(Math.max(max, n.plan.target) * 1.1)]} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-dim)' }}
                       formatter={(v, k) => [`${v} kcal`, k === 'kcal' ? 'Eaten' : 'Net']} />
              <ReferenceLine y={Math.round(n.plan.target)} stroke="var(--color-brand-400)" strokeDasharray="5 5" strokeOpacity={0.7} />
              <Area isAnimationActive={false} type="monotone" dataKey="kcal" stroke="var(--color-brand-400)" strokeWidth={2.4} fill="url(#pKcal)" />
              <Line isAnimationActive={false} type="monotone" dataKey="net" stroke="var(--color-sky-glow)" strokeWidth={1.6} strokeDasharray="3 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Macros */}
      <Card className="p-5">
        <SectionTitle icon="plate">Macronutrients</SectionTitle>
        <div className="h-52 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis width={38} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-dim)' }} formatter={(v) => `${v} g`} />
              <ReferenceLine y={n.macros.protein} stroke="var(--color-brand-400)" strokeDasharray="5 5" strokeOpacity={0.6} />
              <RBar isAnimationActive={false} dataKey="protein" stackId="m" fill="var(--color-brand-500)" radius={[0, 0, 0, 0]} />
              <RBar isAnimationActive={false} dataKey="carbs" stackId="m" fill="var(--color-sky-glow)" fillOpacity={0.75} />
              <RBar isAnimationActive={false} dataKey="fat" stackId="m" fill="var(--color-flame-400)" fillOpacity={0.75} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-3 justify-center">
          {[['Protein', 'var(--color-brand-500)'], ['Carbs', 'var(--color-sky-glow)'], ['Fat', 'var(--color-flame-400)']].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5 text-[11.5px] text-dim">
              <span className="size-2.5 rounded-sm" style={{ background: c }} /> {l}
            </span>
          ))}
        </div>
      </Card>

      {/* Weight */}
      <Card className="p-5">
        <SectionTitle icon="scale" action={<Badge tone="neutral">goal {state.profile.targetWeight} kg</Badge>}>
          Bodyweight
        </SectionTitle>
        {weighIns.length >= 2 ? (
          <div className="h-48 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.filter((d) => d.weight)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" axisLine={false} tickLine={false} />
                <YAxis width={42} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-dim)' }} formatter={(v) => [`${v} kg`, 'Weight']} />
                <ReferenceLine y={state.profile.targetWeight} stroke="var(--color-iris-400)" strokeDasharray="5 5" strokeOpacity={0.7} />
                <Line isAnimationActive={false} type="monotone" dataKey="weight" stroke="var(--color-iris-400)" strokeWidth={2.6}
                      dot={{ r: 3.5, fill: 'var(--color-iris-400)', strokeWidth: 0 }} activeDot={{ r: 5.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[13px] text-dim py-8 text-center leading-relaxed">
            Log your weight on at least two days and the trend appears here.<br />
            <span className="text-faint text-[12px]">Weigh yourself at the same time each morning — the number is noisy otherwise.</span>
          </p>
        )}
      </Card>

      {/* Fibre & burn */}
      <Card className="p-5">
        <SectionTitle icon="flame">Fibre and calories burned</SectionTitle>
        <div className="h-44 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="short" axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis width={38} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-dim)' }} />
              <RBar isAnimationActive={false} dataKey="burned" fill="var(--color-flame-500)" radius={[5, 5, 0, 0]} name="Burned (kcal)">
                {series.map((d, i) => <Cell key={i} fill={d.burned ? 'var(--color-flame-500)' : 'var(--border)'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Day log */}
      <Card>
        <div className="px-5 py-3.5 border-b border-hair flex items-center gap-2">
          <Icon name="calendar" className="size-4 text-dim" />
          <span className="text-[14.5px] font-semibold">Day by day</span>
        </div>
        <div className="divide-y divide-[color:var(--border)] max-h-96 overflow-y-auto">
          {[...series].reverse().map((d) => (
            <div key={d.key} className="px-5 py-3 flex items-center gap-3">
              <div className="w-20 shrink-0">
                <div className="text-[12.5px] font-medium">{d.label}</div>
              </div>
              {d.logged ? (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${d.kcal > n.plan.target * 1.1 ? 'from-flame-400 to-rose-500' : 'from-brand-300 to-brand-500'}`}
                        style={{ width: `${Math.min(100, (d.kcal / n.plan.target) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10.5px] text-faint tabular mt-1.5">
                      P {d.protein}g · C {d.carbs}g · F {d.fat}g · fibre {d.fiber}g
                      {d.burned > 0 && ` · burned ${d.burned}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13.5px] font-semibold tabular">{d.kcal}</div>
                    {d.weight && <div className="text-[10px] text-faint tabular">{d.weight} kg</div>}
                  </div>
                </>
              ) : (
                <div className="flex-1 text-[12px] text-faint">Not logged</div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
