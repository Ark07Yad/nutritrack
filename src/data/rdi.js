/**
 * Reference daily intakes for adults (19–50), based on the US Institute of
 * Medicine DRIs. `rda` is the RDA or AI; `ul` is the tolerable upper intake
 * level where one is established (null = none set).
 */

export const NUTRIENT_INFO = {
  // ── Macronutrients (targets come from the calorie/macro engine, not here) ──
  protein:  { label: 'Protein',        unit: 'g',   group: 'macro' },
  carbs:    { label: 'Carbs',          unit: 'g',   group: 'macro' },
  fat:      { label: 'Fat',            unit: 'g',   group: 'macro' },

  fiber:    { label: 'Fibre',          unit: 'g',   group: 'macro', male: 38, female: 25, ul: null,
              why: 'Feeds gut bacteria, slows glucose spikes and keeps you full on fewer calories.' },
  sugar:    { label: 'Sugars',         unit: 'g',   group: 'macro', male: 50, female: 50, ul: 50, limit: true,
              why: 'Added sugar target — WHO suggests keeping free sugars under 10% of calories.' },
  satFat:   { label: 'Saturated fat',  unit: 'g',   group: 'macro', male: 22, female: 18, ul: 22, limit: true,
              why: 'Keep under ~10% of calories to protect LDL cholesterol.' },
  chol:     { label: 'Cholesterol',    unit: 'mg',  group: 'macro', male: 300, female: 300, ul: 300, limit: true,
              why: 'Dietary cholesterol matters less than once thought, but 300 mg is a sane ceiling.' },

  // ────────────────────────────── Vitamins ──────────────────────────────
  vitA:     { label: 'Vitamin A',      unit: 'µg',  group: 'vitamin', male: 900,  female: 700,  ul: 3000,
              why: 'Vision, immune function and skin cell turnover.', sources: 'Carrot, sweet potato, spinach, egg yolk, dairy' },
  vitC:     { label: 'Vitamin C',      unit: 'mg',  group: 'vitamin', male: 90,   female: 75,   ul: 2000,
              why: 'Collagen synthesis, antioxidant, boosts iron absorption from plants.', sources: 'Guava, capsicum, orange, broccoli, strawberry' },
  vitD:     { label: 'Vitamin D',      unit: 'µg',  group: 'vitamin', male: 15,   female: 15,   ul: 100,
              why: 'Calcium absorption, bone density, immune and mood regulation.', sources: 'Sunlight, salmon, sardines, egg yolk, fortified milk' },
  vitE:     { label: 'Vitamin E',      unit: 'mg',  group: 'vitamin', male: 15,   female: 15,   ul: 1000,
              why: 'Protects cell membranes from oxidative damage.', sources: 'Sunflower seeds, almonds, olive oil, avocado' },
  vitK:     { label: 'Vitamin K',      unit: 'µg',  group: 'vitamin', male: 120,  female: 90,   ul: null,
              why: 'Blood clotting and directing calcium into bone rather than arteries.', sources: 'Spinach, broccoli, cabbage, edamame' },
  b1:       { label: 'B1 · Thiamin',   unit: 'mg',  group: 'vitamin', male: 1.2,  female: 1.1,  ul: null,
              why: 'Converts carbohydrate into usable energy; nerve function.', sources: 'Sunflower seeds, oats, pork, flaxseed' },
  b2:       { label: 'B2 · Riboflavin',unit: 'mg',  group: 'vitamin', male: 1.3,  female: 1.1,  ul: null,
              why: 'Energy metabolism and recycling of glutathione.', sources: 'Milk, curd, egg, almonds, mushroom' },
  b3:       { label: 'B3 · Niacin',    unit: 'mg',  group: 'vitamin', male: 16,   female: 14,   ul: 35,
              why: 'NAD+ production — every cell uses it for energy release.', sources: 'Chicken, tuna, peanuts, mushroom' },
  b5:       { label: 'B5 · Pantothenic', unit: 'mg', group: 'vitamin', male: 5,   female: 5,    ul: null,
              why: 'Builds coenzyme A, needed to burn fat and carbohydrate.', sources: 'Mushroom, avocado, egg, sunflower seeds' },
  b6:       { label: 'B6 · Pyridoxine',unit: 'mg',  group: 'vitamin', male: 1.3,  female: 1.3,  ul: 100,
              why: 'Amino acid metabolism, haemoglobin and neurotransmitter synthesis.', sources: 'Chickpeas, banana, potato, salmon' },
  b7:       { label: 'B7 · Biotin',    unit: 'µg',  group: 'vitamin', male: 30,   female: 30,   ul: null,
              why: 'Fat and glucose metabolism; hair, skin and nail structure.', sources: 'Egg yolk, almonds, sunflower seeds, sweet potato' },
  b9:       { label: 'B9 · Folate',    unit: 'µg',  group: 'vitamin', male: 400,  female: 400,  ul: 1000,
              why: 'DNA synthesis and cell division — critical in pregnancy.', sources: 'Lentils, spinach, chickpeas, edamame' },
  b12:      { label: 'B12 · Cobalamin',unit: 'µg',  group: 'vitamin', male: 2.4,  female: 2.4,  ul: null,
              why: 'Red blood cell formation and myelin. Only reliably found in animal foods.', sources: 'Sardines, egg, dairy, meat, fortified foods' },
  choline:  { label: 'Choline',        unit: 'mg',  group: 'vitamin', male: 550,  female: 425,  ul: 3500,
              why: 'Cell membranes, liver fat export and acetylcholine for memory.', sources: 'Egg yolk, soybean, chicken, salmon' },

  // ────────────────────────────── Minerals ──────────────────────────────
  calcium:    { label: 'Calcium',      unit: 'mg',  group: 'mineral', male: 1000, female: 1000, ul: 2500,
                why: 'Bone mineral, muscle contraction and nerve signalling.', sources: 'Paneer, milk, curd, ragi, sesame, tofu' },
  iron:       { label: 'Iron',         unit: 'mg',  group: 'mineral', male: 8,    female: 18,   ul: 45,
                why: 'Carries oxygen in haemoglobin. Women need over twice as much pre-menopause.', sources: 'Sesame, pumpkin seeds, lentils, red meat, spinach' },
  magnesium:  { label: 'Magnesium',    unit: 'mg',  group: 'mineral', male: 400,  female: 310,  ul: null,
                why: 'Cofactor in 300+ enzymes; muscle relaxation and sleep quality.', sources: 'Pumpkin seeds, almonds, dark chocolate, spinach' },
  phosphorus: { label: 'Phosphorus',   unit: 'mg',  group: 'mineral', male: 700,  female: 700,  ul: 4000,
                why: 'Bone matrix and the phosphate in ATP.', sources: 'Dairy, pumpkin seeds, lentils, fish' },
  potassium:  { label: 'Potassium',    unit: 'mg',  group: 'mineral', male: 3400, female: 2600, ul: null,
                why: 'Counters sodium, keeping blood pressure and fluid balance in check.', sources: 'Banana, potato, dates, rajma, avocado' },
  sodium:     { label: 'Sodium',       unit: 'mg',  group: 'mineral', male: 2300, female: 2300, ul: 2300, limit: true,
                why: 'Essential, but most people overshoot. 2300 mg ≈ 1 tsp salt.', sources: 'Salt, processed food, restaurant meals' },
  zinc:       { label: 'Zinc',         unit: 'mg',  group: 'mineral', male: 11,   female: 8,    ul: 40,
                why: 'Immune cells, wound healing, testosterone and taste.', sources: 'Pumpkin seeds, cashews, meat, chickpeas' },
  copper:     { label: 'Copper',       unit: 'mg',  group: 'mineral', male: 0.9,  female: 0.9,  ul: 10,
                why: 'Iron transport, connective tissue and energy production.', sources: 'Cashews, sesame, dark chocolate, mushroom' },
  manganese:  { label: 'Manganese',    unit: 'mg',  group: 'mineral', male: 2.3,  female: 1.8,  ul: 11,
                why: 'Bone formation and antioxidant defence in mitochondria.', sources: 'Oats, ragi, nuts, whole wheat' },
  selenium:   { label: 'Selenium',     unit: 'µg',  group: 'mineral', male: 55,   female: 55,   ul: 400,
                why: 'Thyroid hormone conversion and antioxidant enzymes.', sources: 'Tuna, egg, sunflower seeds, sardines' },
  iodine:     { label: 'Iodine',       unit: 'µg',  group: 'mineral', male: 150,  female: 150,  ul: 1100,
                why: 'Raw material for thyroid hormone — sets your metabolic rate.', sources: 'Iodised salt, dairy, fish, seaweed' },
  chromium:   { label: 'Chromium',     unit: 'µg',  group: 'mineral', male: 35,   female: 25,   ul: null,
                why: 'Helps insulin move glucose into cells.', sources: 'Broccoli, whole grains, nuts, meat' },
  molybdenum: { label: 'Molybdenum',   unit: 'µg',  group: 'mineral', male: 45,   female: 45,   ul: 2000,
                why: 'Cofactor for enzymes that clear sulphites and purines.', sources: 'Legumes, lentils, oats, nuts' },
};

export const VITAMINS = Object.keys(NUTRIENT_INFO).filter((k) => NUTRIENT_INFO[k].group === 'vitamin');
export const MINERALS = Object.keys(NUTRIENT_INFO).filter((k) => NUTRIENT_INFO[k].group === 'mineral');
export const MICROS = [...VITAMINS, ...MINERALS];

/** Micronutrient targets, adjusted for sex, age and pregnancy/lactation. */
export function microTargets(profile) {
  const sex = profile.gender === 'female' ? 'female' : 'male';
  const age = profile.age || 30;
  const t = {};

  for (const key of MICROS) {
    const n = NUTRIENT_INFO[key];
    t[key] = { target: n[sex], ul: n.ul, limit: !!n.limit, ...n };
  }

  // Age-related adjustments.
  if (age > 50) {
    t.vitD.target = 15;
    t.calcium.target = sex === 'female' ? 1200 : 1000;
    t.b6.target = sex === 'female' ? 1.5 : 1.7;
    if (sex === 'female') t.iron.target = 8; // post-menopause
  }
  if (age > 70) t.vitD.target = 20;

  if (sex === 'female' && profile.lifeStage === 'pregnant') {
    t.b9.target = 600; t.iron.target = 27; t.iodine.target = 220;
    t.choline.target = 450; t.vitA.target = 770; t.zinc.target = 11;
  }
  if (sex === 'female' && profile.lifeStage === 'lactating') {
    t.b9.target = 500; t.iron.target = 9; t.iodine.target = 290;
    t.choline.target = 550; t.vitC.target = 120; t.vitA.target = 1300; t.zinc.target = 12;
  }
  return t;
}

/** Fibre / sat-fat / sugar / sodium targets that scale with calorie intake. */
export function macroLimits(profile, calories) {
  const sex = profile.gender === 'female' ? 'female' : 'male';
  return {
    fiber:  { target: Math.round((calories / 1000) * 14), unit: 'g', label: 'Fibre', limit: false },
    sugar:  { target: Math.round((calories * 0.10) / 4),  unit: 'g', label: 'Added sugars', limit: true },
    satFat: { target: Math.round((calories * 0.10) / 9),  unit: 'g', label: 'Saturated fat', limit: true },
    sodium: { target: 2300, unit: 'mg', label: 'Sodium', limit: true },
    chol:   { target: 300,  unit: 'mg', label: 'Cholesterol', limit: true },
    water:  { target: sex === 'female' ? 2.7 : 3.7, unit: 'L', label: 'Water', limit: false },
  };
}
