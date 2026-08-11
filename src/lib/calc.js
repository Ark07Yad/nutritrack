/**
 * The nutrition maths: BMR → TDEE → goal calories → macros.
 *
 * Every number the app shows about your energy needs comes from here, and
 * every function is pure so it can be reasoned about (and tested) in isolation.
 */

export const ACTIVITY_LEVELS = [
  { id: 'sedentary',  label: 'Sedentary',        factor: 1.2,   desc: 'Desk job, little or no exercise' },
  { id: 'light',      label: 'Lightly active',   factor: 1.375, desc: 'Light exercise 1–3 days a week' },
  { id: 'moderate',   label: 'Moderately active',factor: 1.55,  desc: 'Moderate exercise 3–5 days a week' },
  { id: 'active',     label: 'Very active',      factor: 1.725, desc: 'Hard exercise 6–7 days a week' },
  { id: 'athlete',    label: 'Athlete',          factor: 1.9,   desc: 'Twice daily training or physical job' },
];

export const GOALS = [
  { id: 'lose',     label: 'Lose fat',        icon: '📉', desc: 'Drop body fat while holding on to muscle' },
  { id: 'maintain', label: 'Maintain',        icon: '⚖️', desc: 'Stay where you are and eat consistently' },
  { id: 'gain',     label: 'Build muscle',    icon: '📈', desc: 'Gain lean mass with a controlled surplus' },
  { id: 'recomp',   label: 'Recomposition',   icon: '🔄', desc: 'Lose fat and gain muscle at the same weight' },
];

/** 1 kg of body fat ≈ 7700 kcal. */
export const KCAL_PER_KG = 7700;

/* ───────────────────────────── Body metrics ───────────────────────────── */

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value) {
  if (value < 18.5) return { label: 'Underweight', tone: 'warn' };
  if (value < 25)   return { label: 'Healthy',     tone: 'good' };
  if (value < 30)   return { label: 'Overweight',  tone: 'warn' };
  return { label: 'Obese', tone: 'bad' };
}

/** Healthy weight window for a height, from the BMI 18.5–24.9 band. */
export function healthyWeightRange(heightCm) {
  const m = heightCm / 100;
  return { min: 18.5 * m * m, max: 24.9 * m * m };
}

/** Deurenberg equation — a rough body-fat estimate from BMI, age and sex. */
export function estimateBodyFat({ weight, height, age, gender }) {
  const b = bmi(weight, height);
  if (!b) return 0;
  const sexFactor = gender === 'female' ? 0 : 1;
  return Math.max(3, 1.2 * b + 0.23 * age - 10.8 * sexFactor - 5.4);
}

export function leanBodyMass(profile) {
  const bf = profile.bodyFat || estimateBodyFat(profile);
  return profile.weight * (1 - bf / 100);
}

/* ─────────────────────────── Energy expenditure ────────────────────────── */

/**
 * Basal metabolic rate. Uses Katch-McArdle when body fat is known (it is more
 * accurate for lean and very heavy people alike), otherwise Mifflin-St Jeor.
 */
export function bmr(profile) {
  const { weight, height, age, gender, bodyFat } = profile;
  if (!weight || !height || !age) return 0;

  if (bodyFat) {
    const lbm = weight * (1 - bodyFat / 100);
    return 370 + 21.6 * lbm;
  }
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
}

export function activityFactor(id) {
  return ACTIVITY_LEVELS.find((a) => a.id === id)?.factor ?? 1.375;
}

/** Total daily energy expenditure — your maintenance calories. */
export function tdee(profile) {
  return bmr(profile) * activityFactor(profile.activity);
}

/* ──────────────────────────── Goal calculation ─────────────────────────── */

/**
 * Works out the daily calorie target for a goal, and reports honestly when the
 * requested timeframe would need an unsafe deficit.
 *
 * Guardrails applied, in order:
 *   1. Deficit is capped at 25% of TDEE (surplus at 20%).
 *   2. Intake never drops below 1200 kcal (female) / 1500 kcal (male).
 *   3. Weekly change is capped at 1% of bodyweight for loss, 0.5% for gain.
 */
export function goalPlan(profile) {
  const maintenance = tdee(profile);
  const { goal, weight, targetWeight, weeks, gender } = profile;

  const floor = gender === 'female' ? 1200 : 1500;
  const result = {
    maintenance,
    floor,
    adjusted: false,
    warnings: [],
  };

  if (goal === 'maintain') {
    return { ...result, target: maintenance, delta: 0, weeklyChange: 0, weeks: 0, kgToGo: 0, eta: null };
  }

  if (goal === 'recomp') {
    // Slight deficit, high protein: fat comes off while training drives growth.
    const target = Math.max(floor, maintenance * 0.95);
    return {
      ...result,
      target,
      delta: target - maintenance,
      weeklyChange: 0,
      weeks: profile.weeks || 12,
      kgToGo: 0,
      eta: addWeeks(new Date(), profile.weeks || 12),
      note: 'Recomposition runs a small 5% deficit with high protein. The scale barely moves — track the mirror, your lifts and your waist instead.',
    };
  }

  const kgToGo = (targetWeight || weight) - weight;      // negative = losing
  const horizon = Math.max(1, weeks || 12);
  const absKg = Math.abs(kgToGo);

  if (absKg < 0.1) {
    return { ...result, target: maintenance, delta: 0, weeklyChange: 0, weeks: horizon, kgToGo: 0, eta: null,
      warnings: ['Your target weight matches your current weight, so this is really a maintenance plan.'] };
  }

  // What the requested timeframe demands.
  let weeklyChange = kgToGo / horizon;                    // kg per week
  let daily = (weeklyChange * KCAL_PER_KG) / 7;           // kcal per day
  let target = maintenance + daily;

  // 1. Rate cap — 1% of bodyweight per week losing, 0.5% gaining.
  const maxLoss = weight * 0.01;
  const maxGain = weight * 0.005;
  if (kgToGo < 0 && Math.abs(weeklyChange) > maxLoss) {
    weeklyChange = -maxLoss;
    result.adjusted = true;
    result.warnings.push(
      `Losing ${absKg.toFixed(1)} kg in ${horizon} weeks would mean ${Math.abs(kgToGo / horizon).toFixed(2)} kg a week. ` +
      `Above ~1% of bodyweight per week you start shedding muscle, so the plan has been slowed to ${maxLoss.toFixed(2)} kg a week.`
    );
  }
  if (kgToGo > 0 && weeklyChange > maxGain) {
    weeklyChange = maxGain;
    result.adjusted = true;
    result.warnings.push(
      `Gaining faster than ${maxGain.toFixed(2)} kg a week mostly adds fat, not muscle. The surplus has been trimmed to match that ceiling.`
    );
  }

  daily = (weeklyChange * KCAL_PER_KG) / 7;
  target = maintenance + daily;

  // 2. Percentage cap on the adjustment.
  const maxDeficit = maintenance * 0.25;
  const maxSurplus = maintenance * 0.20;
  if (daily < -maxDeficit) {
    target = maintenance - maxDeficit;
    result.adjusted = true;
    result.warnings.push('Deficit capped at 25% of maintenance — deeper cuts tank energy, training quality and hormones.');
  }
  if (daily > maxSurplus) {
    target = maintenance + maxSurplus;
    result.adjusted = true;
    result.warnings.push('Surplus capped at 20% of maintenance. Extra calories beyond this go to fat, not muscle.');
  }

  // 3. Absolute floor.
  if (target < floor) {
    target = floor;
    result.adjusted = true;
    result.warnings.push(
      `Held at the ${floor} kcal floor. Eating below this makes it very hard to hit your micronutrient targets — ` +
      `if you need a bigger deficit, add activity rather than cutting food further.`
    );
  }

  // Recompute the realistic timeline from the calories we actually landed on.
  const realDaily = target - maintenance;
  const realWeekly = (realDaily * 7) / KCAL_PER_KG;
  const realWeeks = realWeekly === 0 ? horizon : Math.abs(kgToGo / realWeekly);

  if (result.adjusted && Math.abs(realWeeks - horizon) > 0.5) {
    result.warnings.push(
      `At a safe rate this takes about ${Math.ceil(realWeeks)} weeks rather than ${horizon}.`
    );
  }

  return {
    ...result,
    target,
    delta: realDaily,
    weeklyChange: realWeekly,
    weeks: Math.ceil(realWeeks),
    requestedWeeks: horizon,
    kgToGo,
    eta: addWeeks(new Date(), Math.ceil(realWeeks)),
  };
}

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

/* ───────────────────────────────  Macros  ─────────────────────────────── */

/**
 * Macro split. Protein is set per kg of bodyweight (the evidence-based way),
 * fat gets a floor of 20% of calories for hormone production, and carbs take
 * whatever remains.
 */
export function macroTargets(profile, calories) {
  const { goal, weight } = profile;

  const proteinPerKg = { lose: 2.0, recomp: 2.2, gain: 1.8, maintain: 1.6 }[goal] ?? 1.6;
  const fatPct       = { lose: 0.25, recomp: 0.25, gain: 0.25, maintain: 0.28 }[goal] ?? 0.25;

  let protein = weight * proteinPerKg;
  let fat = (calories * fatPct) / 9;

  let carbs = (calories - protein * 4 - fat * 9) / 4;

  // Very low calorie targets can leave carbs negative; pull protein back a bit.
  if (carbs < 30) {
    protein = Math.max(weight * 1.4, (calories - fat * 9 - 30 * 4) / 4);
    carbs = (calories - protein * 4 - fat * 9) / 4;
  }

  return {
    protein: Math.round(protein),
    carbs: Math.round(Math.max(0, carbs)),
    fat: Math.round(fat),
    proteinPerKg,
    proteinKcal: Math.round(protein * 4),
    carbsKcal: Math.round(Math.max(0, carbs) * 4),
    fatKcal: Math.round(fat * 9),
  };
}

/* ─────────────────────────────── Utilities ─────────────────────────────── */

export const cmToFeet = (cm) => {
  const inches = cm / 2.54;
  return { ft: Math.floor(inches / 12), in: Math.round(inches % 12) };
};
export const feetToCm = (ft, inch) => (ft * 12 + inch) * 2.54;
export const kgToLb = (kg) => kg * 2.20462;
export const lbToKg = (lb) => lb / 2.20462;

export const todayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const shiftKey = (key, days) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return todayKey(d);
};

export const prettyDate = (key) =>
  parseKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Wed" — chart axis labels. */
export const shortDay = (key) =>
  parseKey(key).toLocaleDateString(undefined, { weekday: 'short' });

/** "5 Aug" — list rows, where the weekday is redundant. */
export const shortDate = (key) =>
  parseKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export const isToday = (key) => key === todayKey();
