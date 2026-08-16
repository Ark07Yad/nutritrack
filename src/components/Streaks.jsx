import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import {
  allStreaks, recentPattern, hasEntries, calorieDayOk, stepDayOk,
  milestoneBlurb, MILESTONES,
} from '../lib/streaks';
import { todayKey, prettyDate } from '../lib/calc';
import { AnimatedNumber, Badge, Card, Icon, NumberInput, SectionTitle, stagger } from './ui';

const KINDS = {
  logging:  { label: 'Logging',  icon: 'book',  tone: 'iris',  desc: 'Days you recorded something' },
  calories: { label: 'On target', icon: 'target', tone: 'brand', desc: 'Days you finished inside your calorie band' },
  steps:    { label: 'Steps',    icon: 'bolt',  tone: 'warn',  desc: 'Days you hit your step goal' },
};

export default function Streaks({ date = todayKey() }) {
  const { state, dispatch } = useStore();
  const n = useNutrition(date);
  const p = state.profile;
  const stepGoal = p.stepGoal || 8000;
  const tolerance = p.calorieTolerance ?? 0.1;

  const streaks = useMemo(
    () => allStreaks({ days: state.days, calorieTarget: n.plan.target, stepGoal, tolerance }),
    [state.days, n.plan.target, stepGoal, tolerance]
  );

  const predicates = {
    logging: (d) => hasEntries(d),
    calories: (d) => calorieDayOk(d, n.plan.target, tolerance),
    steps: (d) => stepDayOk(d, stepGoal),
  };

  const todaySteps = n.day.steps || 0;

  return (
    <div className="space-y-5">
      {/* Steps — the only one that needs an input, so it leads. */}
      <Card className="p-5">
        <SectionTitle
          icon="bolt"
          action={<Badge tone={todaySteps >= stepGoal ? 'good' : 'neutral'}>goal {stepGoal.toLocaleString()}</Badge>}
        >
          Steps today
        </SectionTitle>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <NumberInput
              value={todaySteps}
              min={0}
              max={100000}
              fallback={0}
              onChange={(steps) => dispatch({ type: 'setDayField', date, field: 'steps', value: steps ?? 0 })}
              className="text-[22px] font-semibold"
            />
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-faint">of goal</div>
            <div className="text-[19px] font-semibold tabular text-good">
              <AnimatedNumber value={stepGoal > 0 ? Math.min(999, (todaySteps / stepGoal) * 100) : 0} />%
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full metal"
            style={{
              width: `${Math.min(100, stepGoal > 0 ? (todaySteps / stepGoal) * 100 : 0)}%`,
              transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>

        <div className="mt-3 flex gap-1.5 flex-wrap">
          {[2000, 5000, 8000, 10000].map((v) => (
            <button
              key={v}
              onClick={() => dispatch({ type: 'setDayField', date, field: 'steps', value: v })}
              className="px-2.5 py-1 rounded-full text-[11.5px] surface text-dim hover:text-[color:var(--text)] transition-colors"
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-faint mt-3 leading-relaxed">
          Typed in by hand, because browsers have no pedometer API — a web app cannot read the step count your
          phone is already keeping. Copy it across from your phone&apos;s health app, or set your goal low enough
          that the habit is what you are tracking.
        </p>
      </Card>

      {/* The three streaks */}
      <div className="grid gap-3 lg:grid-cols-3">
        {Object.entries(KINDS).map(([kind, meta], i) => (
          <StreakCard
            key={kind}
            meta={meta}
            streak={streaks[kind]}
            pattern={recentPattern(state.days, predicates[kind], 14)}
            index={i}
          />
        ))}
      </div>

      <MilestoneLadder streaks={streaks} />
    </div>
  );
}

function StreakCard({ meta, streak, pattern, index }) {
  const { current, best, next, toGo, fraction, todayOk } = streak;
  const tones = { brand: 'text-good', iris: 'text-iris', warn: 'text-warn' };

  return (
    <Card className="p-4 animate-rise" style={stagger(index)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint">
            <Icon name={meta.icon} className="size-3.5" /> {meta.label}
          </div>
          <div className={`text-[30px] font-semibold tabular leading-none mt-1.5 ${tones[meta.tone]}`}>
            <AnimatedNumber value={current} />
            <span className="text-[12px] font-normal text-faint ml-1.5">
              day{current === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        {current > 0 && <span className="text-xl" aria-hidden="true">🔥</span>}
      </div>

      {/* Last fortnight, as dots. Reading a pattern beats reading a number. */}
      <div className="flex gap-[3px] mb-3" role="img" aria-label={`Last 14 days of ${meta.label}`}>
        {pattern.map((d) => (
          <div
            key={d.key}
            title={`${prettyDate(d.key)}${d.ok ? ' — done' : ''}`}
            className="h-5 flex-1 rounded-[3px] transition-colors"
            style={{
              background: d.ok ? 'var(--tone-good)' : 'var(--border)',
              opacity: d.ok ? (d.isToday ? 1 : 0.75) : d.isToday ? 0.5 : 1,
              outline: d.isToday ? '1px solid var(--border-strong)' : 'none',
            }}
          />
        ))}
      </div>

      {next ? (
        <>
          <div className="flex items-baseline justify-between text-[11.5px] mb-1.5">
            <span className="text-dim">Next milestone</span>
            <span className="tabular text-faint">{toGo} to go → {next}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full metal"
              style={{ width: `${fraction * 100}%`, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }}
            />
          </div>
        </>
      ) : (
        <div className="text-[11.5px] text-good">Every milestone reached. Genuinely remarkable.</div>
      )}

      <div className="flex items-center justify-between mt-3 text-[11px] text-faint">
        <span>Best {best} day{best === 1 ? '' : 's'}</span>
        <span>{todayOk ? 'Today counted' : 'Today still open'}</span>
      </div>
    </Card>
  );
}

/**
 * The full ladder, so a streak has visible distance in front of it as well as
 * behind. Showing every rung at once is the point — it is what makes day 8 feel
 * like part of a route to 100 rather than an isolated number.
 */
function MilestoneLadder({ streaks }) {
  const best = Math.max(streaks.logging.current, streaks.calories.current, streaks.steps.current);

  return (
    <Card className="p-5">
      <SectionTitle icon="flame" action={<Badge tone="neutral">longest current run: {best}</Badge>}>
        Milestones
      </SectionTitle>

      <div className="flex flex-wrap gap-1.5">
        {MILESTONES.map((m, i) => {
          const reached = best >= m;
          const isNext = !reached && MILESTONES.filter((x) => x > best)[0] === m;
          return (
            <div
              key={m}
              style={stagger(i, { step: 20, max: 240 })}
              className={`px-2.5 py-1.5 rounded-xl text-[12px] font-medium tabular animate-rise border transition-colors
                ${reached
                  ? 'metal border-transparent'
                  : isNext
                    ? 'border-brand-400/40 text-good bg-brand-500/8'
                    : 'surface text-faint'}`}
            >
              {m}
            </div>
          );
        })}
      </div>

      {best > 0 && (
        <p className="text-[12px] text-dim mt-4 leading-relaxed">
          {milestoneBlurb(
            streaks.calories.current === best ? 'calories' : streaks.steps.current === best ? 'steps' : 'logging',
            best
          )}
        </p>
      )}
    </Card>
  );
}
