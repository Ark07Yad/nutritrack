/**
 * Ready-made meal options, organised by meal slot and diet.
 *
 * Each meal is a list of [food name, grams] pairs, so its calories and full
 * micronutrient profile are computed from the food database rather than
 * hardcoded — change a food's data and every meal using it stays correct.
 */

import { FOODS } from './foods';

const byName = new Map(FOODS.map((f) => [f.name, f]));

export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅', share: 0.25 },
  { id: 'lunch',     label: 'Lunch',     icon: '☀️', share: 0.35 },
  { id: 'snack',     label: 'Snack',     icon: '🍎', share: 0.15 },
  { id: 'dinner',    label: 'Dinner',    icon: '🌙', share: 0.25 },
];

const RAW = [
  /* ────────────────────────────── BREAKFAST ────────────────────────────── */
  ['Masala oats with peanut butter', 'breakfast', 'vegan', 'High fibre · beta-glucan for cholesterol',
    [['Rolled oats (dry)', 60], ['Soy milk (unsweetened, fortified)', 200], ['Peanut butter (natural)', 15], ['Banana', 100]]],
  ['Tofu bhurji with roti', 'breakfast', 'vegan', 'Complete plant protein, high calcium',
    [['Tofu (firm)', 150], ['Roti / chapati (whole wheat)', 60], ['Onion (raw)', 40], ['Tomato (raw)', 60], ['Mustard oil', 5]]],
  ['Idli with sambar', 'breakfast', 'vegan', 'Fermented, gut-friendly, naturally low fat',
    [['Idli (steamed)', 150], ['Sambar', 180]]],
  ['Poha with sprouts & peanuts', 'breakfast', 'vegan', 'Iron-fortified rice flakes plus sprouted protein',
    [['Poha (prepared)', 180], ['Moong sprouts (raw)', 60], ['Peanuts (roasted)', 15]]],
  ['Chia overnight pudding', 'vegan-quick', 'vegan', 'Omega-3 ALA and 12 g fibre before you even sit down',
    [['Chia seeds', 30], ['Almond milk (unsweetened, fortified)', 200], ['Blueberries', 80], ['Almonds', 15]]],

  ['Paneer paratha with curd', 'breakfast', 'vegetarian', 'Slow-digesting casein keeps you full till lunch',
    [['Paneer (full fat)', 80], ['Roti / chapati (whole wheat)', 80], ['Curd / plain yogurt', 150], ['Ghee', 5]]],
  ['Greek yogurt bowl', 'breakfast', 'vegetarian', 'High protein, probiotic, five minutes flat',
    [['Greek yogurt (plain, 2%)', 200], ['Strawberries', 100], ['Walnuts', 15], ['Rolled oats (dry)', 20]]],
  ['Protein smoothie', 'breakfast', 'vegetarian', 'For mornings when you cannot face solid food',
    [['Whey protein isolate (powder)', 30], ['Milk, toned / skim', 250], ['Banana', 120], ['Peanut butter (natural)', 15]]],

  ['Masala omelette with toast', 'breakfast', 'egg', 'Choline and complete protein for under 400 kcal',
    [['Egg omelette (2 eggs, 1 tsp oil)', 120], ['Whole wheat bread', 60], ['Capsicum / bell pepper (raw)', 40]]],
  ['Boiled eggs & fruit', 'breakfast', 'egg', 'Zero cooking, maximum protein density',
    [['Egg, whole (boiled)', 100], ['Egg white (cooked)', 66], ['Orange', 150], ['Almonds', 15]]],

  ['Chicken & egg breakfast bowl', 'breakfast', 'nonveg', 'Roughly 45 g protein — a serious muscle-gain start',
    [['Chicken breast (cooked, skinless)', 100], ['Egg, whole (boiled)', 100], ['Brown rice (cooked)', 120], ['Spinach / palak (raw)', 50]]],
  ['Smoked salmon toast', 'breakfast', 'nonveg', 'Vitamin D and omega-3 in one plate',
    [['Salmon (baked)', 80], ['Whole wheat bread', 60], ['Avocado', 50]]],

  /* ──────────────────────────────── LUNCH ──────────────────────────────── */
  ['Rajma chawal', 'lunch', 'vegan', 'The classic — complementary proteins make a full amino profile',
    [['Rajma masala', 200], ['White rice (cooked)', 180], ['Mixed salad (leafy + tomato + cucumber)', 100]]],
  ['Chole with brown rice', 'lunch', 'vegan', '15 g fibre and a big folate hit',
    [['Chana masala', 200], ['Brown rice (cooked)', 180], ['Onion (raw)', 40]]],
  ['Dal, roti & sabzi thali', 'lunch', 'vegan', 'Balanced everyday plate — the one you will actually repeat',
    [['Toor dal / arhar (cooked)', 200], ['Roti / chapati (whole wheat)', 80], ['Mixed veg sabzi', 150], ['Mixed salad (leafy + tomato + cucumber)', 100]]],
  ['Buddha bowl', 'lunch', 'vegan', 'Quinoa + chickpeas covers all nine essential amino acids',
    [['Quinoa (cooked)', 180], ['Chole / chickpeas (cooked)', 120], ['Broccoli (steamed)', 100], ['Avocado', 50], ['Olive oil (extra virgin)', 7]]],
  ['Tempeh stir fry', 'lunch', 'vegan', 'Fermented soy — easier on digestion than plain beans',
    [['Tempeh', 150], ['Brown rice (cooked)', 150], ['Capsicum / bell pepper (raw)', 80], ['Broccoli (steamed)', 80], ['Olive oil (extra virgin)', 7]]],

  ['Palak paneer with roti', 'lunch', 'vegetarian', 'Iron from spinach, calcium from paneer, vitamin C to bind it',
    [['Palak paneer', 200], ['Roti / chapati (whole wheat)', 80], ['Curd / plain yogurt', 100]]],
  ['Dal khichdi with curd', 'lunch', 'vegetarian', 'Gentle on the gut, still 20 g protein',
    [['Dal tadka', 200], ['White rice (cooked)', 150], ['Curd / plain yogurt', 150], ['Mixed veg sabzi', 100]]],
  ['Paneer tikka salad', 'lunch', 'vegetarian', 'Low carb, high protein, genuinely filling',
    [['Paneer (full fat)', 120], ['Mixed salad (leafy + tomato + cucumber)', 200], ['Capsicum / bell pepper (raw)', 80], ['Olive oil (extra virgin)', 10]]],

  ['Grilled chicken & rice', 'lunch', 'nonveg', 'The default bodybuilding lunch, for good reason',
    [['Chicken breast (cooked, skinless)', 150], ['Brown rice (cooked)', 200], ['Broccoli (steamed)', 120], ['Olive oil (extra virgin)', 7]]],
  ['Chicken curry with roti', 'lunch', 'nonveg', 'Home-style, satisfying, still under 600 kcal',
    [['Chicken curry (home style)', 250], ['Roti / chapati (whole wheat)', 80], ['Mixed salad (leafy + tomato + cucumber)', 100]]],
  ['Fish curry & rice', 'lunch', 'nonveg', 'Omega-3, selenium and iodine in one meal',
    [['Fish curry (home style)', 250], ['White rice (cooked)', 180], ['Bottle gourd / lauki (cooked)', 100]]],
  ['Tuna quinoa bowl', 'lunch', 'nonveg', 'Highest protein-per-calorie lunch in this list',
    [['Tuna (canned in water, drained)', 120], ['Quinoa (cooked)', 180], ['Mixed salad (leafy + tomato + cucumber)', 150], ['Olive oil (extra virgin)', 10]]],

  /* ──────────────────────────────── SNACK ──────────────────────────────── */
  ['Sprout chaat', 'snack', 'vegan', 'Protein and vitamin C for barely 150 kcal',
    [['Moong sprouts (raw)', 120], ['Tomato (raw)', 50], ['Onion (raw)', 30], ['Orange', 60]]],
  ['Nuts & fruit', 'snack', 'vegan', 'Portable, no prep, magnesium-rich',
    [['Almonds', 20], ['Walnuts', 10], ['Apple (with skin)', 150]]],
  ['Hummus with veg sticks', 'snack', 'vegan', 'Fibre plus fat means it actually holds you',
    [['Hummus', 60], ['Carrot (raw)', 80], ['Cucumber (raw)', 80]]],
  ['Roasted chana', 'snack', 'vegan', 'Cheap, shelf-stable, 10 g protein',
    [['Chole / chickpeas (cooked)', 120], ['Peanuts (roasted)', 15]]],
  ['Banana peanut butter toast', 'snack', 'vegan', 'Pre-workout carbs with a little fat to slow the spike',
    [['Whole wheat bread', 30], ['Peanut butter (natural)', 20], ['Banana', 100]]],

  ['Curd with fruit & seeds', 'snack', 'vegetarian', 'Probiotics, calcium and a fibre top-up',
    [['Curd / plain yogurt', 200], ['Pomegranate (arils)', 80], ['Pumpkin seeds', 15]]],
  ['Paneer cubes', 'vegetarian-quick', 'vegetarian', 'Straight casein — ideal before bed',
    [['Paneer (full fat)', 80], ['Cucumber (raw)', 80]]],
  ['Protein shake', 'snack', 'vegetarian', 'Post-workout, 30 g protein in 90 seconds',
    [['Whey protein isolate (powder)', 30], ['Milk, toned / skim', 250]]],
  ['Chaas & dark chocolate', 'snack', 'vegetarian', 'When you want the treat without derailing the day',
    [['Buttermilk / chaas (salted)', 240], ['Dark chocolate (70%)', 20]]],

  ['Boiled eggs', 'snack', 'egg', 'Two eggs, 13 g protein, no cooking skill required',
    [['Egg, whole (boiled)', 100]]],

  ['Chicken salad cup', 'snack', 'nonveg', 'Lean protein snack that will not sit heavy',
    [['Chicken breast (cooked, skinless)', 80], ['Mixed salad (leafy + tomato + cucumber)', 120]]],

  /* ─────────────────────────────── DINNER ──────────────────────────────── */
  ['Tofu & veg with roti', 'dinner', 'vegan', 'Light, high calcium, easy to digest before bed',
    [['Tofu (firm)', 150], ['Mixed veg sabzi', 150], ['Roti / chapati (whole wheat)', 60]]],
  ['Moong dal & lauki', 'dinner', 'vegan', 'The lightest dinner here — ideal if you eat late',
    [['Moong dal (cooked)', 200], ['Bottle gourd / lauki (cooked)', 150], ['Roti / chapati (whole wheat)', 40]]],
  ['Dosa with sambar', 'dinner', 'vegan', 'Fermented carbs, easy on the stomach',
    [['Plain dosa', 160], ['Sambar', 180], ['Mixed salad (leafy + tomato + cucumber)', 80]]],
  ['Lentil soup & salad', 'dinner', 'vegan', 'Under 350 kcal with 18 g protein — a deficit favourite',
    [['Brown lentils / masoor (cooked)', 220], ['Mixed salad (leafy + tomato + cucumber)', 150], ['Olive oil (extra virgin)', 7]]],
  ['Edamame rice bowl', 'dinner', 'vegan', 'Complete protein, high folate and vitamin K',
    [['Edamame (cooked)', 150], ['Brown rice (cooked)', 150], ['Broccoli (steamed)', 100], ['Sesame seeds / til', 9]]],

  ['Palak paneer & salad (low carb)', 'dinner', 'vegetarian', 'Skips the grain — good on rest days',
    [['Palak paneer', 200], ['Mixed salad (leafy + tomato + cucumber)', 150]]],
  ['Vegetable pulao with raita', 'dinner', 'vegetarian', 'Comfort food that still fits the numbers',
    [['Veg pulao', 200], ['Curd / plain yogurt', 150], ['Mixed salad (leafy + tomato + cucumber)', 100]]],
  ['Cottage cheese scramble', 'vegetarian-quick', 'vegetarian', 'Twelve minutes, 30 g protein, minimal fat',
    [['Cottage cheese (low fat)', 200], ['Capsicum / bell pepper (raw)', 80], ['Mushroom, button (cooked)', 80], ['Olive oil (extra virgin)', 7]]],

  ['Grilled fish & vegetables', 'dinner', 'nonveg', 'Lean protein, vitamin D, almost no carbs',
    [['Tilapia / rohu (cooked)', 180], ['Broccoli (steamed)', 120], ['Sweet potato (baked)', 120], ['Olive oil (extra virgin)', 7]]],
  ['Chicken & vegetable soup', 'dinner', 'nonveg', 'High volume, low calorie — beats hunger on a cut',
    [['Chicken breast (cooked, skinless)', 120], ['Mixed veg sabzi', 150], ['Mushroom, button (cooked)', 80]]],
  ['Salmon with quinoa', 'dinner', 'nonveg', 'Best omega-3 to protein ratio on the list',
    [['Salmon (baked)', 150], ['Quinoa (cooked)', 150], ['Spinach / palak (raw)', 60], ['Olive oil (extra virgin)', 7]]],
  ['Egg curry with rice', 'dinner', 'egg', 'Cheap protein that still feels like a proper meal',
    [['Egg, whole (boiled)', 150], ['White rice (cooked)', 150], ['Mixed veg sabzi', 120]]],
];

let rid = 0;
export const RECIPES = RAW.map(([name, slotRaw, diet, blurb, items]) => {
  const slot = slotRaw.split('-')[0];
  return {
    id: `r${++rid}`,
    name,
    slot,
    diet,
    blurb,
    items: items
      .map(([foodName, grams]) => ({ food: byName.get(foodName), grams }))
      .filter((i) => i.food),
  };
});

if (import.meta.env?.DEV) {
  const missing = RAW.flatMap(([name, , , , items]) =>
    items.filter(([fn]) => !byName.has(fn)).map(([fn]) => `${name}: "${fn}"`)
  );
  if (missing.length) console.warn('[recipes] unknown food names:\n' + missing.join('\n'));
}
