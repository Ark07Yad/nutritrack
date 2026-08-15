/**
 * Reference intakes.
 *
 * Two standards are supported, because they genuinely disagree and the
 * difference is large enough to change whether you look deficient:
 *
 *   'us'   Institute of Medicine / NASEM DRIs — RDA or AI. The default in most
 *          apps, and what US labels are built on.
 *   'eu'   EFSA Dietary Reference Values — Population Reference Intake (PRI)
 *          where one exists, otherwise Adequate Intake (AI). This is the basis
 *          for European dietary advice.
 *
 * Where they differ most:
 *
 *   B12        EU 4.0 µg vs US 2.4 — EFSA nearly doubles it
 *   Copper     EU 1.6 mg vs US 0.9
 *   Selenium   EU 70 µg vs US 55
 *   Iron (F)   EU 16 mg vs US 18
 *   Folate     EU 330 µg vs US 400
 *   Vitamin K  EU 70 µg vs US 120
 *   Sodium     EU 2000 mg vs US 2300 — EFSA's ceiling is stricter
 *   Fibre      EU 25 g flat vs US 38/25 by sex
 *
 * A separate thing worth not confusing with either: EU **NRVs** (Regulation
 * 1169/2011 Annex XIII) are the single, non-age-specific numbers printed on
 * European labels as "% NRV". They exist for labelling comparability, not as
 * personal targets, so they are exposed for reference but never used as your
 * goal.
 *
 * `ul` is the tolerable upper intake level. EFSA and the IOM also disagree
 * here; the lower of the two is used, since an upper limit is a safety
 * boundary and the cautious number is the right one to warn on.
 */

/** EU label reference values — what "% NRV" on a European pack means. */
export const EU_NRV = {
  vitA: 800, vitC: 80, vitD: 5, vitE: 12, vitK: 75,
  b1: 1.1, b2: 1.4, b3: 16, b5: 6, b6: 1.4, b7: 50, b9: 200, b12: 2.5,
  calcium: 800, iron: 14, magnesium: 375, phosphorus: 700, potassium: 2000,
  zinc: 10, copper: 1, manganese: 2, selenium: 55, iodine: 150,
  chromium: 40, molybdenum: 50,
};

export const NUTRIENT_INFO = {
  // ── Macronutrients (targets come from the calorie/macro engine, not here) ──
  protein:  { label: 'Protein',        unit: 'g',   group: 'macro' },
  carbs:    { label: 'Carbs',          unit: 'g',   group: 'macro' },
  fat:      { label: 'Fat',            unit: 'g',   group: 'macro' },

  fiber:    { label: 'Fibre',          unit: 'g',   group: 'macro', male: 38, female: 25, euMale: 25, euFemale: 25, ul: null,
              why: 'Feeds gut bacteria, slows glucose spikes and keeps you full on fewer calories.' },
  sugar:    { label: 'Sugars',         unit: 'g',   group: 'macro', male: 50, female: 50, euMale: 50, euFemale: 50, ul: 50, limit: true,
              why: 'Added sugar target — WHO suggests keeping free sugars under 10% of calories.' },
  satFat:   { label: 'Saturated fat',  unit: 'g',   group: 'macro', male: 22, female: 18, euMale: 22, euFemale: 18, ul: 22, limit: true,
              why: 'Keep under ~10% of calories to protect LDL cholesterol.' },
  chol:     { label: 'Cholesterol',    unit: 'mg',  group: 'macro', male: 300, female: 300, euMale: 300, euFemale: 300, ul: 300, limit: true,
              why: 'Dietary cholesterol matters less than once thought, but 300 mg is a sane ceiling.' },

  // ────────────────────────────── Vitamins ──────────────────────────────
  vitA:     { label: 'Vitamin A',      unit: 'µg',  group: 'vitamin', male: 900,  female: 700, euMale: 750, euFemale: 650,  ul: 3000,
              why: 'Vision, immune function and skin cell turnover.', sources: 'Carrot, sweet potato, spinach, egg yolk, dairy' },
  vitC:     { label: 'Vitamin C',      unit: 'mg',  group: 'vitamin', male: 90,   female: 75, euMale: 110, euFemale: 95,   ul: 2000,
              why: 'Collagen synthesis, antioxidant, boosts iron absorption from plants.', sources: 'Guava, capsicum, orange, broccoli, strawberry' },
  vitD:     { label: 'Vitamin D',      unit: 'µg',  group: 'vitamin', male: 15,   female: 15, euMale: 15, euFemale: 15,   ul: 100,
              why: 'Calcium absorption, bone density, immune and mood regulation.', sources: 'Sunlight, salmon, sardines, egg yolk, fortified milk' },
  vitE:     { label: 'Vitamin E',      unit: 'mg',  group: 'vitamin', male: 15,   female: 15, euMale: 13, euFemale: 11,   ul: 1000,
              why: 'Protects cell membranes from oxidative damage.', sources: 'Sunflower seeds, almonds, olive oil, avocado' },
  vitK:     { label: 'Vitamin K',      unit: 'µg',  group: 'vitamin', male: 120,  female: 90, euMale: 70, euFemale: 70,   ul: null,
              why: 'Blood clotting and directing calcium into bone rather than arteries.', sources: 'Spinach, broccoli, cabbage, edamame' },
  b1:       { label: 'B1 · Thiamin',   unit: 'mg',  group: 'vitamin', male: 1.2,  female: 1.1, euMale: 1.2, euFemale: 1.1,  ul: null,
              why: 'Converts carbohydrate into usable energy; nerve function.', sources: 'Sunflower seeds, oats, pork, flaxseed' },
  b2:       { label: 'B2 · Riboflavin',unit: 'mg',  group: 'vitamin', male: 1.3,  female: 1.1, euMale: 1.6, euFemale: 1.6,  ul: null,
              why: 'Energy metabolism and recycling of glutathione.', sources: 'Milk, curd, egg, almonds, mushroom' },
  b3:       { label: 'B3 · Niacin',    unit: 'mg',  group: 'vitamin', male: 16,   female: 14, euMale: 16, euFemale: 14,   ul: 35,
              why: 'NAD+ production — every cell uses it for energy release.', sources: 'Chicken, tuna, peanuts, mushroom' },
  b5:       { label: 'B5 · Pantothenic', unit: 'mg', group: 'vitamin', male: 5,   female: 5, euMale: 5, euFemale: 5,    ul: null,
              why: 'Builds coenzyme A, needed to burn fat and carbohydrate.', sources: 'Mushroom, avocado, egg, sunflower seeds' },
  b6:       { label: 'B6 · Pyridoxine',unit: 'mg',  group: 'vitamin', male: 1.3,  female: 1.3, euMale: 1.7, euFemale: 1.6,  ul: 100,
              why: 'Amino acid metabolism, haemoglobin and neurotransmitter synthesis.', sources: 'Chickpeas, banana, potato, salmon' },
  b7:       { label: 'B7 · Biotin',    unit: 'µg',  group: 'vitamin', male: 30,   female: 30, euMale: 40, euFemale: 40,   ul: null,
              why: 'Fat and glucose metabolism; hair, skin and nail structure.', sources: 'Egg yolk, almonds, sunflower seeds, sweet potato' },
  b9:       { label: 'B9 · Folate',    unit: 'µg',  group: 'vitamin', male: 400,  female: 400, euMale: 330, euFemale: 330,  ul: 1000,
              why: 'DNA synthesis and cell division — critical in pregnancy.', sources: 'Lentils, spinach, chickpeas, edamame' },
  b12:      { label: 'B12 · Cobalamin',unit: 'µg',  group: 'vitamin', male: 2.4,  female: 2.4, euMale: 4.0, euFemale: 4.0,  ul: null,
              why: 'Red blood cell formation and myelin. Only reliably found in animal foods.', sources: 'Sardines, egg, dairy, meat, fortified foods' },
  choline:  { label: 'Choline',        unit: 'mg',  group: 'vitamin', male: 550,  female: 425, euMale: 400, euFemale: 400,  ul: 3500,
              why: 'Cell membranes, liver fat export and acetylcholine for memory.', sources: 'Egg yolk, soybean, chicken, salmon' },

  // ────────────────────────────── Minerals ──────────────────────────────
  calcium:    { label: 'Calcium',      unit: 'mg',  group: 'mineral', male: 1000, female: 1000, euMale: 950, euFemale: 950, ul: 2500,
                why: 'Bone mineral, muscle contraction and nerve signalling.', sources: 'Paneer, milk, curd, ragi, sesame, tofu' },
  iron:       { label: 'Iron',         unit: 'mg',  group: 'mineral', male: 8,    female: 18, euMale: 11, euFemale: 16,   ul: 45,
                why: 'Carries oxygen in haemoglobin. Women need over twice as much pre-menopause.', sources: 'Sesame, pumpkin seeds, lentils, red meat, spinach' },
  magnesium:  { label: 'Magnesium',    unit: 'mg',  group: 'mineral', male: 400,  female: 310, euMale: 350, euFemale: 300,  ul: null,
                why: 'Cofactor in 300+ enzymes; muscle relaxation and sleep quality.', sources: 'Pumpkin seeds, almonds, dark chocolate, spinach' },
  phosphorus: { label: 'Phosphorus',   unit: 'mg',  group: 'mineral', male: 700,  female: 700, euMale: 550, euFemale: 550,  ul: 4000,
                why: 'Bone matrix and the phosphate in ATP.', sources: 'Dairy, pumpkin seeds, lentils, fish' },
  potassium:  { label: 'Potassium',    unit: 'mg',  group: 'mineral', male: 3400, female: 2600, euMale: 3500, euFemale: 3500, ul: null,
                why: 'Counters sodium, keeping blood pressure and fluid balance in check.', sources: 'Banana, potato, dates, rajma, avocado' },
  sodium:     { label: 'Sodium',       unit: 'mg',  group: 'mineral', male: 2300, female: 2300, euMale: 2000, euFemale: 2000, ul: 2300, limit: true,
                why: 'Essential, but most people overshoot. 2300 mg ≈ 1 tsp salt.', sources: 'Salt, processed food, restaurant meals' },
  zinc:       { label: 'Zinc',         unit: 'mg',  group: 'mineral', male: 11,   female: 8, euMale: 11.7, euFemale: 9.3,    ul: 40,
                why: 'Immune cells, wound healing, testosterone and taste.', sources: 'Pumpkin seeds, cashews, meat, chickpeas' },
  copper:     { label: 'Copper',       unit: 'mg',  group: 'mineral', male: 0.9,  female: 0.9, euMale: 1.6, euFemale: 1.3,  ul: 10,
                why: 'Iron transport, connective tissue and energy production.', sources: 'Cashews, sesame, dark chocolate, mushroom' },
  manganese:  { label: 'Manganese',    unit: 'mg',  group: 'mineral', male: 2.3,  female: 1.8, euMale: 3.0, euFemale: 3.0,  ul: 11,
                why: 'Bone formation and antioxidant defence in mitochondria.', sources: 'Oats, ragi, nuts, whole wheat' },
  selenium:   { label: 'Selenium',     unit: 'µg',  group: 'mineral', male: 55,   female: 55, euMale: 70, euFemale: 70,   ul: 400,
                why: 'Thyroid hormone conversion and antioxidant enzymes.', sources: 'Tuna, egg, sunflower seeds, sardines' },
  iodine:     { label: 'Iodine',       unit: 'µg',  group: 'mineral', male: 150,  female: 150, euMale: 150, euFemale: 150,  ul: 1100,
                why: 'Raw material for thyroid hormone — sets your metabolic rate.', sources: 'Iodised salt, dairy, fish, seaweed' },
  chromium:   { label: 'Chromium',     unit: 'µg',  group: 'mineral', male: 35,   female: 25, euMale: 25, euFemale: 25,   ul: null,
                why: 'Helps insulin move glucose into cells.', sources: 'Broccoli, whole grains, nuts, meat' },
  molybdenum: { label: 'Molybdenum',   unit: 'µg',  group: 'mineral', male: 45,   female: 45, euMale: 65, euFemale: 65,   ul: 2000,
                why: 'Cofactor for enzymes that clear sulphites and purines.', sources: 'Legumes, lentils, oats, nuts' },
};

export const VITAMINS = Object.keys(NUTRIENT_INFO).filter((k) => NUTRIENT_INFO[k].group === 'vitamin');
export const MINERALS = Object.keys(NUTRIENT_INFO).filter((k) => NUTRIENT_INFO[k].group === 'mineral');
export const MICROS = [...VITAMINS, ...MINERALS];

/** Micronutrient targets, adjusted for sex, age and pregnancy/lactation. */
export const STANDARDS = [
  {
    id: 'eu',
    label: 'European',
    short: 'EFSA',
    blurb: 'EFSA Dietary Reference Values — the basis for European dietary advice. Stricter on B12, copper, selenium and sodium.',
  },
  {
    id: 'us',
    label: 'American',
    short: 'IOM',
    blurb: 'Institute of Medicine DRIs. What most trackers use, and what US labels are built on.',
  },
];

/**
 * Daily micronutrient targets for a person, under the chosen standard.
 *
 * Age, sex and life-stage adjustments are applied on top. Where EFSA has not
 * published a value for something the IOM covers, the IOM figure is kept
 * rather than leaving a gap — the alternative is a nutrient that silently
 * stops being tracked when you switch standard.
 */
export function microTargets(profile) {
  const sex = profile.gender === 'female' ? 'female' : 'male';
  const age = profile.age || 30;
  const eu = (profile.standard || 'eu') === 'eu';
  const t = {};

  for (const key of MICROS) {
    const n = NUTRIENT_INFO[key];
    const euValue = sex === 'female' ? n.euFemale : n.euMale;
    t[key] = {
      target: (eu ? euValue : undefined) ?? n[sex],
      usTarget: n[sex],
      euTarget: euValue ?? n[sex],
      nrv: EU_NRV[key] ?? null,
      ul: n.ul,
      limit: !!n.limit,
      ...n,
    };
  }

  // Age-related adjustments. Both standards agree on the direction of these.
  if (age > 50) {
    t.vitD.target = 15;
    t.calcium.target = sex === 'female' ? 1200 : eu ? 950 : 1000;
    t.b6.target = sex === 'female' ? 1.5 : 1.7;
    if (sex === 'female') t.iron.target = eu ? 11 : 8; // post-menopause
  }
  if (age > 70) t.vitD.target = 20;

  if (sex === 'female' && profile.lifeStage === 'pregnant') {
    t.b9.target = eu ? 600 : 600;
    t.iron.target = eu ? 16 : 27;   // EFSA does not raise iron in pregnancy
    t.iodine.target = eu ? 200 : 220;
    t.choline.target = eu ? 480 : 450;
    t.vitA.target = eu ? 700 : 770;
    t.zinc.target = eu ? 12.7 : 11;
  }
  if (sex === 'female' && profile.lifeStage === 'lactating') {
    t.b9.target = eu ? 500 : 500;
    t.iron.target = eu ? 16 : 9;
    t.iodine.target = eu ? 200 : 290;
    t.choline.target = eu ? 520 : 550;
    t.vitC.target = eu ? 155 : 120;
    t.vitA.target = eu ? 1300 : 1300;
    t.zinc.target = eu ? 14.9 : 12;
  }
  return t;
}

/** Fibre / sat-fat / sugar / sodium targets that scale with calorie intake. */
export function macroLimits(profile, calories) {
  const sex = profile.gender === 'female' ? 'female' : 'male';
  const eu = (profile.standard || 'eu') === 'eu';

  return {
    // EFSA gives fibre as a flat 25 g adequate intake; the IOM scales it with
    // energy at 14 g per 1000 kcal.
    fiber: {
      target: eu ? 25 : Math.round((calories / 1000) * 14),
      unit: 'g', label: 'Fibre', limit: false,
    },
    sugar:  { target: Math.round((calories * 0.10) / 4), unit: 'g', label: 'Added sugars', limit: true },
    satFat: { target: Math.round((calories * 0.10) / 9), unit: 'g', label: 'Saturated fat', limit: true },
    // EFSA's safe and adequate intake is 2.0 g sodium (5 g salt); the IOM
    // chronic-disease reduction level is 2.3 g.
    sodium: { target: eu ? 2000 : 2300, unit: 'mg', label: 'Sodium', limit: true },
    chol:   { target: 300, unit: 'mg', label: 'Cholesterol', limit: true },
    // EFSA total water AI includes water from food; both are close enough that
    // the practical advice does not change.
    water:  { target: sex === 'female' ? 2.0 : 2.5, unit: 'L', label: 'Water (drinks)', limit: false },
  };
}
