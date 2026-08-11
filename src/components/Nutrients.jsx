import { useMemo, useState } from 'react';
import { useNutrition } from '../lib/useNutrition';
import { useStore } from '../lib/store';
import { NUTRIENT_INFO, VITAMINS, MINERALS } from '../data/rdi';
import { FOODS, allowedDiets } from '../data/foods';
import { prettyDate, isToday } from '../lib/calc';
import { Bar, Card, Icon, SectionTitle, Segmented, Sheet, Stat, fmt } from './ui';

export default function Nutrients({ date }) {
  const { state } = useStore();
  const n = useNutrition(date);
  const [view, setView] = useState('all');
  const [detail, setDetail] = useState(null);

  const { totals, targets, limits, macros, plan } = n;

  const rows = useMemo(() => {
    const build = (keys) =>
      keys.map((key) => {
        const t = targets[key];
        const value = totals[key] || 0;
        const p = t.target > 0 ? (value / t.target) * 100 : 0;
        return { key, info: NUTRIENT_INFO[key], value, target: t.target, ul: t.ul, limit: t.limit, p };
      });
    return { vitamins: build(VITAMINS), minerals: build(MINERALS) };
  }, [totals, targets]);

  const all = [...rows.vitamins, ...rows.minerals];
  const met = all.filter((r) => !r.limit && r.p >= 90).length;
  const low = all.filter((r) => !r.limit && r.p < 50);
  const overLimit = all.filter((r) => r.limit && r.p > 100);
  const nonLimit = all.filter((r) => !r.limit).length;

  const visible = view === 'gaps' ? all.filter((r) => (!r.limit && r.p < 90) || (r.limit && r.p > 90)) : null;

  return (
    <div className="space-y-5 pb-4">
      <Card className="p-5 sm:p-6" glow>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Micronutrients</h1>
            <p className="text-[12.5px] text-dim mt-1">
              All 14 vitamins and 13 minerals · {isToday(date) ? 'today' : prettyDate(date)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[30px] font-semibold tabular leading-none gradient-text">{met}<span className="text-[15px] text-faint">/{nonLimit}</span></div>
            <div className="text-[10.5px] uppercase tracking-wider text-faint mt-1.5">targets met</div>
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full bg-gradient-to-r from-brand-300 via-brand-400 to-sky-400"
               style={{ width: `${(met / nonLimit) * 100}%`, transition: 'width 800ms cubic-bezier(0.22,1,0.36,1)' }} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="At target" value={met} tone="brand" />
          <Stat label="Below half" value={low.length} tone={low.length ? 'warn' : 'default'} />
          <Stat label="Over ceiling" value={overLimit.length} tone={overLimit.length ? 'bad' : 'default'} />
        </div>

        {n.entryCount === 0 && (
          <div className="mt-4 p-3.5 rounded-2xl flex gap-2.5" style={{ background: 'var(--surface)' }}>
            <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
            <p className="text-[12px] text-dim leading-relaxed">
              Nothing logged for this day yet, so every value below reads zero. Log a meal and this fills in.
            </p>
          </div>
        )}
      </Card>

      {/* Macro-level limits, which behave differently from vitamins */}
      <Card className="p-5">
        <SectionTitle icon="target">Energy and macro targets</SectionTitle>
        <Bar label="Calories" value={totals.kcal} target={plan.target} unit=" kcal" />
        <Bar label="Protein" value={totals.protein} target={macros.protein} unit="g" />
        <Bar label="Carbohydrate" value={totals.carbs} target={macros.carbs} unit="g" />
        <Bar label="Fat" value={totals.fat} target={macros.fat} unit="g" />
        <div className="h-px my-3" style={{ background: 'var(--border)' }} />
        <Bar label="Fibre" value={totals.fiber} target={limits.fiber.target} unit="g"
             sub="14 g per 1000 kcal. Almost nobody hits this without deliberately trying." />
        <Bar label="Saturated fat" value={totals.satFat} target={limits.satFat.target} unit="g" limit
             sub="Ceiling, not a target — under 10% of calories." />
        <Bar label="Added sugars" value={totals.sugar} target={limits.sugar.target} unit="g" limit
             sub="Includes naturally occurring sugars in this database, so fruit inflates it." />
        <Bar label="Cholesterol" value={totals.chol} target={300} unit="mg" limit />
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: 'all', label: 'Everything' }, { value: 'gaps', label: `Gaps${low.length + overLimit.length ? ` (${all.filter((r) => (!r.limit && r.p < 90) || (r.limit && r.p > 90)).length})` : ''}` }]}
        />
        <span className="text-[11px] text-faint">Tap any nutrient for detail</span>
      </div>

      {view === 'gaps' ? (
        <Card className="p-5">
          <SectionTitle icon="alert">Needs attention</SectionTitle>
          {visible.length === 0 ? (
            <p className="text-[13px] text-dim py-6 text-center">
              Nothing is short and nothing is over its ceiling. Genuinely well done — this is hard to achieve.
            </p>
          ) : (
            visible
              .sort((a, b) => a.p - b.p)
              .map((r) => <NutrientRow key={r.key} row={r} onOpen={() => setDetail(r)} />)
          )}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <SectionTitle icon="spark">Vitamins</SectionTitle>
            {rows.vitamins.map((r) => <NutrientRow key={r.key} row={r} onOpen={() => setDetail(r)} />)}
          </Card>
          <Card className="p-5">
            <SectionTitle icon="bolt">Minerals</SectionTitle>
            {rows.minerals.map((r) => <NutrientRow key={r.key} row={r} onOpen={() => setDetail(r)} />)}
          </Card>
        </>
      )}

      <p className="text-[11px] text-faint leading-relaxed px-1">
        Targets are RDA or AI values from the Institute of Medicine, adjusted for your sex, age and life stage.
        Food values come from USDA FoodData Central and Indian Food Composition Tables; trace minerals such as
        biotin, iodine, chromium and molybdenum are sparsely reported in public databases, so treat those four as
        indicative rather than precise.
      </p>

      {detail && <NutrientDetail row={detail} profile={state.profile} onClose={() => setDetail(null)} />}
    </div>
  );
}

function NutrientRow({ row, onOpen }) {
  const { info, value, target, limit } = row;
  return (
    <button onClick={onOpen} className="w-full text-left group">
      <Bar
        label={
          <span className="group-hover:text-good transition-colors">{info.label}</span>
        }
        value={value}
        target={target}
        unit={info.unit}
        limit={limit}
        compact
      />
    </button>
  );
}

function NutrientDetail({ row, profile, onClose }) {
  const { info, value, target, ul, p, limit, key } = row;
  const allowed = allowedDiets(profile.dietMode, profile.eatsEggs);

  const topSources = FOODS
    .filter((f) => allowed.includes(f.diet) && f.per100[key] > 0)
    .sort((a, b) => b.per100[key] - a.per100[key])
    .slice(0, 8);

  const gap = target - value;

  return (
    <Sheet open onClose={onClose} title={info.label} subtitle={limit ? 'Upper limit — lower is better' : 'Daily target'}>
      <div className="rounded-2xl p-5 text-center mb-4"
           style={{ background: 'var(--surface)' }}>
        <div className="text-[34px] font-semibold tabular leading-none">
          {fmt(value)}<span className="text-[14px] text-faint ml-1">{info.unit}</span>
        </div>
        <div className="text-[12.5px] text-dim mt-2">
          of {fmt(target)} {info.unit} — <span className={p >= 90 ? 'text-good' : p >= 50 ? 'text-warn' : 'text-bad'}>{Math.round(p)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden mt-4" style={{ background: 'var(--border)' }}>
          <div className={`h-full rounded-full bg-gradient-to-r ${
            limit ? (p > 110 ? 'from-rose-400 to-rose-600' : 'from-brand-300 to-brand-500')
            : p >= 90 ? 'from-brand-300 to-brand-500' : p >= 50 ? 'from-amber-300 to-amber-500' : 'from-slate-400 to-slate-500'}`}
            style={{ width: `${Math.min(100, p)}%` }} />
        </div>
        {ul && (
          <div className="text-[11px] text-faint mt-3">
            Tolerable upper limit: {fmt(ul)} {info.unit} per day
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--surface)' }}>
        <div className="text-[11px] uppercase tracking-wider text-faint mb-2">Why it matters</div>
        <p className="text-[13px] text-dim leading-relaxed">{info.why}</p>
      </div>

      {!limit && gap > 0 && (
        <div className="p-4 rounded-2xl mb-4 border border-amber-400/25 bg-amber-500/8">
          <div className="text-[12.5px] text-dim leading-relaxed">
            You need <strong className="text-[color:var(--text)]">{fmt(gap)} {info.unit}</strong> more today.
            {topSources[0] && (
              <> That is about <strong className="text-[color:var(--text)]">
                {Math.round((gap / topSources[0].per100[key]) * 100)} g
              </strong> of {topSources[0].name.replace(/\s*\([^)]*\)/g, '').toLowerCase()}.</>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-wider text-faint mb-2.5">
          Richest sources on your {profile.dietMode === 'nonveg' ? 'diet' : `${profile.dietMode} diet`}
        </div>
        {topSources.length === 0 ? (
          <p className="text-[12.5px] text-dim">
            No food in the database supplies this on your current diet — this is one to get from a supplement.
          </p>
        ) : (
          <div className="grid gap-1.5">
            {topSources.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--surface)' }}>
                <span className="text-[12.5px] truncate">{f.name}</span>
                <span className="text-[12px] tabular shrink-0 ml-3">
                  <span className="font-semibold">{fmt(f.per100[key])}</span>
                  <span className="text-faint"> {info.unit}/100g</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {key === 'b12' && profile.dietMode === 'vegan' && (
        <div className="mt-4 p-4 rounded-2xl border border-rose-400/25 bg-rose-500/8">
          <p className="text-[12.5px] text-dim leading-relaxed">
            <strong className="text-[color:var(--text)]">This one needs a supplement.</strong> B12 is produced by bacteria,
            not plants. Nothing on a vegan diet supplies it reliably — not spirulina, not fermented food, not nutritional
            yeast unless it is explicitly fortified. Deficiency takes years to appear and causes irreversible nerve damage,
            so this is the single most important thing to get right.
          </p>
        </div>
      )}
    </Sheet>
  );
}
