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
    [['Paneer (full fat)', 80], ['Roti / chapati (whole wheat)', 80], ['Curd / plain yogurt', 150], ['Ghee (clarified butter)', 5]]],
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

  /* ───────────────────────────── EATING OUT ─────────────────────────────
     Ordinary combos, logged in one tap. The point is not to recommend these
     — it is that a day you do not log is worse than a day you log honestly,
     and nobody itemises a burger meal into five separate searches. */
  ['Burger, fries & cola', 'lunch', 'vegetarian', 'The standard combo. Logged honestly it is easier to plan the rest of the day around',
    [['Veg burger (aloo tikki style)', 155], ['French fries', 117], ['Cola (regular)', 330]]],
  ['Chicken burger meal', 'lunch', 'nonveg', 'Swap the cola for diet and this drops by 140 kcal at no cost to the meal',
    [['Chicken burger (crispy)', 170], ['French fries', 117], ['Diet cola (zero sugar)', 330]]],
  ['Two slices of pizza', 'dinner', 'vegetarian', 'Two slices and a salad lands far better than four slices alone',
    [['Pizza, cheese (regular crust)', 214], ['Mixed salad (leafy + tomato + cucumber)', 120]]],
  ['Pizza night (chicken)', 'dinner', 'nonveg', 'Three slices with garlic bread — a genuinely big evening, worth seeing the number for',
    [['Pizza, chicken / pepperoni', 330], ['Garlic bread with cheese', 90]]],
  ['Street food evening', 'snack', 'vegan', 'Pani puri, bhel and a vada pav — the classic evening out',
    [['Pani puri (6 pieces)', 120], ['Bhel puri', 150], ['Vada pav', 120]]],
  ['Chole bhature plate', 'lunch', 'vegetarian', 'Heavy by design. Best treated as the whole meal rather than a side',
    [['Chole bhature', 300], ['Sweet lassi', 300]]],
  ['Momos & noodles', 'dinner', 'vegan', 'The default order. Steamed rather than fried saves about 120 kcal',
    [['Momos, steamed veg (6 pieces)', 150], ['Chowmein / hakka noodles', 250]]],
  ['Fried chicken bucket meal', 'dinner', 'nonveg', 'High protein for what it is — the fries and the drink are where the calories hide',
    [['Fried chicken (2 pieces)', 130], ['French fries', 117], ['Cola (regular)', 330]]],
  ['Shake & fries', 'snack', 'vegetarian', 'Around 700 kcal of almost pure liquid and fat. Worth knowing before, not after',
    [['Oreo / cookie thick shake', 400], ['French fries', 117]]],
  ['Coffee shop stop', 'snack', 'vegetarian', 'A frappe and a cookie is a meal’s worth of calories that never feels like one',
    [['Caramel frappe', 350], ['Chocolate chip cookie', 32]]],
  ['Dessert after dinner', 'snack', 'vegetarian', 'Two scoops fits most days if the rest of the day is planned around it',
    [['Ice cream, vanilla', 130]]],
  ['Biryani takeaway', 'lunch', 'nonveg', 'One of the better takeaway options — real protein, and the rice is the only thing to watch',
    [['Chicken biryani (restaurant)', 300], ['Curd / plain yogurt', 100]]],

  /* ─────────────────────────── INDIAN THALIS ───────────────────────────
     A thali is the unit people actually eat, and itemising one into six
     searches is why nobody logs lunch. Portions are a normal home serving:
     two rotis, one katori of dal, one of sabzi, rice, curd. */
  ['North Indian veg thali', 'lunch', 'vegetarian', 'Two rotis, dal, sabzi, rice and curd — the everyday plate',
    [['Roti / chapati (whole wheat)', 80], ['Dal fry', 180], ['Mixed veg sabzi', 150],
     ['White rice (cooked)', 120], ['Curd / plain yogurt', 100], ['Mixed salad (leafy + tomato + cucumber)', 80]]],
  ['Rajma chawal with curd', 'lunch', 'vegetarian', 'Complementary proteins, and the curd adds calcium the plate otherwise lacks',
    [['Rajma masala', 200], ['White rice (cooked)', 180], ['Curd / plain yogurt', 100]]],
  ['Dal khichdi with kadhi', 'dinner', 'vegetarian', 'Gentle on the stomach and genuinely balanced — a good late dinner',
    [['Khichdi', 200], ['Kadhi (besan & curd)', 150], ['Papad (roasted)', 10]]],
  ['Chole bhature plate (home)', 'lunch', 'vegetarian', 'Heavy by design. Worth seeing the number before rather than after',
    [['Chole / chickpeas (cooked)', 180], ['Bhatura', 80], ['Onion (raw)', 30]]],
  ['Paneer paratha breakfast', 'breakfast', 'vegetarian', 'Around 30 g protein — one of the few Indian breakfasts that really delivers',
    [['Paneer paratha', 125], ['Curd / plain yogurt', 150], ['Mango pickle', 8]]],
  ['Aloo paratha with curd', 'breakfast', 'vegetarian', 'Carb-heavy, so pair it with curd and keep it to one',
    [['Aloo paratha', 120], ['Curd / plain yogurt', 150], ['Butter', 5]]],
  ['South Indian breakfast', 'breakfast', 'vegan', 'Fermented, light and easy to digest — the idli-sambar standard',
    [['Idli (steamed)', 150], ['Sambar', 180], ['Coconut chutney', 30]]],
  ['Masala dosa plate', 'breakfast', 'vegan', 'One dosa with sambar and chutney, as it actually arrives',
    [['Masala dosa', 200], ['Sambar', 150], ['Coconut chutney', 30]]],
  ['Millet roti thali', 'dinner', 'vegan', 'Bajra instead of wheat roughly doubles the fibre and adds real iron',
    [['Bajra roti', 110], ['Toor dal / arhar (cooked)', 180], ['Bhindi masala', 150],
     ['Mixed salad (leafy + tomato + cucumber)', 80]]],
  ['Chicken curry thali', 'lunch', 'nonveg', 'Roti, chicken curry and rice — a full non-veg plate at a sane size',
    [['Roti / chapati (whole wheat)', 80], ['Chicken curry (home style)', 200],
     ['White rice (cooked)', 120], ['Cucumber raita', 100]]],
  ['Egg curry with rice (home)', 'dinner', 'egg', 'Cheap complete protein that still feels like a proper meal',
    [['Egg, whole (boiled)', 100], ['White rice (cooked)', 150], ['Jeera aloo', 120]]],
  ['Curd rice & pickle', 'dinner', 'vegetarian', 'The lightest dinner here, and the easiest thing to eat when nothing appeals',
    [['Curd rice', 200], ['Mango pickle', 8], ['Papad (roasted)', 10]]],
  ['Evening chai & snack', 'snack', 'vegetarian', 'The 5pm ritual, logged honestly — pakoras are the part that surprises people',
    [['Masala chai', 150], ['Onion pakora', 60]]],
  ['Sooji halwa & poori', 'snack', 'vegetarian', 'Festival food. Worth logging once rather than guessing',
    [['Sooji halwa', 80], ['Puri (fried)', 60]]],
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
