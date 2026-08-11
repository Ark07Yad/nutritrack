/**
 * One hook that assembles everything the screens need for a given date:
 * targets, what has been eaten, what has been burned, and what remains.
 */

import { useMemo } from 'react';
import { useStore, dayTotals, emptyDay, recentDays } from './store';
import { goalPlan, macroTargets, bmi, bmiCategory, healthyWeightRange, estimateBodyFat, todayKey } from './calc';
import { microTargets, macroLimits } from '../data/rdi';

export function useNutrition(date = todayKey()) {
  const { state } = useStore();
  const { profile, days } = state;

  return useMemo(() => {
    const day = days[date] || emptyDay();
    const plan = goalPlan(profile);
    const macros = macroTargets(profile, plan.target);
    const targets = microTargets(profile);
    const limits = macroLimits(profile, plan.target);
    const { total, bySlot, burned, net, entryCount } = dayTotals(day);
    const history = recentDays(days, 30);

    const bmiValue = bmi(profile.weight, profile.height);

    return {
      date,
      profile,
      day,
      plan,
      macros,
      targets,
      limits,
      totals: total,
      bySlot,
      burned,
      net,
      entryCount,
      history,
      /** Calories left to eat, after crediting exercise. */
      remaining: plan.target - total.kcal + burned,
      body: {
        bmiValue,
        bmiCat: bmiCategory(bmiValue),
        range: healthyWeightRange(profile.height),
        bodyFat: profile.bodyFat || estimateBodyFat(profile),
      },
    };
  }, [profile, days, date]);
}
