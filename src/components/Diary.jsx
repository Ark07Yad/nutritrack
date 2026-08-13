import { useMemo, useState } from 'react';
import { useStore, uid, useAllFoods, useAllowedDiets, sumEntries } from '../lib/store';
import { useNutrition } from '../lib/useNutrition';
import { nutrientsFor, FOOD_CATEGORIES, NUTRIENT_KEYS } from '../data/foods';
import { RECIPES, MEAL_SLOTS } from '../data/recipes';
import { prettyDate, isToday, shiftKey, todayKey } from '../lib/calc';
import {
  Badge, Bar, Button, Card, Chip, Empty, Field, Icon, IconButton, Input, NumberInput,
  SectionTitle, Segmented, Sheet, Stepper, fmt,
} from './ui';

export default function Diary({ date, setDate, focusSlot, clearFocus, toast }) {
  const { dispatch } = useStore();
  const n = useNutrition(date);
  const [picker, setPicker] = useState(focusSlot ? { slot: focusSlot } : null);

  const open = (slot) => setPicker({ slot });
  const close = () => { setPicker(null); clearFocus?.(); };

  return (
    <div className="space-y-5 pb-4">
      {/* Date bar */}
      <Card className="p-3 flex items-center justify-between">
        <IconButton name="chevL" label="Previous day" onClick={() => setDate(shiftKey(date, -1))} />
        <div className="text-center">
          <div className="text-[15px] font-semibold">{isToday(date) ? 'Today' : prettyDate(date)}</div>
          <div className="text-[11px] text-faint tabular">
            {Math.round(n.totals.kcal)} of {Math.round(n.plan.target)} kcal · {Math.round(n.totals.protein)} g protein
          </div>
        </div>
        <div className="flex">
          {!isToday(date) && <IconButton name="calendar" label="Jump to today" onClick={() => setDate(todayKey())} />}
          <IconButton
            name="chevR" label="Next day"
            onClick={() => setDate(shiftKey(date, 1))}
            className={date >= todayKey() ? 'opacity-30 pointer-events-none' : ''}
          />
        </div>
      </Card>

      {MEAL_SLOTS.map((slot) => (
        <SlotSection
          key={slot.id}
          slot={slot}
          date={date}
          entries={n.day.meals[slot.id]}
          budget={n.plan.target * slot.share}
          onAdd={() => open(slot.id)}
          dispatch={dispatch}
          toast={toast}
        />
      ))}

      {/* Day summary */}
      <Card className="p-5">
        <SectionTitle icon="chart">Day totals</SectionTitle>
        <Bar label="Calories" value={n.totals.kcal} target={n.plan.target} unit=" kcal" />
        <Bar label="Protein" value={n.totals.protein} target={n.macros.protein} unit="g" />
        <Bar label="Carbs" value={n.totals.carbs} target={n.macros.carbs} unit="g" />
        <Bar label="Fat" value={n.totals.fat} target={n.macros.fat} unit="g" />
        <Bar label="Fibre" value={n.totals.fiber} target={n.limits.fiber.target} unit="g" />
        <Bar label="Saturated fat" value={n.totals.satFat} target={n.limits.satFat.target} unit="g" limit />
        <Bar label="Sodium" value={n.totals.sodium} target={2300} unit="mg" limit />
      </Card>

      {picker && (
        <FoodPicker
          slot={picker.slot}
          date={date}
          onClose={close}
          toast={toast}
        />
      )}
    </div>
  );
}

/* ────────────────────────────── Slot section ────────────────────────────── */

function SlotSection({ slot, date, entries, budget, onAdd, dispatch, toast }) {
  const totals = sumEntries(entries);

  return (
    <Card className="overflow-visible">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-hair">
        <span className="text-xl">{slot.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold">{slot.label}</div>
          <div className="text-[11.5px] text-faint tabular">
            {Math.round(totals.kcal)} kcal
            <span className="mx-1.5">·</span>
            budget {Math.round(budget)}
            {totals.protein > 0 && <><span className="mx-1.5">·</span>{Math.round(totals.protein)} g protein</>}
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={onAdd}>
          <Icon name="plus" className="size-3.5" /> Add
        </Button>
      </div>

      {entries.length === 0 ? (
        <button onClick={onAdd} className="w-full py-6 text-[12.5px] text-faint hover:text-dim transition-colors">
          Nothing logged — tap to add food
        </button>
      ) : (
        <div className="divide-y divide-[color:var(--border)]">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} slot={slot.id} date={date} dispatch={dispatch} toast={toast} />
          ))}
        </div>
      )}
    </Card>
  );
}

function EntryRow({ entry, slot, date, dispatch, toast }) {
  const [editing, setEditing] = useState(false);

  const setGrams = (grams) => {
    const base = entry.per100;
    const n = {};
    for (const k of NUTRIENT_KEYS) n[k] = (base?.[k] || 0) * (grams / 100);
    dispatch({ type: 'updateEntry', date, slot, id: entry.id, patch: { grams, n } });
  };

  return (
    <div className="px-4 py-3 group">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium truncate">{entry.name}</div>
          <div className="text-[11.5px] text-faint tabular mt-0.5">
            {Math.round(entry.grams)} {entry.unit || 'g'}
            <span className="mx-1.5">·</span>
            P {fmt(entry.n.protein)} · C {fmt(entry.n.carbs)} · F {fmt(entry.n.fat)}
          </div>
        </div>
        <div className="text-[14px] font-semibold tabular shrink-0">{Math.round(entry.n.kcal)}</div>
        <div className="flex opacity-60 group-hover:opacity-100 transition-opacity">
          {entry.per100 && <IconButton name="scale" label="Adjust portion" onClick={() => setEditing((v) => !v)} className="size-8" />}
          <IconButton
            name="trash" label="Remove"
            onClick={() => { dispatch({ type: 'removeEntry', date, slot, id: entry.id }); toast('Removed'); }}
            className="size-8 hover:text-bad"
          />
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex items-center gap-3 animate-rise">
          <input
            type="range" min="5" max="600" step="5" value={entry.grams}
            onChange={(e) => setGrams(Number(e.target.value))}
            className="flex-1"
          />
          <Stepper value={entry.grams} onChange={setGrams} step={10} min={1} max={2000} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Food picker ────────────────────────────── */

const TABS = [
  { value: 'search', label: 'Search' },
  { value: 'ideas', label: 'Meal ideas' },
  { value: 'build', label: 'Build meal' },
  { value: 'mine', label: 'My meals' },
];

function FoodPicker({ slot, date, onClose, toast }) {
  const [tab, setTab] = useState('search');
  const slotMeta = MEAL_SLOTS.find((s) => s.id === slot);

  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={`Add to ${slotMeta.label.toLowerCase()}`}
      subtitle="Search the database, pick a ready-made meal, or build your own from scratch"
    >
      <Segmented options={TABS} value={tab} onChange={setTab} className="mb-4 w-full overflow-x-auto" />
      {tab === 'search' && <SearchTab slot={slot} date={date} toast={toast} onClose={onClose} />}
      {tab === 'ideas' && <IdeasTab slot={slot} date={date} toast={toast} onClose={onClose} />}
      {tab === 'build' && <BuildTab slot={slot} date={date} toast={toast} onClose={onClose} />}
      {tab === 'mine' && <MineTab slot={slot} date={date} toast={toast} onClose={onClose} />}
    </Sheet>
  );
}

/** Turn a food + gram amount into a log entry. */
function makeEntry(food, grams) {
  return {
    id: uid(),
    foodId: food.id,
    name: food.name,
    grams,
    unit: food.unit || 'g',
    per100: food.per100,
    n: nutrientsFor(food, grams),
  };
}

/* ── Tab: search the food database ── */

function SearchTab({ slot, date, toast }) {
  const { dispatch } = useStore();
  const foods = useAllFoods();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);

  const allowed = useAllowedDiets();
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    return foods
      .filter((f) => allowed.includes(f.diet))
      .filter((f) => cat === 'All' || f.category === cat)
      .filter((f) => !query || f.name.toLowerCase().includes(query) || f.category.toLowerCase().includes(query))
      .sort((a, b) => {
        if (!query) return a.name.localeCompare(b.name);
        return a.name.toLowerCase().indexOf(query) - b.name.toLowerCase().indexOf(query);
      })
      .slice(0, 80);
  }, [foods, q, cat, allowed]);

  const categories = ['All', ...FOOD_CATEGORIES.filter((c) => foods.some((f) => f.category === c && allowed.includes(f.diet)))];

  const pick = (food) => { setSelected(food); setGrams(food.servingGrams || 100); };

  const add = () => {
    dispatch({ type: 'addEntry', date, slot, entry: makeEntry(selected, grams) });
    toast(`${selected.name} added`);
    setSelected(null);
    setQ('');
  };

  if (selected) {
    const n = nutrientsFor(selected, grams);
    return (
      <div className="animate-rise">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-[12.5px] text-dim hover:text-[color:var(--text)] mb-4">
          <Icon name="chevL" className="size-3.5" /> Back to search
        </button>

        <h3 className="text-lg font-semibold">{selected.name}</h3>
        <div className="flex gap-2 mt-2 mb-5">
          <Badge tone="neutral">{selected.category}</Badge>
          <Badge tone={selected.diet === 'vegan' ? 'good' : selected.diet === 'nonveg' ? 'bad' : 'info'}>
            {selected.diet === 'nonveg' ? 'Non-veg' : selected.diet === 'egg' ? 'Egg' : selected.diet === 'vegan' ? 'Vegan' : 'Vegetarian'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <Stepper value={grams} onChange={setGrams} step={10} min={1} max={2000} />
          {selected.servingGrams && (
            <Chip onClick={() => setGrams(selected.servingGrams)}>
              {selected.servingLabel} ({selected.servingGrams} g)
            </Chip>
          )}
          {[50, 100, 150, 200].map((g) => (
            <Chip key={g} active={grams === g} onClick={() => setGrams(g)}>{g} g</Chip>
          ))}
        </div>

        <input type="range" min="5" max="500" step="5" value={Math.min(500, grams)}
               onChange={(e) => setGrams(Number(e.target.value))} className="w-full mb-5" />

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[['kcal', n.kcal, ''], ['Protein', n.protein, 'g'], ['Carbs', n.carbs, 'g'], ['Fat', n.fat, 'g']].map(([l, v, u]) => (
            <div key={l} className="rounded-2xl p-3 text-center" style={{ background: 'var(--surface)' }}>
              <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
              <div className="text-[17px] font-semibold tabular mt-1">{fmt(v)}<span className="text-[10px] text-faint">{u}</span></div>
            </div>
          ))}
        </div>

        <NutrientPeek n={n} />

        <Button variant="primary" size="lg" className="w-full mt-5" onClick={add}>
          <Icon name="plus" className="size-4" /> Add {Math.round(n.kcal)} kcal to {slot}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <Icon name="search" className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          autoFocus placeholder={`Search ${foods.length} foods — burger, pizza, shake, dal, paneer…`}
          value={q} onChange={(e) => setQ(e.target.value)} className="pl-10"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {categories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>
        ))}
      </div>

      {results.length === 0 ? (
        <Empty
          icon="search"
          title="Nothing matches"
          body="Try a different word, or use the Build meal tab to enter it yourself with your own calorie and macro numbers."
        />
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => pick(f)}
              className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all
                         hover:[background:var(--surface-hover)] active:scale-[0.99]"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{f.name}</div>
                <div className="text-[11px] text-faint tabular mt-0.5">
                  P {fmt(f.per100.protein)} · C {fmt(f.per100.carbs)} · F {fmt(f.per100.fat)} per 100 g
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-semibold tabular">{Math.round(f.per100.kcal)}</div>
                <div className="text-[9.5px] text-faint">kcal/100g</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab: curated meal ideas ── */

function IdeasTab({ slot, date, toast, onClose }) {
  const { dispatch } = useStore();
  const allowed = useAllowedDiets();
  const [expanded, setExpanded] = useState(null);

  const ideas = RECIPES.filter((r) => r.slot === slot && allowed.includes(r.diet));

  const addRecipe = (recipe) => {
    const entries = recipe.items.map(({ food, grams }) => makeEntry(food, grams));
    dispatch({ type: 'addEntries', date, slot, entries });
    toast(`${recipe.name} added — ${entries.length} items`);
    onClose();
  };

  if (!ideas.length) {
    return <Empty icon="book" title="No ideas for this slot yet" body="Try the search or build your own meal instead." />;
  }

  return (
    <div className="grid gap-2.5">
      {ideas.map((r) => {
        const n = r.items.reduce((acc, { food, grams }) => {
          const v = nutrientsFor(food, grams);
          for (const k of NUTRIENT_KEYS) acc[k] = (acc[k] || 0) + v[k];
          return acc;
        }, {});
        const isOpen = expanded === r.id;
        return (
          <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)' }}>
            <button onClick={() => setExpanded(isOpen ? null : r.id)} className="w-full p-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{r.name}</div>
                  <div className="text-[11.5px] text-faint mt-1 leading-relaxed">{r.blurb}</div>
                </div>
                <Icon name="chevD" className={`size-4 text-faint shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge tone="good">{Math.round(n.kcal)} kcal</Badge>
                <Badge tone="neutral">{Math.round(n.protein)} g protein</Badge>
                <Badge tone="neutral">{Math.round(n.carbs)} g carbs</Badge>
                <Badge tone="neutral">{Math.round(n.fat)} g fat</Badge>
                <Badge tone="info">{Math.round(n.fiber)} g fibre</Badge>
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 animate-rise">
                <div className="rounded-xl divide-y divide-[color:var(--border)] mb-3" style={{ background: 'var(--bg-elev)' }}>
                  {r.items.map(({ food, grams }, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[12.5px]">{food.name}</span>
                      <span className="text-[11.5px] text-faint tabular shrink-0 ml-3">
                        {grams} g · {Math.round(nutrientsFor(food, grams).kcal)} kcal
                      </span>
                    </div>
                  ))}
                </div>
                <NutrientPeek n={n} />
                <Button variant="primary" className="w-full mt-3" onClick={() => addRecipe(r)}>
                  <Icon name="plus" className="size-4" /> Add this meal
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: build your own ── */

function BuildTab({ slot, date, toast, onClose }) {
  const { state, dispatch } = useStore();
  const foods = useAllFoods();
  const [mode, setMode] = useState('combine');
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [mealName, setMealName] = useState('');

  // Manual entry ("count it yourself") state.
  const [manual, setManual] = useState({ name: '', grams: 100, kcal: '', protein: '', carbs: '', fat: '', fiber: '' });

  const allowed = useAllowedDiets();
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return foods.filter((f) => allowed.includes(f.diet) && f.name.toLowerCase().includes(query)).slice(0, 8);
  }, [foods, q, allowed]);

  const totals = useMemo(() => {
    const acc = {};
    for (const { food, grams } of items) {
      const v = nutrientsFor(food, grams);
      for (const k of NUTRIENT_KEYS) acc[k] = (acc[k] || 0) + v[k];
    }
    return acc;
  }, [items]);

  const addToPlate = (food) => {
    setItems((prev) => [...prev, { key: uid(), food, grams: food.servingGrams || 100 }]);
    setQ('');
  };

  const commit = (alsoSave) => {
    const entries = items.map(({ food, grams }) => makeEntry(food, grams));
    dispatch({ type: 'addEntries', date, slot, entries });
    if (alsoSave && mealName.trim()) {
      dispatch({
        type: 'saveMeal',
        meal: {
          id: uid(),
          name: mealName.trim(),
          slot,
          items: items.map(({ food, grams }) => ({ foodId: food.id, name: food.name, grams, per100: food.per100 })),
        },
      });
    }
    toast(alsoSave ? `Saved and added "${mealName}"` : `${entries.length} items added`);
    onClose();
  };

  const commitManual = () => {
    const grams = Number(manual.grams) || 100;
    const per100 = {};
    for (const k of NUTRIENT_KEYS) per100[k] = 0;
    // The user gives totals for the portion they ate; convert back to per-100 g.
    const scale = 100 / grams;
    per100.kcal = (Number(manual.kcal) || 0) * scale;
    per100.protein = (Number(manual.protein) || 0) * scale;
    per100.carbs = (Number(manual.carbs) || 0) * scale;
    per100.fat = (Number(manual.fat) || 0) * scale;
    per100.fiber = (Number(manual.fiber) || 0) * scale;

    const food = {
      id: uid(),
      name: manual.name.trim() || 'Custom item',
      diet: state.profile.dietMode === 'nonveg' ? 'nonveg' : state.profile.dietMode,
      category: 'My foods',
      servingGrams: grams,
      servingLabel: '1 serving',
      per100,
    };

    dispatch({ type: 'addCustomFood', food });
    dispatch({ type: 'addEntry', date, slot, entry: makeEntry(food, grams) });
    toast(`${food.name} added and saved to your foods`);
    onClose();
  };

  return (
    <div>
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'combine', label: 'Combine foods' },
          { value: 'manual', label: 'Count it yourself' },
        ]}
      />

      {mode === 'combine' ? (
        <>
          <p className="text-[12.5px] text-dim mb-3 leading-relaxed">
            Assemble a plate item by item. The totals update live, and you can save the result as a reusable meal.
          </p>

          <div className="relative mb-2">
            <Icon name="search" className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <Input placeholder="Add an ingredient…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>

          {matches.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-3 animate-rise" style={{ background: 'var(--surface)' }}>
              {matches.map((f) => (
                <button
                  key={f.id}
                  onClick={() => addToPlate(f)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:[background:var(--surface-hover)] transition-colors"
                >
                  <span className="text-[13px]">{f.name}</span>
                  <span className="text-[11px] text-faint tabular">{Math.round(f.per100.kcal)} kcal/100g</span>
                </button>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <Empty icon="plate" title="Empty plate" body="Search above to start adding ingredients." />
          ) : (
            <div className="space-y-1.5 mb-4">
              {items.map((it, i) => (
                <div key={it.key} className="flex items-center gap-2.5 p-2.5 rounded-2xl" style={{ background: 'var(--surface)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{it.food.name}</div>
                    <div className="text-[11px] text-faint tabular">{Math.round(nutrientsFor(it.food, it.grams).kcal)} kcal</div>
                  </div>
                  <Stepper
                    value={it.grams}
                    onChange={(g) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, grams: g } : x)))}
                    step={10} min={1} max={2000}
                  />
                  <IconButton
                    name="x" label="Remove"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    className="size-8 hover:text-bad"
                  />
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[['kcal', totals.kcal, ''], ['Protein', totals.protein, 'g'], ['Carbs', totals.carbs, 'g'], ['Fat', totals.fat, 'g']].map(([l, v, u]) => (
                  <div key={l} className="rounded-2xl p-3 text-center" style={{ background: 'var(--surface)' }}>
                    <div className="text-[10px] uppercase tracking-wider text-faint">{l}</div>
                    <div className="text-[17px] font-semibold tabular mt-1">{fmt(v)}<span className="text-[10px] text-faint">{u}</span></div>
                  </div>
                ))}
              </div>

              <NutrientPeek n={totals} />

              <Field label="Save as a reusable meal (optional)" className="mt-4">
                <Input placeholder="e.g. My usual breakfast" value={mealName} onChange={(e) => setMealName(e.target.value)} />
              </Field>

              <div className="flex gap-2 mt-4">
                <Button variant="primary" className="flex-1" onClick={() => commit(false)}>
                  <Icon name="plus" className="size-4" /> Add to {slot}
                </Button>
                {mealName.trim() && (
                  <Button variant="ghost" onClick={() => commit(true)}>
                    <Icon name="save" className="size-4" /> Save &amp; add
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-dim mb-4 leading-relaxed">
            Eating something not in the database? Read the numbers off the packet — or estimate them — and enter what you actually ate.
            It gets saved to your own food list so you only do this once.
          </p>

          <Field label="What is it?" className="mb-3">
            <Input autoFocus placeholder="e.g. Mum's rajma, office canteen thali"
                   value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Portion size" suffix="g">
              <NumberInput value={manual.grams} min={1} max={5000} fallback={100} onChange={(grams) => setManual({ ...manual, grams })} />
            </Field>
            <Field label="Calories in that portion" suffix="kcal">
              <NumberInput placeholder="0" value={manual.kcal} allowEmpty min={0} max={10000} onChange={(kcal) => setManual({ ...manual, kcal })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fibre']].map(([k, l]) => (
              <Field key={k} label={l} suffix="g">
                <NumberInput placeholder="0" value={manual[k]} allowEmpty min={0} max={2000} decimals={1}
                             onChange={(v) => setManual({ ...manual, [k]: v })} />
              </Field>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-2xl flex gap-2.5" style={{ background: 'var(--surface)' }}>
            <Icon name="info" className="size-4 text-info shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-dim leading-relaxed">
              If you only know the calories, leave the macros blank — the entry still counts toward your calorie target.
              Micronutrients cannot be inferred, so manual items show as zero in the micronutrient breakdown.
            </p>
          </div>

          <Button
            variant="primary" size="lg" className="w-full mt-4"
            disabled={!manual.name.trim() || !manual.kcal}
            onClick={commitManual}
          >
            <Icon name="plus" className="size-4" /> Add {manual.kcal || 0} kcal
          </Button>
        </>
      )}
    </div>
  );
}

/* ── Tab: saved meals and custom foods ── */

function MineTab({ slot, date, toast, onClose }) {
  const { state, dispatch } = useStore();
  const { savedMeals, customFoods } = state;

  const addSaved = (meal) => {
    const entries = meal.items.map((it) => {
      const n = {};
      for (const k of NUTRIENT_KEYS) n[k] = (it.per100?.[k] || 0) * (it.grams / 100);
      return { id: uid(), foodId: it.foodId, name: it.name, grams: it.grams, unit: 'g', per100: it.per100, n };
    });
    dispatch({ type: 'addEntries', date, slot, entries });
    toast(`${meal.name} added`);
    onClose();
  };

  if (!savedMeals.length && !customFoods.length) {
    return (
      <Empty
        icon="save"
        title="Nothing saved yet"
        body="Meals you build in the Build meal tab, and any food you enter manually, show up here for one-tap logging later."
      />
    );
  }

  return (
    <div className="space-y-5">
      {savedMeals.length > 0 && (
        <div>
          <SectionTitle icon="book">Saved meals</SectionTitle>
          <div className="grid gap-2">
            {savedMeals.map((m) => {
              const kcal = m.items.reduce((s, it) => s + (it.per100?.kcal || 0) * (it.grams / 100), 0);
              const protein = m.items.reduce((s, it) => s + (it.per100?.protein || 0) * (it.grams / 100), 0);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: 'var(--surface)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{m.name}</div>
                    <div className="text-[11.5px] text-faint tabular mt-0.5">
                      {m.items.length} items · {Math.round(kcal)} kcal · {Math.round(protein)} g protein
                    </div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => addSaved(m)}>Add</Button>
                  <IconButton
                    name="trash" label="Delete meal"
                    onClick={() => dispatch({ type: 'deleteSavedMeal', id: m.id })}
                    className="size-8 hover:text-bad"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {customFoods.length > 0 && (
        <div>
          <SectionTitle icon="plate">My foods</SectionTitle>
          <div className="grid gap-2">
            {customFoods.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3.5 rounded-2xl" style={{ background: 'var(--surface)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate">{f.name}</div>
                  <div className="text-[11.5px] text-faint tabular mt-0.5">
                    {Math.round(f.per100.kcal)} kcal / 100 g · default {f.servingGrams} g
                  </div>
                </div>
                <Button
                  size="sm" variant="primary"
                  onClick={() => {
                    dispatch({ type: 'addEntry', date, slot, entry: makeEntry(f, f.servingGrams) });
                    toast(`${f.name} added`);
                    onClose();
                  }}
                >Add</Button>
                <IconButton
                  name="trash" label="Delete food"
                  onClick={() => dispatch({ type: 'deleteCustomFood', id: f.id })}
                  className="size-8 hover:text-bad"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared: a glance at the notable micronutrients in a portion ── */

function NutrientPeek({ n }) {
  const items = [
    ['Fibre', n.fiber, 'g'], ['Iron', n.iron, 'mg'], ['Calcium', n.calcium, 'mg'],
    ['Vit C', n.vitC, 'mg'], ['Potassium', n.potassium, 'mg'], ['Sodium', n.sodium, 'mg'],
  ].filter(([, v]) => v > 0);
  if (!items.length) return null;

  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--surface)' }}>
      <div className="text-[10px] uppercase tracking-wider text-faint mb-2">Notable micronutrients</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map(([l, v, u]) => (
          <span key={l} className="text-[11.5px] text-dim tabular">
            {l} <span className="font-medium text-[color:var(--text)]">{fmt(v)}{u}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
