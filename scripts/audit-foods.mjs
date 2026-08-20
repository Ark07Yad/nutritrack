/**
 * Nutrient data audit.
 *
 * Checks every food against rules that must hold regardless of which database
 * a value came from. It cannot tell you that chicken has 31 g of protein
 * rather than 28 — only a source can — but it catches the errors that actually
 * occur in hand-entered tables: macros that do not add up to the stated
 * calories, a component exceeding its parent, and animal-only nutrients
 * appearing in plants.
 *
 *   node scripts/audit-foods.mjs
 *
 * Exits non-zero if any ERROR-level problem is found, so it can gate a build.
 */

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/data/foods.js', import.meta.url), 'utf8');

const KEYS = [
  'kcal', 'protein', 'carbs', 'fiber', 'sugar', 'fat', 'satFat', 'chol',
  'vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'b1', 'b2', 'b3', 'b5', 'b6', 'b7', 'b9', 'b12', 'choline',
  'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc',
  'copper', 'manganese', 'selenium', 'iodine', 'chromium', 'molybdenum',
];

/*
 * Serving weight is `\d+(\.\d+)?` — spices are logged at half a gram, and an
 * integer-only pattern silently skipped them. A row that does not match is not
 * reported as bad data, it is simply never seen, so the count guard below
 * exists to make that failure loud rather than invisible.
 */
const ROW = /^ {2}\['([^']+)',\s*'(vegan|vegetarian|egg|nonveg)',\s*'([^']+)',\s*\['([^']+)',\s*(\d+(?:\.\d+)?)\],\s*\[([^\]]+)\]\],/gm;

const rows = [...src.matchAll(ROW)].map((m) => {
  const values = m[6].split(',').map((s) => Number(s.trim()));
  const n = Object.fromEntries(KEYS.map((k, i) => [k, values[i]]));
  return { name: m[1], diet: m[2], category: m[3], n, count: values.length };
});

const problems = [];
const add = (level, food, rule, detail) => problems.push({ level, food, rule, detail });

/* ── Every data row must actually have been parsed ──
   Two foods once sat unaudited for exactly this reason. Counting the rows that
   look like data and comparing against the rows that parsed turns a silent
   gap into a failed build. */
const declared = (src.match(/^ {2}\['/gm) || []).length;
if (declared !== rows.length) {
  add('ERROR', 'foods.js', 'unparsed rows', `${declared} data rows but ${rows.length} parsed — ${declared - rows.length} skipped every check`);
}

/* ── Names must be unique ──
   Food ids are derived from the name, so two foods sharing one would share an
   id: usage history from one would attach to the other, and Recent would show
   whichever the lookup happened to return. */
const seenNames = new Map();
for (const f of rows) {
  if (seenNames.has(f.name)) add('ERROR', f.name, 'duplicate name', 'ids derive from names, so this collides');
  seenNames.set(f.name, true);
}

for (const f of rows) {
  const n = f.n;

  if (f.count !== 35) add('ERROR', f.name, 'shape', `${f.count} values, expected 35`);

  /* ── Atwater: do the macros explain the calories? ──
     4 kcal/g protein and carb, 9 for fat. Fibre yields ~2 rather than 4, so
     it is netted out. Real foods land within a few percent; a big gap means a
     macro or the calorie figure is wrong. */
  const atwater = 4 * n.protein + 4 * (n.carbs - n.fiber) + 2 * n.fiber + 9 * n.fat;

  /*
   * Atwater cannot model everything, and forcing it to would mean inventing
   * numbers to satisfy a check rather than recording what sources say.
   *
   * Two real exemptions:
   *
   *   Fibre-dominant foods — spices, cocoa. Composition tables derive
   *   carbohydrate "by difference" (whatever is left after protein, fat, ash
   *   and water), which in these lumps in a lot of indigestible material. USDA
   *   lists cocoa at 228 kcal while its own macros imply 359; the macros are
   *   right and so is the energy, because cocoa carries a special energy
   *   factor. Above ~35% fibre this stops being a discrepancy worth flagging.
   *
   *   Leaveners and sweetener substitutes — baking powder's "carbohydrate" is
   *   mostly bicarbonate and starch that never metabolises, and sucralose
   *   bulking agents are not absorbed at all.
   */
  const fibreDominant = n.carbs > 0 && n.fiber / n.carbs >= 0.35;
  const notMetabolised = /baking powder|baking soda|sweetener|^Salt$/i.test(f.name);

  if (n.kcal > 20 && !fibreDominant && !notMetabolised) {
    const diff = ((atwater - n.kcal) / n.kcal) * 100;
    if (Math.abs(diff) > 20) {
      add(Math.abs(diff) > 35 ? 'ERROR' : 'WARN', f.name, 'atwater',
        `stated ${n.kcal} kcal, macros imply ${Math.round(atwater)} (${diff > 0 ? '+' : ''}${diff.toFixed(0)}%)`);
    }
  }

  /* ── Components cannot exceed their parent ── */
  if (n.satFat > n.fat + 0.05) add('ERROR', f.name, 'satFat>fat', `${n.satFat} > ${n.fat}`);
  if (n.sugar > n.carbs + 0.05) add('ERROR', f.name, 'sugar>carbs', `${n.sugar} > ${n.carbs}`);
  if (n.fiber > n.carbs + 0.05) add('ERROR', f.name, 'fiber>carbs', `${n.fiber} > ${n.carbs}`);
  if (n.sugar + n.fiber > n.carbs + 0.5) {
    add('WARN', f.name, 'sugar+fibre>carbs', `${n.sugar}+${n.fiber} > ${n.carbs}`);
  }

  /* ── Mass balance: grams of macro cannot exceed 100 g of food ── */
  const mass = n.protein + n.carbs + n.fat;
  if (mass > 100.5) add('ERROR', f.name, 'mass', `${mass.toFixed(1)} g of macros per 100 g`);

  /* ── Nutrients that do not occur in plants ──
     Cholesterol is exclusively animal. B12 is made by bacteria and is absent
     from unfortified plant food — claiming otherwise in a vegan item is the
     single most harmful error this database could contain, because B12 is the
     one deficiency that causes irreversible nerve damage. */
  if (f.diet === 'vegan') {
    if (n.chol > 0) add('ERROR', f.name, 'cholesterol in vegan food', `${n.chol} mg`);
    // Fortified products legitimately carry B12 and vitamin D.
    const fortifiable = /fortified|cereal|corn flakes|soy milk|almond milk|oat milk|energy drink|energy shot|sports drink|yeast extract/i.test(f.name);
    if (n.b12 > 0 && !fortifiable) add('ERROR', f.name, 'B12 in unfortified plant food', `${n.b12} µg`);
    if (n.vitD > 0 && !fortifiable && !/mushroom/i.test(f.name)) {
      add('WARN', f.name, 'vitamin D in plant food', `${n.vitD} µg — only fortified foods and UV mushrooms contain it`);
    }
  }

  /* ── Animal foods contain essentially no vitamin C or fibre ── */
  // Only plain cuts qualify, and category is the reliable signal — a name-based
  // exclusion list silently misses things like challah, which is bread that
  // happens to contain egg rather than an animal food.
  const animalCategory = ['Meat & Poultry', 'Fish & Seafood', 'Eggs'].includes(f.category);
  const plainCut = animalCategory &&
    !/curry|sandwich|wrap|omelette|scotch|bhurji|fry|tikka|masala|65/i.test(f.name);
  if (plainCut) {
    if (n.fiber > 0.5) add('WARN', f.name, 'fibre in animal food', `${n.fiber} g — meat and fish contain none`);
    if (n.vitC > 3) add('WARN', f.name, 'vitamin C in animal food', `${n.vitC} mg`);
  }

  /* ── Nothing can exceed 100 g per 100 g, and micros have sane ceilings ── */
  for (const k of ['protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    if (n[k] > 100) add('ERROR', f.name, `${k} > 100 g`, String(n[k]));
    if (n[k] < 0) add('ERROR', f.name, `${k} negative`, String(n[k]));
  }
  for (const k of KEYS) {
    if (n[k] < 0) add('ERROR', f.name, `${k} negative`, String(n[k]));
    if (Number.isNaN(n[k])) add('ERROR', f.name, `${k} not a number`, 'NaN');
  }

  /* ── Implausibly high micros (per 100 g) ── */
  const ceilings = {
    vitC: 1000, vitA: 20000, vitD: 100, vitE: 200, vitK: 1500,
    b12: 100, b9: 2000, calcium: 2000, iron: 60, sodium: 20000,
    potassium: 3000, zinc: 60, selenium: 500, iodine: 2000,
  };
  /*
   * Seasonings and additives break every per-100 g ceiling, correctly. Salt
   * really is 38.7 g of sodium per 100 g and cumin really is 66 mg of iron —
   * the numbers are only startling because nobody eats 100 g of either. The
   * portions file logs these by the teaspoon, so the ceiling check would be
   * flagging accurate data as suspect.
   */
  const seasoning = f.category === 'Basics & Ingredients' &&
    /salt|pepper|turmeric|cumin|coriander powder|chilli|masala|mustard seed|asafoetida|cinnamon|cardamom|clove|bay leaf|fenugreek|baking|cocoa|sweetener/i.test(f.name);

  if (!seasoning) {
    for (const [k, max] of Object.entries(ceilings)) {
      if (n[k] > max) add('WARN', f.name, `${k} implausible`, `${n[k]} per 100 g (ceiling ${max})`);
    }
  }

  /* ── Pure fats and pure sugars should be nearly all of that thing ── */
  // Match the fat itself, not dishes cooked in it — "Ghee rice" is a rice dish.
  if (/(^|\s)oil$|^Ghee \(/i.test(f.name) && n.fat < 95) {
    add('WARN', f.name, 'oil should be ~100 g fat', `${n.fat} g`);
  }
}

/* ────────────────────────── Recipe integrity ──────────────────────────
   Recipes reference foods by name. A typo silently drops the ingredient —
   the meal still renders, just with fewer calories than it claims — which is
   worse than an error, because nothing looks wrong. This was already true of
   one recipe that referenced 'Ghee' instead of 'Ghee (clarified butter)'.

   recipes.js has a dev-only console.warn for this, which nobody sees in a
   build. Failing here instead. */

const names = new Set(rows.map((r) => r.name));
const recipeSrc = readFileSync(new URL('../src/data/recipes.js', import.meta.url), 'utf8');

for (const m of recipeSrc.matchAll(/\['([^']+)', (\d+(?:\.\d+)?)\]/g)) {
  const [, food, grams] = m;
  if (!names.has(food)) add('ERROR', 'recipes.js', 'unknown food reference', `"${food}"`);
  if (Number(grams) === 0) add('ERROR', 'recipes.js', 'zero-gram ingredient', `"${food}"`);
}

/* ───────────────────── Cycle data must never leave ─────────────────────
   The Cycle screen tells people their period data stays on the device. That
   promise is only worth what it is enforced by, so this pins the exact set of
   fields the client may send to the push server. Adding anything here is a
   deliberate act that fails the build until the list is updated — which is the
   point, because the failure mode is silent and irreversible. */

const ALLOWED_PUSH_FIELDS = new Set([
  'waterOn', 'waterEveryMinutes', 'waterFrom', 'waterTo',
  'streakOn', 'streakAt', 'tzOffsetMinutes', 'waterDoneDay', 'loggedDay',
]);

const pushSrc = readFileSync(new URL('../src/lib/push.js', import.meta.url), 'utf8');
const prefsBody = pushSrc.match(/function prefsFrom\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
const returned = prefsBody.match(/return \{([\s\S]*?)\n  \};/)?.[1] ?? '';

for (const m of returned.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)) {
  if (!ALLOWED_PUSH_FIELDS.has(m[1])) {
    add('ERROR', 'push.js', 'field sent to server is not on the allowlist', m[1]);
  }
}
if (/cycle|period|menstrual/i.test(prefsBody)) {
  add('ERROR', 'push.js', 'cycle data referenced in the push payload', 'see prefsFrom()');
}
if (!returned) add('ERROR', 'push.js', 'could not parse prefsFrom() — the guard is not running', '');

/* ─────────────────────────────── Report ─────────────────────────────── */

const errors = problems.filter((p) => p.level === 'ERROR');
const warns = problems.filter((p) => p.level === 'WARN');

console.log(`Audited ${rows.length} foods and every recipe reference\n`);

const show = (list, label) => {
  if (!list.length) return;
  console.log(`${label} (${list.length})`);
  const byRule = {};
  for (const p of list) (byRule[p.rule] ||= []).push(p);
  for (const [rule, items] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${rule} — ${items.length}`);
    for (const p of items) console.log(`    ${p.food.padEnd(38)} ${p.detail}`);
  }
  console.log();
};

show(errors, 'ERRORS');
show(warns, 'WARNINGS');

if (!problems.length) console.log('No problems found.');
else console.log(`${errors.length} error(s), ${warns.length} warning(s)`);

process.exit(errors.length ? 1 : 0);
