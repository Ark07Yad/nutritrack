import { useMemo, useState } from 'react';
import { useStore, uid } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import { EXERCISES, EXERCISE_TYPES, WORKOUT_PLANS, burnFor } from '../data/exercises';
import { prettyDate, shortDay, isToday, shiftKey, todayKey } from '../lib/calc';
import {
  Badge, Button, Card, Chip, Empty, Field, Icon, IconButton, Input, NumberInput,
  SectionTitle, Sheet, Stat,
} from './ui';
import { BarChart, Bar as RBar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function Workouts({ date, setDate, toast }) {
  const { state, dispatch } = useStore();
  const n = useNutrition(date);
  const [adding, setAdding] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);

  const workouts = n.day.workouts;
  const totalBurn = n.burned;
  const totalMin = workouts.reduce((s, w) => s + (w.minutes || 0), 0);

  const weekly = useMemo(() => {
    return n.history.slice(-7).map(({ key, day }) => ({
      day: shortDay(key),
      kcal: Math.round(day.workouts.reduce((s, w) => s + (w.kcal || 0), 0)),
      minutes: day.workouts.reduce((s, w) => s + (w.minutes || 0), 0),
    }));
  }, [n.history]);

  const weekTotal = weekly.reduce((s, d) => s + d.kcal, 0);
  const activeDays = weekly.filter((d) => d.kcal > 0).length;

  const muscleLoad = useMemo(() => {
    const counts = {};
    for (const { day } of n.history.slice(-7)) {
      for (const w of day.workouts) {
        for (const m of w.muscles || []) counts[m] = (counts[m] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [n.history]);

  return (
    <div className="space-y-5 pb-4">
      <Card className="p-3 flex items-center justify-between">
        <IconButton name="chevL" label="Previous day" onClick={() => setDate(shiftKey(date, -1))} />
        <div className="text-center">
          <div className="text-[15px] font-semibold">{isToday(date) ? 'Today' : prettyDate(date)}</div>
          <div className="text-[11px] text-faint tabular">
            {workouts.length} session{workouts.length === 1 ? '' : 's'} · {Math.round(totalBurn)} kcal · {totalMin} min
          </div>
        </div>
        <div className="flex">
          {!isToday(date) && <IconButton name="calendar" label="Jump to today" onClick={() => setDate(todayKey())} />}
          <IconButton
            name="chevR" label="Next day" onClick={() => setDate(shiftKey(date, 1))}
            className={date >= todayKey() ? 'opacity-30 pointer-events-none' : ''}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Burned today" value={Math.round(totalBurn)} unit="kcal" icon="flame" tone="warn" />
        <Stat label="Active minutes" value={totalMin} unit="min" icon="clock" />
        <Stat label="This week" value={weekTotal} unit="kcal" icon="chart" tone="brand" sub={`${activeDays} of 7 days active`} />
        <Stat label="Net calories" value={Math.round(n.totals.kcal - totalBurn)} unit="kcal" icon="target"
              sub={`Target ${Math.round(n.plan.target)}`} />
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="lg" className="flex-1" onClick={() => setAdding(true)}>
          <Icon name="plus" className="size-4" /> Log a workout
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setPlanSheet(true)}>
          <Icon name="book" className="size-4" /> Plans
        </Button>
      </div>

      <Card>
        <div className="px-4 py-3.5 border-b border-hair flex items-center gap-2">
          <Icon name="dumbbell" className="size-4 text-dim" />
          <span className="text-[14.5px] font-semibold">Today's sessions</span>
        </div>
        {workouts.length === 0 ? (
          <Empty
            icon="dumbbell"
            title="Nothing logged today"
            body="Rest days are part of the plan — but if you trained, log it so the calorie maths and the coach both know."
            action={<Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" className="size-4" /> Log a workout</Button>}
          />
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {workouts.map((w) => (
              <div key={w.id} className="px-4 py-3 flex items-center gap-3 group">
                <div className={`size-9 rounded-xl grid place-items-center shrink-0 ${
                  w.type === 'strength' ? 'bg-indigo-500/14 text-iris'
                  : w.type === 'cardio' ? 'bg-rose-500/14 text-bad'
                  : w.type === 'sport' ? 'bg-amber-500/14 text-warn'
                  : 'bg-brand-500/14 text-good'}`}>
                  <Icon name={w.type === 'strength' ? 'dumbbell' : w.type === 'mobility' ? 'leaf' : 'bolt'} className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate">{w.name}</div>
                  <div className="text-[11.5px] text-faint tabular mt-0.5">
                    {w.minutes} min
                    {w.sets ? ` · ${w.sets}×${w.reps}${w.weight ? ` @ ${w.weight} kg` : ''}` : ''}
                    {w.muscles?.length ? ` · ${w.muscles.join(', ')}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-semibold tabular text-flame">{Math.round(w.kcal)}</div>
                  <div className="text-[9.5px] text-faint">kcal</div>
                </div>
                <IconButton
                  name="trash" label="Remove"
                  onClick={() => { dispatch({ type: 'removeWorkout', date, id: w.id }); toast('Workout removed'); }}
                  className="size-8 opacity-60 group-hover:opacity-100 hover:text-bad"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle icon="chart">Last 7 days</SectionTitle>
        {weekTotal > 0 ? (
          <div className="h-36 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis width={36} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface)' }}
                  contentStyle={{
                    background: 'var(--bg-elev)', border: '1px solid var(--border)',
                    borderRadius: 14, fontSize: 12, color: 'var(--text)',
                  }}
                  formatter={(v, k, p) => [`${v} kcal · ${p.payload.minutes} min`, 'Burned']}
                />
                <RBar isAnimationActive={false} dataKey="kcal" radius={[6, 6, 0, 0]}>
                  {weekly.map((d, i) => (
                    <Cell key={i} fill={d.kcal > 0 ? 'var(--color-flame-500)' : 'var(--border)'} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[13px] text-dim py-6 text-center">Log a session and your weekly burn appears here.</p>
        )}

        {muscleLoad.length > 0 && (
          <div className="mt-4 pt-4 border-t border-hair">
            <div className="text-[11px] uppercase tracking-wider text-faint mb-2.5">Muscle groups hit this week</div>
            <div className="flex flex-wrap gap-1.5">
              {muscleLoad.map(([m, c]) => (
                <Badge key={m} tone={c >= 2 ? 'good' : 'neutral'}>{m} ×{c}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {adding && <ExercisePicker date={date} onClose={() => setAdding(false)} toast={toast} weight={state.profile.weight} />}
      {planSheet && <PlanSheet onClose={() => setPlanSheet(false)} date={date} toast={toast} weight={state.profile.weight} goal={state.profile.goal} />}
    </div>
  );
}

/* ─────────────────────────── Exercise picker ─────────────────────────── */

function ExercisePicker({ date, onClose, toast, weight }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [sel, setSel] = useState(null);
  const [minutes, setMinutes] = useState(45);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    return EXERCISES.filter(
      (e) => (type === 'all' || e.type === type) &&
             (!query || e.name.toLowerCase().includes(query) || e.muscles.join(' ').toLowerCase().includes(query))
    );
  }, [q, type]);

  const pick = (e) => {
    setSel(e);
    setMinutes(e.type === 'strength' ? 30 : 45);
    setSets(e.sets ? String(e.sets) : '');
    setReps(e.reps || '');
  };

  const commit = () => {
    dispatch({
      type: 'addWorkout',
      date,
      workout: {
        id: uid(),
        exerciseId: sel.id,
        name: sel.name,
        type: sel.type,
        muscles: sel.muscles,
        minutes,
        sets: sets ? Number(sets) : null,
        reps: reps || null,
        weight: load ? Number(load) : null,
        kcal: burnFor(sel, minutes, weight),
      },
    });
    toast(`${sel.name} logged`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Log a workout" subtitle="Calories burned are estimated from MET values and your bodyweight">
      {sel ? (
        <div className="animate-rise">
          <button onClick={() => setSel(null)} className="flex items-center gap-1.5 text-[12.5px] text-dim hover:text-[color:var(--text)] mb-4">
            <Icon name="chevL" className="size-3.5" /> Back
          </button>

          <h3 className="text-lg font-semibold">{sel.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-5">
            <Badge tone="info">{sel.type}</Badge>
            <Badge tone="neutral">MET {sel.met}</Badge>
            {sel.muscles.map((m) => <Badge key={m} tone="neutral">{m}</Badge>)}
          </div>

          <Field label="Duration" suffix="min">
            <NumberInput value={minutes} min={1} max={600} fallback={45} onChange={setMinutes} />
          </Field>
          <input type="range" min="5" max="180" step="5" value={Math.min(180, minutes)}
                 onChange={(e) => setMinutes(Number(e.target.value))} className="w-full mt-3 mb-2" />
          <div className="flex gap-1.5 flex-wrap mb-5">
            {[15, 30, 45, 60, 90].map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>
            ))}
          </div>

          {sel.type === 'strength' && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Field label="Sets"><NumberInput placeholder="3" value={sets} allowEmpty min={1} max={50} onChange={setSets} /></Field>
              <Field label="Reps"><Input placeholder={sel.reps || '10'} value={reps} onChange={(e) => setReps(e.target.value)} /></Field>
              <Field label="Load" suffix="kg"><NumberInput placeholder="—" value={load} allowEmpty min={0} max={1000} decimals={1} onChange={setLoad} /></Field>
            </div>
          )}

          <div className="rounded-2xl p-4 text-center mb-4"
               style={{ background: 'linear-gradient(140deg, rgb(249 115 22 / 0.14), rgb(244 63 94 / 0.07))', border: '1px solid var(--border)' }}>
            <div className="text-[11px] uppercase tracking-wider text-faint">Estimated burn</div>
            <div className="text-[34px] font-semibold tabular leading-none mt-1.5 text-flame">
              {Math.round(burnFor(sel, minutes, weight))}
            </div>
            <div className="text-[11.5px] text-faint mt-1.5">kcal at {weight} kg bodyweight</div>
          </div>

          <Button variant="primary" size="lg" className="w-full" onClick={commit}>
            <Icon name="check" className="size-4" /> Log this session
          </Button>
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <Icon name="search" className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <Input autoFocus placeholder="Search exercises or muscle groups…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
            <Chip active={type === 'all'} onClick={() => setType('all')}>All</Chip>
            {EXERCISE_TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)} className="capitalize">{t}</Chip>
            ))}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {results.map((e) => (
              <button
                key={e.id}
                onClick={() => pick(e)}
                className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all hover:[background:var(--surface-hover)] active:scale-[0.99]"
                style={{ background: 'var(--surface)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{e.name}</div>
                  <div className="text-[11px] text-faint truncate mt-0.5">{e.muscles.join(' · ')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-semibold tabular text-flame">
                    {Math.round(burnFor(e, 30, weight))}
                  </div>
                  <div className="text-[9.5px] text-faint">kcal/30min</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ────────────────────────────── Plan sheet ────────────────────────────── */

function PlanSheet({ onClose, date, toast, weight, goal }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(null);

  const loadDay = (dayBlock) => {
    for (const id of dayBlock.items) {
      const ex = EXERCISES.find((e) => e.id === id);
      if (!ex) continue;
      const minutes = ex.type === 'strength' ? 12 : 30;
      dispatch({
        type: 'addWorkout',
        date,
        workout: {
          id: uid(), exerciseId: ex.id, name: ex.name, type: ex.type, muscles: ex.muscles,
          minutes, sets: ex.sets || null, reps: ex.reps || null, weight: null,
          kcal: burnFor(ex, minutes, weight),
        },
      });
    }
    toast(`${dayBlock.day} loaded into today's log`);
    onClose();
  };

  const sorted = [...WORKOUT_PLANS].sort((a, b) =>
    Number(b.goalFit.includes(goal)) - Number(a.goalFit.includes(goal))
  );

  return (
    <Sheet open onClose={onClose} size="lg" title="Training plans" subtitle="Pick a split, then load any day straight into your log">
      <div className="grid gap-2.5">
        {sorted.map((p) => {
          const isOpen = open === p.id;
          const fits = p.goalFit.includes(goal);
          return (
            <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)' }}>
              <button onClick={() => setOpen(isOpen ? null : p.id)} className="w-full p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14.5px] font-medium">{p.name}</span>
                      {fits && <Badge tone="good">Suits your goal</Badge>}
                    </div>
                    <div className="text-[11.5px] text-faint mt-1.5 leading-relaxed">{p.blurb}</div>
                    <div className="flex gap-1.5 mt-2.5">
                      <Badge tone="neutral">{p.days} days / week</Badge>
                      <Badge tone="neutral">{p.level}</Badge>
                    </div>
                  </div>
                  <Icon name="chevD" className={`size-4 text-faint shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 animate-rise">
                  {p.schedule.map((d, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg-elev)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12.5px] font-semibold">{d.day}</span>
                        <Button size="sm" variant="ghost" onClick={() => loadDay(d)}>
                          <Icon name="plus" className="size-3.5" /> Load
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {d.items.map((id) => {
                          const ex = EXERCISES.find((e) => e.id === id);
                          if (!ex) return null;
                          return (
                            <div key={id} className="flex items-center justify-between text-[12px]">
                              <span className="text-dim">{ex.name}</span>
                              <span className="text-faint tabular shrink-0 ml-3">
                                {ex.sets ? `${ex.sets} × ${ex.reps}` : '30 min'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
