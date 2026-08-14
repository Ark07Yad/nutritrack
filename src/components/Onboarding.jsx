import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import {
  ACTIVITY_LEVELS, GOALS, bmi, bmiCategory, goalPlan, macroTargets,
  healthyWeightRange, cmToFeet, feetToCm, estimateBodyFat,
} from '../lib/calc';
import { Button, Card, Field, Icon, Input, NumberInput, Select, Segmented, ThemeToggle } from './ui';

const STEPS = ['You', 'Body', 'Activity', 'Goal', 'Diet', 'Plan'];

export default function Onboarding() {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [p, setP] = useState(state.profile);

  const set = (patch) => setP((prev) => ({ ...prev, ...patch }));

  const plan = useMemo(() => goalPlan(p), [p]);
  const macros = useMemo(() => macroTargets(p, plan.target), [p, plan.target]);
  const bmiValue = bmi(p.weight, p.height);
  const range = healthyWeightRange(p.height);

  const canAdvance = {
    0: true,
    1: p.age > 12 && p.age < 100 && p.height > 100 && p.weight > 25,
    2: !!p.activity,
    3: !!p.goal && (p.goal === 'maintain' || p.goal === 'recomp' || (p.targetWeight > 25 && p.weeks >= 1)),
    4: !!p.dietMode,
    5: true,
  }[step];

  const finish = () => {
    dispatch({ type: 'profile', patch: p });
    dispatch({ type: 'onboarded' });
  };

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-8 sm:py-14">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="size-11 rounded-2xl grid place-items-center metal">
            <Icon name="leaf" className="size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight">NutriTrack</div>
            <div className="text-[12px] text-faint">Calories, macros, micros and training</div>
          </div>
          {/* Setting up in daylight should not mean sitting through a dark
              onboarding — the switch belongs here too, not only after signup. */}
          <ThemeToggle
            compact
            className="ml-auto"
            theme={state.theme}
            onChange={(theme) => dispatch({ type: 'theme', theme })}
          />
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-7">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ background: i <= step ? 'linear-gradient(90deg, var(--color-brand-300), var(--color-brand-500))' : 'var(--border)' }}
              />
              <div className={`text-[10px] mt-1.5 transition-colors ${i === step ? 'text-good font-medium' : 'text-faint'}`}>
                {s}
              </div>
            </div>
          ))}
        </div>

        <Card className="p-6 sm:p-7" glow key={step}>
          <div className="animate-rise">
            {step === 0 && <StepWelcome p={p} set={set} />}
            {step === 1 && <StepBody p={p} set={set} bmiValue={bmiValue} range={range} />}
            {step === 2 && <StepActivity p={p} set={set} />}
            {step === 3 && <StepGoal p={p} set={set} plan={plan} range={range} />}
            {step === 4 && <StepDiet p={p} set={set} />}
            {step === 5 && <StepPlan p={p} plan={plan} macros={macros} bmiValue={bmiValue} />}
          </div>
        </Card>

        <div className="flex items-center justify-between mt-5">
          <Button variant="subtle" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <Icon name="chevL" className="size-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" size="lg" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              Continue <Icon name="chevR" className="size-4" />
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={finish}>
              Start tracking <Icon name="check" className="size-4" />
            </Button>
          )}
        </div>

        <p className="text-[11px] text-faint text-center mt-6 leading-relaxed">
          Everything stays on this device. Nothing is uploaded, and there is no account.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Steps ─────────────────────────────── */

function Head({ title, sub }) {
  return (
    <div className="mb-6">
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      {sub && <p className="text-[13px] text-dim mt-1.5 leading-relaxed">{sub}</p>}
    </div>
  );
}

function StepWelcome({ p, set }) {
  return (
    <>
      <Head
        title="Let's set you up"
        sub="Six quick questions. They give you your maintenance calories, a goal target with a realistic timeline, and daily targets for all 27 vitamins and minerals."
      />
      <Field label="What should I call you?">
        <Input
          autoFocus
          placeholder="Your name"
          value={p.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <div className="mt-6 grid gap-2.5">
        {[
          ['target', 'Maintenance and goal calories', 'Mifflin-St Jeor with guardrails against unsafe deficits'],
          ['plate', 'Every micronutrient tracked', '14 vitamins and 13 minerals, not just the headline macros'],
          ['dumbbell', 'Workouts and calorie burn', 'MET-based, from a library of 42 exercises and 5 plans'],
          ['spark', 'A coach that reads your data', 'Works offline; connect a free model for open conversation'],
        ].map(([icon, title, body]) => (
          <div key={title} className="flex gap-3 items-start p-3 rounded-2xl" style={{ background: 'var(--surface)' }}>
            <div className="size-8 rounded-xl grid place-items-center bg-brand-500/12 text-good shrink-0">
              <Icon name={icon} className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium">{title}</div>
              <div className="text-[12px] text-faint mt-0.5">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StepBody({ p, set, bmiValue, range }) {
  const imperial = p.units === 'imperial';
  const { ft, in: inch } = cmToFeet(p.height);
  const cat = bmiCategory(bmiValue);

  return (
    <>
      <Head title="Your body" sub="These four numbers drive your basal metabolic rate. Be honest — the maths only works if the inputs are real." />

      <div className="flex items-center justify-between mb-5">
        <span className="text-[12px] font-medium text-dim">Units</span>
        <Segmented
          value={p.units}
          onChange={(units) => set({ units })}
          options={[{ value: 'metric', label: 'kg · cm' }, { value: 'imperial', label: 'lb · ft' }]}
        />
      </div>

      <div className="mb-5">
        <span className="block text-[12px] font-medium text-dim mb-2">Sex at birth</span>
        <div className="grid grid-cols-2 gap-2">
          {[['male', 'Male'], ['female', 'Female']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => set({ gender: v })}
              className={`py-3 rounded-2xl text-sm font-medium border transition-all active:scale-[0.98]
                ${p.gender === v
                  ? 'bg-brand-500/14 border-brand-400/40 text-good'
                  : 'surface hover:[background:var(--surface-hover)]'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-faint mt-2">
          Used for the BMR equation and sex-specific nutrient targets — iron differs by more than double.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" suffix="yrs">
          <NumberInput value={p.age} min={13} max={100} fallback={25} onChange={(age) => set({ age })} />
        </Field>
        <Field label={imperial ? 'Weight' : 'Weight'} suffix={imperial ? 'lb' : 'kg'}>
          <NumberInput
            value={imperial ? Math.round(p.weight * 2.20462) : p.weight}
            min={20} max={600} decimals={1} fallback={imperial ? 154 : 70}
            onChange={(v) => set({ weight: imperial ? +(v / 2.20462).toFixed(1) : v })}
          />
        </Field>
      </div>

      <div className="mt-3">
        {imperial ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height" suffix="ft">
              <NumberInput value={ft} min={3} max={8} fallback={5} onChange={(v) => set({ height: feetToCm(v, inch) })} />
            </Field>
            <Field label="&nbsp;" suffix="in">
              <NumberInput value={inch} min={0} max={11} fallback={0} onChange={(v) => set({ height: feetToCm(ft, v) })} />
            </Field>
          </div>
        ) : (
          <Field label="Height" suffix="cm">
            <NumberInput value={p.height} min={100} max={250} fallback={175} onChange={(height) => set({ height })} />
          </Field>
        )}
      </div>

      <Field label="Body fat %" hint="Optional. If you know it, we use the more accurate Katch-McArdle equation instead." className="mt-3" suffix="%">
        <NumberInput
          placeholder={`≈ ${estimateBodyFat(p).toFixed(0)} (estimated)`}
          value={p.bodyFat} allowEmpty min={3} max={70} decimals={1}
          onChange={(bodyFat) => set({ bodyFat })}
        />
      </Field>

      {p.gender === 'female' && (
        <Field label="Life stage" hint="Pregnancy and lactation change folate, iron and iodine targets substantially." className="mt-3">
          <Select value={p.lifeStage} onChange={(e) => set({ lifeStage: e.target.value })}>
            <option value="none">Not pregnant or breastfeeding</option>
            <option value="pregnant">Pregnant</option>
            <option value="lactating">Breastfeeding</option>
          </Select>
        </Field>
      )}

      {bmiValue > 0 && (
        <div className="mt-5 p-3.5 rounded-2xl flex items-center justify-between" style={{ background: 'var(--surface)' }}>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-faint">Your BMI</div>
            <div className="text-xl font-semibold tabular mt-0.5">
              {bmiValue.toFixed(1)}
              <span className={`text-[12px] font-medium ml-2 ${cat.tone === 'good' ? 'text-good' : cat.tone === 'warn' ? 'text-warn' : 'text-bad'}`}>
                {cat.label}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-faint">Healthy range</div>
            <div className="text-sm tabular mt-1">{range.min.toFixed(0)}–{range.max.toFixed(0)} kg</div>
          </div>
        </div>
      )}
    </>
  );
}

function StepActivity({ p, set }) {
  return (
    <>
      <Head title="How active are you?" sub="Count everything outside deliberate exercise too — a job on your feet moves this more than three gym sessions." />
      <div className="grid gap-2">
        {ACTIVITY_LEVELS.map((a) => (
          <button
            key={a.id}
            onClick={() => set({ activity: a.id })}
            className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left border transition-all active:scale-[0.99]
              ${p.activity === a.id
                ? 'bg-brand-500/12 border-brand-400/40'
                : 'surface hover:[background:var(--surface-hover)]'}`}
          >
            <div className={`size-9 rounded-xl grid place-items-center text-[13px] font-semibold tabular shrink-0
              ${p.activity === a.id ? 'bg-brand-500/22 text-good' : '[background:var(--border)] text-dim'}`}>
              ×{a.factor}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">{a.label}</div>
              <div className="text-[12px] text-faint mt-0.5">{a.desc}</div>
            </div>
            {p.activity === a.id && <Icon name="check" className="size-4 text-good ml-auto shrink-0" />}
          </button>
        ))}
      </div>
    </>
  );
}

function StepGoal({ p, set, plan, range }) {
  const needsTarget = p.goal === 'lose' || p.goal === 'gain';
  return (
    <>
      <Head title="What are you here for?" sub="This sets your calorie adjustment and how protein is distributed." />

      <div className="grid grid-cols-2 gap-2 mb-5">
        {GOALS.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              const patch = { goal: g.id };
              if (g.id === 'lose' && p.targetWeight >= p.weight) patch.targetWeight = +(p.weight * 0.9).toFixed(1);
              if (g.id === 'gain' && p.targetWeight <= p.weight) patch.targetWeight = +(p.weight * 1.08).toFixed(1);
              set(patch);
            }}
            className={`p-3.5 rounded-2xl text-left border transition-all active:scale-[0.98]
              ${p.goal === g.id ? 'bg-brand-500/12 border-brand-400/40' : 'surface hover:[background:var(--surface-hover)]'}`}
          >
            <div className="text-xl mb-1.5">{g.icon}</div>
            <div className="text-[13.5px] font-medium">{g.label}</div>
            <div className="text-[11px] text-faint mt-1 leading-snug">{g.desc}</div>
          </button>
        ))}
      </div>

      {needsTarget && (
        <div className="animate-rise">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target weight" suffix="kg" hint={`Healthy range: ${range.min.toFixed(0)}–${range.max.toFixed(0)} kg`}>
              <NumberInput value={p.targetWeight} min={20} max={600} decimals={1} fallback={p.weight} onChange={(targetWeight) => set({ targetWeight })} />
            </Field>
            <Field label="In how many weeks?" suffix="wks" hint={`≈ ${(p.weeks / 4.345).toFixed(1)} months`}>
              <NumberInput value={p.weeks} min={1} max={260} fallback={12} onChange={(weeks) => set({ weeks })} />
            </Field>
          </div>

          <input
            type="range" min="2" max="52" value={p.weeks}
            onChange={(e) => set({ weeks: Number(e.target.value) })}
            className="w-full mt-4"
          />

          <div className="mt-4 p-3.5 rounded-2xl" style={{ background: 'var(--surface)' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-dim">Required daily intake</span>
              <span className="text-lg font-semibold tabular gradient-text">{Math.round(plan.target)} kcal</span>
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-[12px] text-dim">Rate</span>
              <span className="text-[13px] tabular">{Math.abs(plan.weeklyChange).toFixed(2)} kg / week</span>
            </div>
            {plan.warnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-hair flex gap-2.5">
                <Icon name="alert" className="size-4 text-warn shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-dim leading-relaxed">{plan.warnings[0]}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StepDiet({ p, set }) {
  const options = [
    { id: 'vegan', icon: '🌱', label: 'Vegan', desc: 'No animal products at all' },
    { id: 'vegetarian', icon: '🥗', label: 'Vegetarian', desc: 'Plants and dairy' },
    { id: 'nonveg', icon: '🍗', label: 'Non-vegetarian', desc: 'Everything' },
  ];
  return (
    <>
      <Head title="How do you eat?" sub="This filters every meal suggestion, food search result and coaching tip in the app." />
      <div className="grid gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => set({ dietMode: o.id })}
            className={`flex items-center gap-3.5 p-4 rounded-2xl text-left border transition-all active:scale-[0.99]
              ${p.dietMode === o.id ? 'bg-brand-500/12 border-brand-400/40' : 'surface hover:[background:var(--surface-hover)]'}`}
          >
            <span className="text-2xl">{o.icon}</span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-medium">{o.label}</div>
              <div className="text-[12px] text-faint mt-0.5">{o.desc}</div>
            </div>
            {p.dietMode === o.id && <Icon name="check" className="size-4 text-good ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      {p.dietMode === 'vegetarian' && (
        <label className="flex items-center gap-3 mt-4 p-3.5 rounded-2xl cursor-pointer animate-rise" style={{ background: 'var(--surface)' }}>
          <input
            type="checkbox"
            checked={p.eatsEggs}
            onChange={(e) => set({ eatsEggs: e.target.checked })}
            className="size-4 accent-[var(--color-brand-500)]"
          />
          <div>
            <div className="text-[13.5px] font-medium">I eat eggs</div>
            <div className="text-[11.5px] text-faint mt-0.5">Adds eggs to your food list — they are the single best source of choline.</div>
          </div>
        </label>
      )}

      {p.dietMode === 'vegan' && (
        <div className="mt-4 p-3.5 rounded-2xl flex gap-2.5 animate-rise border border-amber-400/25 bg-amber-500/8">
          <Icon name="info" className="size-4 text-warn shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-dim leading-relaxed">
            Worth knowing up front: vitamin B12 does not occur in plant food in a usable form. A supplement is not optional on a vegan diet — the app will keep flagging it, because it should.
          </p>
        </div>
      )}
    </>
  );
}

function StepPlan({ p, plan, macros, bmiValue }) {
  return (
    <>
      <Head
        title={p.name ? `Here's your plan, ${p.name.split(' ')[0]}` : "Here's your plan"}
        sub="You can change any of this later from Settings — the numbers recalculate immediately."
      />

      <div className="rounded-2xl p-5 text-center mb-4"
           style={{ background: 'linear-gradient(140deg, rgb(16 185 129 / 0.14), rgb(56 189 248 / 0.08))', border: '1px solid var(--border)' }}>
        <div className="text-[11px] uppercase tracking-[0.14em] text-dim">Daily target</div>
        <div className="text-[44px] font-semibold tabular leading-none mt-2 gradient-text">{Math.round(plan.target)}</div>
        <div className="text-[12px] text-dim mt-1.5">
          kcal · maintenance is {Math.round(plan.maintenance)}
          {plan.delta !== 0 && (
            <span className={plan.delta < 0 ? ' text-good' : ' text-flame'}>
              {' '}({plan.delta > 0 ? '+' : ''}{Math.round(plan.delta)})
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          ['Protein', macros.protein, 'g', 'text-good'],
          ['Carbs', macros.carbs, 'g', 'text-info'],
          ['Fat', macros.fat, 'g', 'text-warn'],
        ].map(([l, v, u, c]) => (
          <div key={l} className="rounded-2xl p-3 text-center" style={{ background: 'var(--surface)' }}>
            <div className="text-[10.5px] uppercase tracking-wider text-faint">{l}</div>
            <div className={`text-lg font-semibold tabular mt-1 ${c}`}>{v}<span className="text-[11px] text-faint ml-0.5">{u}</span></div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl divide-y divide-[color:var(--border)]" style={{ background: 'var(--surface)' }}>
        {[
          ['Goal', GOALS.find((g) => g.id === p.goal)?.label],
          p.goal === 'lose' || p.goal === 'gain'
            ? ['Timeline', `${plan.weeks} weeks · ${Math.abs(plan.weeklyChange).toFixed(2)} kg/wk`] : null,
          p.goal === 'lose' || p.goal === 'gain'
            ? ['Reaches target', plan.eta?.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })] : null,
          ['BMI', bmiValue.toFixed(1)],
          ['Protein', `${macros.proteinPerKg} g per kg bodyweight`],
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[12.5px] text-dim">{k}</span>
            <span className="text-[13px] font-medium tabular">{v}</span>
          </div>
        ))}
      </div>

      {plan.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {plan.warnings.map((w, i) => (
            <div key={i} className="p-3 rounded-2xl flex gap-2.5 border border-amber-400/25 bg-amber-500/8">
              <Icon name="alert" className="size-4 text-warn shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-dim leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}
      {plan.note && (
        <div className="mt-3 p-3 rounded-2xl flex gap-2.5 border border-sky-400/25 bg-sky-500/8">
          <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-dim leading-relaxed">{plan.note}</p>
        </div>
      )}
    </>
  );
}
