/**
 * The coach.
 *
 * Two layers:
 *   1. A local rules engine that reads your logged data and produces concrete
 *      analysis. It needs no API key, no network and no account — it is the
 *      default and it always works.
 *   2. An optional bridge to a free-tier hosted model (Gemini, Groq or an
 *      OpenRouter free model) for open-ended conversation. You supply your own
 *      key; it is stored only in this browser and sent only to that provider.
 */

import { NUTRIENT_INFO, MICROS } from '../data/rdi';
import { FOODS } from '../data/foods';

/* ══════════════════════════════════════════════════════════════════════════
   Layer 1 — local analysis
   ══════════════════════════════════════════════════════════════════════════ */

const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);

/**
 * @param {object} ctx  { profile, plan, macros, totals, microTargets, day,
 *                        history, burned }
 * @returns {Array<{tone,title,body,tag}>}
 */
export function analyze(ctx) {
  const { profile, plan, macros, totals, targets, day, history } = ctx;
  const out = [];
  const kcal = totals.kcal;
  const target = plan.target;
  const logged = ctx.entryCount > 0;

  /* ── Calories ── */
  if (!logged) {
    out.push({
      tone: 'info', tag: 'Start here',
      title: 'Nothing logged yet today',
      body: `Your target is ${Math.round(target)} kcal. Log even one meal and I can start telling you something useful — the analysis below gets sharper with every entry.`,
    });
  } else {
    const ratio = pct(kcal, target);
    const remaining = target - kcal;
    if (ratio < 60) {
      out.push({
        tone: 'warn', tag: 'Calories',
        title: `${Math.round(remaining)} kcal still to eat`,
        body: `You are at ${Math.round(ratio)}% of target. Under-eating is not a shortcut — it costs you muscle and makes the plan harder to stick to. ${suggestCalorieFill(remaining, profile)}`,
      });
    } else if (ratio <= 105) {
      out.push({
        tone: 'good', tag: 'Calories',
        title: 'Calories are on track',
        body: `${Math.round(kcal)} of ${Math.round(target)} kcal — ${Math.round(ratio)}% of target. This is exactly the boring consistency that produces results.`,
      });
    } else if (ratio <= 120) {
      out.push({
        tone: 'warn', tag: 'Calories',
        title: `${Math.round(kcal - target)} kcal over target`,
        body: `One day at ${Math.round(ratio)}% will not undo anything — a week of it will. ${profile.goal === 'lose' ? 'Adding a 40-minute brisk walk burns roughly ' + Math.round(5 * 3.5 * profile.weight / 200 * 40) + ' kcal if you want to even it out.' : 'If you are bulking this is fine, just keep it deliberate.'}`,
      });
    } else {
      out.push({
        tone: 'bad', tag: 'Calories',
        title: `Well over target — ${Math.round(kcal)} kcal`,
        body: `That is ${Math.round(ratio)}% of your ${Math.round(target)} kcal target. Do not compensate by skipping tomorrow; just return to plan at the next meal. The weekly average is what moves the scale.`,
      });
    }
  }

  /* ── Protein ── */
  if (logged) {
    const p = pct(totals.protein, macros.protein);
    if (p < 70) {
      out.push({
        tone: 'warn', tag: 'Protein',
        title: `Protein is low — ${Math.round(totals.protein)} g of ${macros.protein} g`,
        body: `Protein is the one macro worth being strict about${profile.goal === 'lose' ? ' in a deficit — it is what decides whether the weight you lose is fat or muscle' : ''}. ` +
              `You need about ${Math.round(macros.protein - totals.protein)} g more. ${proteinIdeas(profile)}`,
      });
    } else if (p >= 90) {
      out.push({
        tone: 'good', tag: 'Protein',
        title: `Protein hit — ${Math.round(totals.protein)} g`,
        body: `That is ${macros.proteinPerKg} g per kg of bodyweight, right in the range the research supports for your goal.`,
      });
    }
  }

  /* ── Fibre ── */
  if (logged && totals.fiber < (ctx.limits?.fiber?.target || 30) * 0.6) {
    out.push({
      tone: 'warn', tag: 'Fibre',
      title: `Only ${Math.round(totals.fiber)} g of fibre`,
      body: `Aim for ${ctx.limits?.fiber?.target || 30} g. Fibre is the cheapest appetite control there is — it slows digestion so the same calories keep you full longer. Beans, oats, guava and any whole grain over its refined version.`,
    });
  }

  /* ── Micronutrient gaps ── */
  const gaps = [];
  const excess = [];
  for (const key of MICROS) {
    const t = targets[key];
    if (!t?.target) continue;
    const have = totals[key] || 0;
    const p = pct(have, t.target);
    if (t.limit) {
      if (p > 110) excess.push({ key, p, have, t });
    } else if (logged && p < 50) {
      gaps.push({ key, p, have, t });
    }
  }
  gaps.sort((a, b) => a.p - b.p);

  for (const g of gaps.slice(0, 3)) {
    const info = NUTRIENT_INFO[g.key];
    out.push({
      tone: 'warn', tag: 'Micronutrient',
      title: `${info.label} at ${Math.round(g.p)}% of target`,
      body: `${info.why} Best sources for you: ${dietFilteredSources(g.key, profile)}.`,
    });
  }

  for (const e of excess.slice(0, 2)) {
    const info = NUTRIENT_INFO[e.key];
    out.push({
      tone: e.p > 150 ? 'bad' : 'warn', tag: 'Over limit',
      title: `${info.label} at ${Math.round(e.p)}% of the ceiling`,
      body: e.key === 'sodium'
        ? 'Most of it comes from restaurant food, packaged snacks and pickles rather than the salt shaker. Extra potassium — banana, potato, rajma — partly offsets the blood-pressure effect.'
        : `${info.why} Worth easing off tomorrow.`,
    });
  }

  if (logged && gaps.length === 0 && excess.length === 0) {
    out.push({
      tone: 'good', tag: 'Micronutrients',
      title: 'No micronutrient gaps today',
      body: 'Every vitamin and mineral is above half its daily target and nothing has blown past its ceiling. That is genuinely hard to do — the variety in your food choices is doing the work.',
    });
  }

  /* ── Training ── */
  const burned = ctx.burned || 0;
  if (day.workouts.length === 0) {
    const streak = restStreak(history);
    if (streak >= 3) {
      out.push({
        tone: 'warn', tag: 'Training',
        title: `${streak} days without a logged workout`,
        body: profile.goal === 'lose'
          ? 'Resistance training is what tells your body to keep muscle while you lose fat. Without it, roughly a quarter of what you lose is lean mass. Even two sessions a week changes that.'
          : 'Muscle is built by the training stimulus; food only supplies the material. A surplus without training is just a surplus.',
      });
    }
  } else {
    const strength = day.workouts.filter((w) => w.type === 'strength').length;
    out.push({
      tone: 'good', tag: 'Training',
      title: `${day.workouts.length} session${day.workouts.length > 1 ? 's' : ''} logged · ${Math.round(burned)} kcal`,
      body: strength > 0
        ? 'Resistance work logged — that is the part that protects lean mass. Make sure protein lands within a few hours either side.'
        : 'Cardio is logged. Add two or three resistance sessions a week if you can; it is what preserves muscle and keeps your metabolic rate up.',
    });
  }

  /* ── Water ── */
  const waterL = (day.water || 0) * 0.25;
  const waterTarget = ctx.limits?.water?.target || 3;
  if (logged && waterL < waterTarget * 0.5) {
    out.push({
      tone: 'info', tag: 'Hydration',
      title: `${waterL.toFixed(1)} L of ${waterTarget} L`,
      body: 'Mild dehydration reads as hunger and drops training performance measurably. A glass before each meal is the easiest fix and blunts appetite slightly.',
    });
  }

  /* ── Trend ── */
  const trend = weightTrend(history, profile.goal);
  if (trend) out.push(trend);

  /* ── Adherence ── */
  const adherence = adherenceInsight(history, target);
  if (adherence) out.push(adherence);

  return out;
}

function suggestCalorieFill(remaining, profile) {
  if (remaining > 500) {
    return profile.dietMode === 'vegan'
      ? 'A tofu bowl with rice and peanut butter closes a gap like this quickly.'
      : 'A protein shake with milk plus a handful of nuts is about 450 kcal with minimal effort.';
  }
  return 'A fruit with nut butter, or a bowl of curd with seeds, gets you there.';
}

function proteinIdeas(profile) {
  if (profile.dietMode === 'vegan')
    return 'Tofu (17 g/100 g), tempeh (19 g), edamame, seitan, lentils and a soy or pea protein powder are your densest options.';
  if (profile.dietMode === 'vegetarian')
    return `Paneer (18 g/100 g), Greek yogurt, cottage cheese${profile.eatsEggs ? ', eggs' : ''} and whey are the fastest ways to close it.`;
  return 'Chicken breast (31 g/100 g), fish, eggs and Greek yogurt are the most efficient per calorie.';
}

/** Foods rich in a nutrient that this person will actually eat. */
function dietFilteredSources(nutrientKey, profile) {
  const allowed =
    profile.dietMode === 'vegan' ? ['vegan']
    : profile.dietMode === 'vegetarian' ? (profile.eatsEggs ? ['vegan', 'vegetarian', 'egg'] : ['vegan', 'vegetarian'])
    : ['vegan', 'vegetarian', 'egg', 'nonveg'];

  const ranked = FOODS
    .filter((f) => allowed.includes(f.diet) && f.per100[nutrientKey] > 0)
    .sort((a, b) => b.per100[nutrientKey] - a.per100[nutrientKey])
    .slice(0, 3)
    .map((f) => f.name.replace(/\s*\([^)]*\)/g, ''));

  return ranked.length ? ranked.join(', ') : NUTRIENT_INFO[nutrientKey].sources;
}

function restStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].day.workouts.length === 0) streak++;
    else break;
  }
  return streak;
}

function weightTrend(history, goal) {
  const points = history.filter((h) => h.day.weight).map((h) => ({ key: h.key, w: h.day.weight }));
  if (points.length < 3) return null;

  const first = points[0].w;
  const last = points[points.length - 1].w;
  const change = last - first;

  // Span the actual calendar gap, not the number of weigh-ins — sparse
  // logging would otherwise inflate the weekly rate.
  const msPerDay = 86400000;
  const span = Math.max(1, Math.round(
    (new Date(points[points.length - 1].key) - new Date(points[0].key)) / msPerDay
  ));

  if (Math.abs(change) < 0.3) {
    return {
      tone: goal === 'maintain' || goal === 'recomp' ? 'good' : 'info',
      tag: 'Trend',
      title: 'Weight is holding steady',
      body: goal === 'maintain' || goal === 'recomp'
        ? `${first.toFixed(1)} → ${last.toFixed(1)} kg. Holding steady is the goal, so this is exactly right.`
        : `${first.toFixed(1)} → ${last.toFixed(1)} kg across ${span} days. If you are trying to move it, the honest answer is usually that intake is higher than logged — weigh your food for a week and the gap normally shows up.`,
    };
  }

  const perWeek = (change / span) * 7;
  // Does the direction match what the user is trying to do?
  const wanted = goal === 'lose' ? -1 : goal === 'gain' ? 1 : 0;
  const matches = wanted === 0 ? Math.abs(perWeek) < 0.3 : Math.sign(change) === wanted;

  return {
    tone: matches ? 'good' : 'warn',
    tag: 'Trend',
    title: `${change > 0 ? '+' : ''}${change.toFixed(1)} kg over ${span} days`,
    body:
      `That is about ${perWeek > 0 ? '+' : ''}${perWeek.toFixed(2)} kg a week. ` +
      (matches
        ? 'Moving the right way. Day-to-day scale noise from water and food volume is ±1 kg, so judge it over two weeks, not two days.'
        : `You are trying to ${goal === 'lose' ? 'lose' : goal === 'gain' ? 'gain' : 'hold'} weight and the scale is going the other way. Before changing anything, check that two weeks have passed — water retention masks real change for surprisingly long. If it persists, intake is higher than logged.`),
  };
}

function adherenceInsight(history, target) {
  const logged = history.filter((h) => {
    const entries = Object.values(h.day.meals).flat();
    return entries.length > 0;
  });
  if (logged.length < 4) return null;

  const totals = logged.map((h) =>
    Object.values(h.day.meals).flat().reduce((s, e) => s + (e.n?.kcal || 0), 0)
  );
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const within = totals.filter((t) => Math.abs(t - target) <= target * 0.1).length;
  const rate = Math.round((within / totals.length) * 100);

  return {
    tone: rate >= 60 ? 'good' : 'info',
    tag: 'Consistency',
    title: `${rate}% of logged days within 10% of target`,
    body: `Your average over ${logged.length} logged days is ${Math.round(avg)} kcal against a ${Math.round(target)} kcal target — a ${avg > target ? 'surplus' : 'deficit'} of ${Math.abs(Math.round(avg - target))} kcal a day, roughly ${Math.abs((avg - target) * 7 / 7700).toFixed(2)} kg a week. ` +
          `${rate >= 60 ? 'Consistency at this level is what actually produces the result.' : 'Weekly average matters far more than any single day — aim to raise this number rather than to be perfect.'}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Local question answering
   ══════════════════════════════════════════════════════════════════════════ */

const INTENTS = [
  {
    match: /how many calor|maintenance|tdee|bmr|deficit|surplus/i,
    reply: (ctx) => {
      const { plan, profile, macros } = ctx;
      return `Your maintenance is **${Math.round(plan.maintenance)} kcal** a day — that is what you burn just existing plus your ${profile.activity} activity level.\n\n` +
        `For your goal (${profile.goal}) the target is **${Math.round(plan.target)} kcal**, a ${plan.delta >= 0 ? 'surplus' : 'deficit'} of ${Math.abs(Math.round(plan.delta))} kcal a day. ` +
        `That works out to about ${Math.abs(plan.weeklyChange).toFixed(2)} kg a week.\n\n` +
        `Split it as **${macros.protein} g protein · ${macros.carbs} g carbs · ${macros.fat} g fat**.`;
    },
  },
  {
    match: /protein/i,
    reply: (ctx) => {
      const { macros, totals, profile } = ctx;
      const left = Math.max(0, macros.protein - totals.protein);
      return `You are targeting **${macros.protein} g** a day (${macros.proteinPerKg} g per kg of bodyweight) and you have logged ${Math.round(totals.protein)} g. ` +
        (left > 0 ? `**${Math.round(left)} g to go.**\n\n` : `You are there.\n\n`) +
        proteinIdeas(profile) +
        `\n\nSpreading it across three or four meals of 25–40 g each beats one large hit — muscle protein synthesis responds to each dose separately.`;
    },
  },
  {
    match: /vitamin|mineral|micro|deficien|iron|calcium|b12|zinc|magnesium|folate/i,
    reply: (ctx) => {
      const { totals, targets, profile } = ctx;
      const low = MICROS
        .filter((k) => targets[k]?.target && !targets[k].limit)
        .map((k) => ({ k, p: pct(totals[k] || 0, targets[k].target) }))
        .filter((x) => x.p < 70)
        .sort((a, b) => a.p - b.p)
        .slice(0, 5);

      if (!low.length) return 'Every micronutrient you have logged today is above 70% of its target. Nothing to chase.';

      return `Your five biggest gaps right now:\n\n` +
        low.map((x) => `**${NUTRIENT_INFO[x.k].label}** — ${Math.round(x.p)}% of target. ${NUTRIENT_INFO[x.k].why} Try: ${dietFilteredSources(x.k, profile)}.`).join('\n\n') +
        (profile.dietMode === 'vegan'
          ? `\n\nOn a vegan diet, B12 is the one you genuinely cannot get from food — supplement it, do not hope.`
          : '');
    },
  },
  {
    match: /lose (weight|fat)|weight loss|cut|fat loss|slim/i,
    reply: (ctx) => {
      const { plan, profile, macros } = ctx;
      return `Fat loss is a calorie deficit held long enough to matter. Everything else is detail.\n\n` +
        `**Your numbers:** eat ${Math.round(plan.target)} kcal against ${Math.round(plan.maintenance)} maintenance — a ${Math.abs(Math.round(plan.delta))} kcal daily deficit, about ${Math.abs(plan.weeklyChange).toFixed(2)} kg a week.\n\n` +
        `**What decides whether it works:**\n` +
        `· Protein at ${macros.protein} g. In a deficit this is what keeps the loss coming from fat rather than muscle.\n` +
        `· Resistance training two to four times a week — same reason.\n` +
        `· Volume over density. ${profile.dietMode === 'nonveg' ? 'Chicken breast, egg whites' : 'Tofu, sprouts'}, vegetables and fruit let you eat a lot of food for few calories.\n` +
        `· Steps. Going from 4,000 to 9,000 a day is worth 150–250 kcal without touching your training.\n\n` +
        `**What does not matter:** meal timing, eating after 8 pm, "fat burning" foods, detoxes.`;
    },
  },
  {
    match: /gain|bulk|muscle|mass|build/i,
    reply: (ctx) => {
      const { plan, macros, profile } = ctx;
      return `Muscle needs three things: a stimulus, material, and a slight energy surplus.\n\n` +
        `**Your numbers:** ${Math.round(plan.target)} kcal (${Math.abs(Math.round(plan.delta))} above maintenance) and ${macros.protein} g protein.\n\n` +
        `**Rate:** aim for ${(profile.weight * 0.005).toFixed(2)} kg a week — about 0.5% of bodyweight. Faster than that and you are mostly adding fat, which you then have to diet off.\n\n` +
        `**Training beats diet here.** Progressive overload — more weight or more reps than last time — is the actual signal. Eight to twenty hard sets per muscle group per week, spread over two sessions.\n\n` +
        `**If the scale is not moving after two weeks,** add 200 kcal. Do not add 800.`;
    },
  },
  {
    match: /vegan|plant.?based/i,
    reply: () =>
      `A vegan diet covers everything except four things you need to plan for:\n\n` +
      `**B12** — not present in plant food in usable form. Supplement it. This is non-negotiable, not a preference.\n` +
      `**Iron** — plant (non-haem) iron absorbs at roughly a third the rate. Eat it with vitamin C: lemon on your dal, capsicum in the stir fry. Avoid tea or coffee within an hour of iron-rich meals.\n` +
      `**Protein quality** — individual plant proteins are low in one amino acid or another. Combining across the day (grains with legumes, the reason dal-chawal exists) solves it completely. Soy, quinoa and buckwheat are already complete.\n` +
      `**Omega-3** — flax, chia and walnuts give ALA, which converts to EPA/DHA at about 5%. An algae-oil supplement is the direct route.\n\n` +
      `Also worth watching: calcium (tofu set with calcium sulphate, ragi, sesame), zinc, iodine and vitamin D.`,
  },
  {
    match: /vegetarian|veg diet|no meat/i,
    reply: () =>
      `Lacto-vegetarian eating is nutritionally straightforward — dairy covers B12 and calcium, which are the two hard ones for vegans.\n\n` +
      `**Watch:** iron (same non-haem absorption problem — pair with vitamin C), zinc, and protein density. Indian vegetarian food skews carb-heavy; the fix is usually adding paneer, curd, or a legume to meals that are mostly rice or roti.\n\n` +
      `**Best protein per calorie:** cottage cheese, Greek yogurt, whey, paneer, tofu, soy chunks, sprouts.`,
  },
  {
    match: /workout|exercise|train|gym|routine|split/i,
    reply: (ctx) => {
      const { profile } = ctx;
      const plan = profile.goal === 'lose' ? 'a full-body circuit three times a week plus daily walking'
        : profile.goal === 'gain' ? 'an upper/lower split four days a week, or push/pull/legs if you can train six'
        : 'an upper/lower split four days a week';
      return `For your goal, ${plan} is the highest-return structure.\n\n` +
        `**The rules that actually matter:**\n` +
        `· Progressive overload. If the numbers in your log are not going up over months, nothing else you change will help.\n` +
        `· Compounds first — squat, deadlift, press, row, pull-up. They cover the most muscle per unit of time.\n` +
        `· Two to three sets short of failure per exercise. Grinding to failure every set costs more recovery than it buys.\n` +
        `· 48 hours between hitting the same muscle group hard.\n\n` +
        `Open the Workouts tab and hit "Load plan" to drop a full week into your log.`;
    },
  },
  {
    match: /water|hydrat|drink/i,
    reply: (ctx) => `Target about ${ctx.limits?.water?.target || 3} L a day, more when training or in heat. ` +
      `Practical check: pale straw urine. Mild dehydration reduces strength output measurably and often reads as hunger — a glass of water before a snack settles the question of whether you were actually hungry.`,
  },
  {
    match: /cheat|craving|junk|binge|sugar/i,
    reply: () =>
      `Cravings are not a character defect, and treating them as one is how people end up bingeing.\n\n` +
      `**What works:** fit the thing you want into the day's numbers rather than banning it. A 200 kcal square of chocolate inside your target costs you nothing. A banned food eaten at 11 pm in a shame spiral costs 1,200.\n\n` +
      `**What drives cravings:** under-eating protein, too little sleep, and a deficit that is too aggressive. If you are craving constantly, your deficit is probably too deep — shrink it and go slower.\n\n` +
      `**The 80/20 rule holds:** if 80% of your intake is whole food that hits your protein and fibre targets, the remaining 20% genuinely does not matter.`,
  },
  {
    match: /plateau|stuck|not losing|stopped/i,
    reply: (ctx) =>
      `Plateaus have three causes, in order of how often they are the real one:\n\n` +
      `**1. Intake has crept up.** Logging drifts — oil, sauces, bites while cooking. Weigh everything for one week and the missing 300 kcal usually appears.\n\n` +
      `**2. Activity has crept down.** Deficits make you unconsciously fidget and move less. Steps drop without you noticing. Check your step count against a month ago.\n\n` +
      `**3. Genuine metabolic adaptation.** Real, but smaller than people think — usually 5–10%. Your maintenance falls as you get lighter, so recalculate: at your current ${ctx.profile.weight} kg it is ${Math.round(ctx.plan.maintenance)} kcal.\n\n` +
      `Also: a two-week stall is not a plateau. Water retention masks fat loss for surprisingly long.`,
  },
  {
    match: /supplement|creatine|whey|multivitamin|pill/i,
    reply: () =>
      `Short list of things with real evidence behind them:\n\n` +
      `**Creatine monohydrate**, 3–5 g a day. Most-studied supplement in existence, works, cheap. Timing is irrelevant.\n` +
      `**Vitamin D** if you are indoors most of the day or live far from the equator.\n` +
      `**B12** if you are vegan — mandatory, not optional.\n` +
      `**Protein powder** — not magic, just a convenient food. Useful if you struggle to hit your target.\n` +
      `**Omega-3** if you rarely eat oily fish.\n\n` +
      `Everything else — fat burners, BCAAs, testosterone boosters, detox anything — is either unnecessary if you eat enough protein, or does nothing. Save the money for food.`,
  },
  {
    match: /sleep|rest|recover/i,
    reply: () =>
      `Sleep is the most under-rated variable in body composition.\n\n` +
      `Under six hours a night, studies show the same calorie deficit produces markedly less fat loss and more muscle loss — the split of what you lose shifts against you. It also raises ghrelin and lowers leptin, so you are hungrier on less sleep for reasons that have nothing to do with willpower.\n\n` +
      `Seven to nine hours. If you can only fix one thing this week and you are sleeping five, fix that before you touch your macros.`,
  },
  {
    match: /bmi|body fat|composition|healthy weight/i,
    reply: (ctx) => {
      const { bmiValue, bmiCat, range, bodyFat } = ctx.body;
      return `**BMI ${bmiValue.toFixed(1)}** — ${bmiCat.label}. The healthy weight window for your height is ${range.min.toFixed(1)}–${range.max.toFixed(1)} kg.\n\n` +
        `**Estimated body fat: ~${bodyFat.toFixed(1)}%** (from the Deurenberg equation — indicative, not a DEXA scan).\n\n` +
        `A caveat worth knowing: BMI cannot distinguish muscle from fat. Trained people routinely read "overweight" while carrying low body fat. Waist circumference relative to height is a better single number — keep your waist under half your height.`;
    },
  },
];

export function localAnswer(question, ctx) {
  for (const intent of INTENTS) {
    if (intent.match.test(question)) return intent.reply(ctx);
  }
  const insights = analyze(ctx);
  return `I do not have a specific answer prepared for that one, so here is what stands out in your data right now:\n\n` +
    insights.slice(0, 3).map((i) => `**${i.title}** — ${i.body}`).join('\n\n') +
    `\n\n_Try asking about calories, protein, micronutrients, fat loss, muscle gain, plateaus, supplements, sleep or your workout split. For open-ended conversation, connect a free model in Settings._`;
}

export const SUGGESTED_QUESTIONS = [
  'How many calories should I eat?',
  'Am I getting enough protein?',
  'Which micronutrients am I short on?',
  'Why have I stopped losing weight?',
  'What workout split should I run?',
  'Which supplements are actually worth it?',
];

/* ══════════════════════════════════════════════════════════════════════════
   Layer 2 — optional hosted model
   ══════════════════════════════════════════════════════════════════════════ */

export const AI_PROVIDERS = [
  {
    id: 'local',
    name: 'Built-in coach',
    free: true,
    needsKey: false,
    blurb: 'Rules engine running on your device. No key, no account, no network. Reads your actual logged data.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini Flash',
    free: true,
    needsKey: true,
    defaultModel: 'gemini-2.0-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    blurb: 'Generous free tier. Get a key from Google AI Studio in about a minute.',
  },
  {
    id: 'groq',
    name: 'Groq (Llama 3.3)',
    free: true,
    needsKey: true,
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    blurb: 'Free tier with very fast responses. Open-weights Llama models.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (free models)',
    free: true,
    needsKey: true,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'Routes to models with a :free suffix at no cost.',
  },
];

/** Compact snapshot of the user's data, given to the hosted model as context. */
export function buildContextPrompt(ctx) {
  const { profile, plan, macros, totals, targets, day } = ctx;
  const lowMicros = MICROS
    .filter((k) => targets[k]?.target && !targets[k].limit)
    .map((k) => ({ k, p: pct(totals[k] || 0, targets[k].target) }))
    .filter((x) => x.p < 70)
    .sort((a, b) => a.p - b.p)
    .slice(0, 6)
    .map((x) => `${NUTRIENT_INFO[x.k].label} ${Math.round(x.p)}%`)
    .join(', ');

  const meals = Object.entries(day.meals)
    .filter(([, list]) => list.length)
    .map(([slot, list]) => `${slot}: ${list.map((e) => `${e.name} (${Math.round(e.grams)}g)`).join(', ')}`)
    .join('; ') || 'nothing logged yet';

  return [
    `USER PROFILE: ${profile.gender}, ${profile.age}y, ${profile.height}cm, ${profile.weight}kg, ${profile.activity} activity, diet: ${profile.dietMode}${profile.eatsEggs && profile.dietMode === 'vegetarian' ? ' (eats eggs)' : ''}.`,
    `GOAL: ${profile.goal}, target ${profile.targetWeight}kg over ${profile.weeks} weeks.`,
    `ENERGY: maintenance ${Math.round(plan.maintenance)} kcal, target ${Math.round(plan.target)} kcal (${plan.delta >= 0 ? '+' : ''}${Math.round(plan.delta)}).`,
    `MACRO TARGETS: ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat.`,
    `TODAY SO FAR: ${Math.round(totals.kcal)} kcal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat, ${Math.round(totals.fiber)}g fibre.`,
    `MEALS: ${meals}`,
    `WORKOUTS TODAY: ${day.workouts.map((w) => `${w.name} ${w.minutes}min`).join(', ') || 'none'} (${Math.round(ctx.burned || 0)} kcal burned).`,
    lowMicros ? `MICRONUTRIENTS BELOW 70%: ${lowMicros}.` : `MICRONUTRIENTS: all above 70% of target.`,
  ].join('\n');
}

const SYSTEM_PROMPT =
  `You are the coach inside a calorie and workout tracking app. You have the user's real logged data below — use it, cite their actual numbers, and be specific rather than generic.\n\n` +
  `Style: direct, warm, concise. Short paragraphs. Markdown bold for numbers that matter. No preamble, no "great question", no bullet-point avalanche.\n\n` +
  `Substance: evidence-based nutrition and training only. Say plainly when something is uncertain or when the honest answer is "it doesn't matter much". Never invent numbers you were not given.\n\n` +
  `Boundaries: you are not a doctor or dietitian. If the user describes a medical condition, disordered eating, pregnancy complications, or asks about medication, say clearly that this needs a qualified professional and do not attempt to advise around it.`;

export async function askRemote(question, ctx, ai, history = []) {
  const provider = AI_PROVIDERS.find((p) => p.id === ai.provider);
  if (!provider || !provider.needsKey) throw new Error('No hosted provider selected.');
  if (!ai.key) throw new Error('Add your API key in Settings first.');

  const model = ai.model || provider.defaultModel;
  const context = buildContextPrompt(ctx);
  const turns = history.slice(-6);

  if (provider.id === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ai.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n--- USER DATA ---\n${context}` }] },
          contents: [
            ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
            { role: 'user', parts: [{ text: question }] },
          ],
          generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Gemini returned ${res.status}`);
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'No response returned.';
  }

  // Groq and OpenRouter are both OpenAI-compatible.
  const url =
    provider.id === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.key}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 900,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- USER DATA ---\n${context}` },
        ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text })),
        { role: 'user', content: question },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `${provider.name} returned ${res.status}`);
  return json.choices?.[0]?.message?.content || 'No response returned.';
}
