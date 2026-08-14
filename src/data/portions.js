/**
 * Portion units.
 *
 * Nobody weighs a pizza slice. Asking "how many grams?" for a milkshake is
 * the single fastest way to make someone give up on logging, because the
 * honest answer is "I have no idea". People think in the units the food is
 * *sold* in — a slice, a cup, two rotis, six momos — so the picker should ask
 * in those terms and do the gram conversion itself.
 *
 * Every food therefore gets a list of `{ id, label, grams, note }`. Grams are
 * still the storage unit and every nutrient calculation is unchanged; units
 * are purely an input convenience.
 *
 * Resolution order: an explicit entry by name, then a rule based on category
 * and name, then a sensible generic fallback. That means a new food is usable
 * immediately without anyone remembering to add portions for it.
 */

/* ─────────────────────────── Shared unit sets ─────────────────────────── */

const ML = (extra = []) => [
  { id: 'ml', label: 'ml', grams: 1, step: 50, note: 'millilitres' },
  { id: 'cup', label: 'cup', grams: 240, note: '240 ml' },
  { id: 'glass', label: 'glass', grams: 300, note: '300 ml' },
  ...extra,
];

const DRINK_SIZES = [
  { id: 'small', label: 'small', grams: 250, note: '250 ml' },
  { id: 'medium', label: 'medium', grams: 350, note: '350 ml' },
  { id: 'large', label: 'large', grams: 500, note: '500 ml' },
];

const PIECES = (gramsEach, noun = 'piece') => [
  { id: 'piece', label: noun, grams: gramsEach, step: 1 },
  { id: 'g', label: 'g', grams: 1, step: 10 },
];

/** Pizza is sold by diameter, and a slice of a 12" is nearly twice a 8" slice. */
const PIZZA_SLICES = [
  { id: 's8', label: 'slice', grams: 63, note: '8 inch personal, 6 slices' },
  { id: 's10', label: 'slice', grams: 85, note: '10 inch medium, 8 slices' },
  { id: 's12', label: 'slice', grams: 107, note: '12 inch large, 8 slices' },
  { id: 's14', label: 'slice', grams: 140, note: '14 inch extra large, 8 slices' },
  { id: 'g', label: 'g', grams: 1, step: 10 },
];

/* ─────────────────── Explicit overrides, keyed by name ─────────────────── */

const BY_NAME = {
  /* Pizza — the size matters more than anything else on the plate. */
  'Pizza, cheese (regular crust)': PIZZA_SLICES,
  'Pizza, veggie (thin crust)': PIZZA_SLICES,
  'Pizza, chicken / pepperoni': PIZZA_SLICES,

  /* Fast food, sold by the item. */
  'Veg burger (aloo tikki style)': PIECES(155, 'burger'),
  'Paneer burger': PIECES(170, 'burger'),
  'Chicken burger (crispy)': PIECES(170, 'burger'),
  'Cheeseburger (beef)': PIECES(120, 'burger'),
  'Double patty burger': PIECES(215, 'burger'),
  'Hot dog': PIECES(110, 'hot dog'),
  'Taco (beef)': PIECES(95, 'taco'),
  'Hash brown': PIECES(55, 'piece'),
  'Grilled cheese sandwich': PIECES(120, 'sandwich'),
  'Sub sandwich, veg (6 inch)': [
    { id: 'sub6', label: 'sub', grams: 220, note: '6 inch' },
    { id: 'sub12', label: 'footlong', grams: 440, note: '12 inch' },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Chicken wrap / kathi roll': PIECES(180, 'roll'),
  'French fries': [
    { id: 'small', label: 'small', grams: 71 },
    { id: 'medium', label: 'medium', grams: 117 },
    { id: 'large', label: 'large', grams: 154 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Onion rings': PIECES(85, 'serving'),
  'Fried chicken (2 pieces)': [
    { id: 'piece', label: 'piece', grams: 65, step: 1 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Chicken nuggets': [
    { id: 'piece', label: 'nugget', grams: 16, step: 1 },
    { id: 'box6', label: 'box of 6', grams: 96 },
    { id: 'box9', label: 'box of 9', grams: 144 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Garlic bread with cheese': PIECES(45, 'piece'),

  /* Indian street food. */
  'Vada pav': PIECES(120, 'vada pav'),
  'Pani puri (6 pieces)': [
    { id: 'piece', label: 'puri', grams: 20, step: 1 },
    { id: 'plate', label: 'plate of 6', grams: 120 },
  ],
  'Momos, steamed veg (6 pieces)': [
    { id: 'piece', label: 'momo', grams: 25, step: 1 },
    { id: 'plate', label: 'plate of 6', grams: 150 },
  ],
  'Momos, fried chicken (6 pieces)': [
    { id: 'piece', label: 'momo', grams: 27, step: 1 },
    { id: 'plate', label: 'plate of 6', grams: 160 },
  ],
  'Samosa (fried)': PIECES(60, 'samosa'),
  'Samosa chaat': PIECES(200, 'plate'),
  'Bhel puri': PIECES(150, 'plate'),
  'Pav bhaji': [
    { id: 'plate', label: 'plate', grams: 300, note: 'bhaji + 2 pav' },
    { id: 'half', label: 'half plate', grams: 180 },
    { id: 'g', label: 'g', grams: 1, step: 25 },
  ],
  'Chole bhature': [
    { id: 'plate', label: 'plate', grams: 300, note: 'chole + 2 bhature' },
    { id: 'half', label: 'half plate', grams: 180 },
    { id: 'g', label: 'g', grams: 1, step: 25 },
  ],
  'Masala dosa': PIECES(200, 'dosa'),
  'Plain dosa': PIECES(80, 'dosa'),
  'Idli (steamed)': PIECES(50, 'idli'),
  'Maggi noodles (prepared)': [
    { id: 'pack', label: 'pack', grams: 180, note: '70 g cake, cooked' },
    { id: 'half', label: 'half pack', grams: 90 },
    { id: 'g', label: 'g', grams: 1, step: 20 },
  ],

  /* Staples people count rather than weigh. */
  'Roti / chapati (whole wheat)': PIECES(40, 'roti'),
  'Whole wheat bread': PIECES(30, 'slice'),
  'Egg, whole (boiled)': PIECES(50, 'egg'),
  'Egg white (cooked)': PIECES(33, 'white'),
  'Egg omelette (2 eggs, 1 tsp oil)': PIECES(120, 'omelette'),
  'Banana': [
    { id: 'small', label: 'small', grams: 90 },
    { id: 'medium', label: 'medium', grams: 120 },
    { id: 'large', label: 'large', grams: 150 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Apple (with skin)': PIECES(180, 'apple'),
  'Orange': PIECES(150, 'orange'),
  'Guava': PIECES(100, 'guava'),
  'Avocado': [
    { id: 'half', label: 'half', grams: 100 },
    { id: 'whole', label: 'whole', grams: 200 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Dates (medjool)': PIECES(24, 'date'),

  /* Desserts. */
  'Ice cream, vanilla': [
    { id: 'scoop', label: 'scoop', grams: 65, step: 1 },
    { id: 'cup', label: 'cup', grams: 130 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Ice cream, chocolate': [
    { id: 'scoop', label: 'scoop', grams: 65, step: 1 },
    { id: 'cup', label: 'cup', grams: 130 },
    { id: 'g', label: 'g', grams: 1, step: 10 },
  ],
  'Doughnut (glazed)': PIECES(60, 'doughnut'),
  'Brownie': PIECES(60, 'piece'),
  'Chocolate chip cookie': PIECES(16, 'cookie'),
  'Gulab jamun (2 pieces)': PIECES(40, 'piece'),
  'Jalebi': PIECES(45, 'piece'),
  'Rasgulla (2 pieces)': PIECES(50, 'piece'),
  'Dark chocolate (70%)': [
    { id: 'square', label: 'square', grams: 10, step: 1 },
    { id: 'bar', label: 'bar', grams: 100 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  'Protein bar (typical)': PIECES(60, 'bar'),

  /* Drinks sold by cup size. */
  'Cola (regular)': [
    { id: 'can', label: 'can', grams: 330, note: '330 ml' },
    { id: 'bottle', label: 'bottle', grams: 500, note: '500 ml' },
    ...DRINK_SIZES,
    { id: 'ml', label: 'ml', grams: 1, step: 50 },
  ],
  'Diet cola (zero sugar)': [
    { id: 'can', label: 'can', grams: 330, note: '330 ml' },
    { id: 'bottle', label: 'bottle', grams: 500, note: '500 ml' },
    { id: 'ml', label: 'ml', grams: 1, step: 50 },
  ],
  'Energy drink': [
    { id: 'can', label: 'can', grams: 250, note: '250 ml' },
    { id: 'ml', label: 'ml', grams: 1, step: 50 },
  ],
  'Whey protein isolate (powder)': [
    { id: 'scoop', label: 'scoop', grams: 30, step: 1 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],

  /* Fats, measured in spoons. */
  'Olive oil (extra virgin)': [
    { id: 'tsp', label: 'tsp', grams: 4.5, step: 1 },
    { id: 'tbsp', label: 'tbsp', grams: 13.5 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  'Mustard oil': [
    { id: 'tsp', label: 'tsp', grams: 4.5, step: 1 },
    { id: 'tbsp', label: 'tbsp', grams: 13.5 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  'Coconut oil': [
    { id: 'tsp', label: 'tsp', grams: 4.5, step: 1 },
    { id: 'tbsp', label: 'tbsp', grams: 13.5 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  Ghee: [
    { id: 'tsp', label: 'tsp', grams: 5, step: 1 },
    { id: 'tbsp', label: 'tbsp', grams: 15 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  Butter: [
    { id: 'tsp', label: 'tsp', grams: 5, step: 1 },
    { id: 'tbsp', label: 'tbsp', grams: 14 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
  'Peanut butter (natural)': [
    { id: 'tbsp', label: 'tbsp', grams: 16, step: 1 },
    { id: 'g', label: 'g', grams: 1, step: 5 },
  ],
};

/* ───────────────────────── Rules for everything else ───────────────────── */

const LIQUID_CATEGORIES = new Set(['Beverages', 'Dairy Alternatives']);
const LIQUID_NAMES = /milk|shake|lassi|juice|coffee|tea|smoothie|frappe|water|buttermilk|chaas|hot chocolate|bubble/i;

const BOWL_CATEGORIES = new Set(['Prepared', 'Legumes']);

/**
 * Resolve the units for a food.
 * Always ends with a raw gram/ml option so nothing is un-loggable.
 */
export function portionsFor(food) {
  if (!food) return [{ id: 'g', label: 'g', grams: 1, step: 10 }];

  const explicit = BY_NAME[food.name];
  if (explicit) return explicit;

  const isLiquid =
    LIQUID_CATEGORIES.has(food.category) ||
    (food.category === 'Shakes & Desserts' && LIQUID_NAMES.test(food.name)) ||
    (food.category === 'Dairy' && LIQUID_NAMES.test(food.name));

  if (isLiquid) return [...ML(), ...DRINK_SIZES];

  if (BOWL_CATEGORIES.has(food.category)) {
    return [
      { id: 'katori', label: 'katori', grams: 150, note: 'small bowl, 150 g' },
      { id: 'bowl', label: 'bowl', grams: 250, note: 'large bowl' },
      { id: 'plate', label: 'plate', grams: 300 },
      { id: 'g', label: 'g', grams: 1, step: 25 },
    ];
  }

  if (food.category === 'Nuts & Seeds') {
    return [
      { id: 'tbsp', label: 'tbsp', grams: 10, step: 1 },
      { id: 'handful', label: 'handful', grams: 28 },
      { id: 'g', label: 'g', grams: 1, step: 5 },
    ];
  }

  if (food.category === 'Fast Food') {
    return [
      { id: 'serving', label: 'serving', grams: food.servingGrams || 150 },
      { id: 'plate', label: 'plate', grams: 250 },
      { id: 'g', label: 'g', grams: 1, step: 25 },
    ];
  }

  // Generic: the food's own serving, plus grams.
  const units = [{ id: 'g', label: 'g', grams: 1, step: 10 }];
  if (food.servingGrams && food.servingLabel) {
    units.unshift({
      id: 'serving',
      label: food.servingLabel.replace(/^1\s+/, ''),
      grams: food.servingGrams,
    });
  }
  return units;
}

/** The unit a picker should start on — the first non-raw one where possible. */
export function defaultPortion(food) {
  const units = portionsFor(food);
  return units.find((u) => u.grams !== 1) || units[0];
}

/** "2 slices (214 g)" — for showing what a choice actually amounts to. */
export function describePortion(unit, count) {
  if (!unit) return '';
  const grams = Math.round(unit.grams * count);
  if (unit.grams === 1) return `${grams} ${unit.label}`;
  const plural = count === 1 || /^(g|ml)$/.test(unit.label) ? unit.label : `${unit.label}s`;
  return `${+count.toFixed(2)} ${plural} · ${grams} g`;
}
