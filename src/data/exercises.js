/**
 * Exercise library. `met` is the Metabolic Equivalent of Task from the 2011
 * Compendium of Physical Activities — calories burned ≈ MET × 3.5 × kg / 200
 * per minute.
 *
 * Strength moves also carry `muscles` and default set/rep guidance so the
 * workout log can double as a training plan.
 */

export const EXERCISES = [
  // ── Cardio ──
  { id: 'x1',  name: 'Walking (casual, 4 km/h)',   type: 'cardio',   met: 3.0,  muscles: ['Legs'] },
  { id: 'x2',  name: 'Brisk walking (6 km/h)',     type: 'cardio',   met: 5.0,  muscles: ['Legs'] },
  { id: 'x3',  name: 'Jogging (8 km/h)',           type: 'cardio',   met: 8.3,  muscles: ['Legs', 'Core'] },
  { id: 'x4',  name: 'Running (11 km/h)',          type: 'cardio',   met: 11.0, muscles: ['Legs', 'Core'] },
  { id: 'x5',  name: 'Cycling (moderate, 20 km/h)',type: 'cardio',   met: 8.0,  muscles: ['Legs'] },
  { id: 'x6',  name: 'Cycling (vigorous, 25+ km/h)',type: 'cardio',  met: 10.0, muscles: ['Legs'] },
  { id: 'x7',  name: 'Swimming (freestyle, moderate)', type: 'cardio', met: 8.3, muscles: ['Full body'] },
  { id: 'x8',  name: 'Skipping rope',              type: 'cardio',   met: 12.3, muscles: ['Legs', 'Shoulders'] },
  { id: 'x9',  name: 'Stair climbing',             type: 'cardio',   met: 9.0,  muscles: ['Legs', 'Glutes'] },
  { id: 'x10', name: 'Elliptical trainer',         type: 'cardio',   met: 5.0,  muscles: ['Full body'] },
  { id: 'x11', name: 'Rowing machine (moderate)',  type: 'cardio',   met: 7.0,  muscles: ['Back', 'Legs'] },
  { id: 'x12', name: 'HIIT circuit',               type: 'cardio',   met: 10.0, muscles: ['Full body'] },
  { id: 'x13', name: 'Dancing / Zumba',            type: 'cardio',   met: 6.5,  muscles: ['Full body'] },
  { id: 'x14', name: 'Badminton',                  type: 'sport',    met: 5.5,  muscles: ['Full body'] },
  { id: 'x15', name: 'Cricket',                    type: 'sport',    met: 4.8,  muscles: ['Full body'] },
  { id: 'x16', name: 'Football / soccer',          type: 'sport',    met: 7.0,  muscles: ['Legs', 'Core'] },
  { id: 'x17', name: 'Basketball',                 type: 'sport',    met: 6.5,  muscles: ['Full body'] },
  { id: 'x18', name: 'Tennis (singles)',           type: 'sport',    met: 8.0,  muscles: ['Full body'] },

  // ── Strength ──
  { id: 'x20', name: 'Barbell squat',              type: 'strength', met: 6.0, muscles: ['Quads', 'Glutes', 'Core'], sets: 4, reps: '6–8' },
  { id: 'x21', name: 'Deadlift',                   type: 'strength', met: 6.0, muscles: ['Hamstrings', 'Back', 'Glutes'], sets: 4, reps: '4–6' },
  { id: 'x22', name: 'Bench press',                type: 'strength', met: 5.0, muscles: ['Chest', 'Triceps', 'Shoulders'], sets: 4, reps: '6–10' },
  { id: 'x23', name: 'Overhead press',             type: 'strength', met: 5.0, muscles: ['Shoulders', 'Triceps'], sets: 3, reps: '8–10' },
  { id: 'x24', name: 'Barbell row',                type: 'strength', met: 5.0, muscles: ['Back', 'Biceps'], sets: 4, reps: '8–10' },
  { id: 'x25', name: 'Pull-ups',                   type: 'strength', met: 8.0, muscles: ['Back', 'Biceps'], sets: 4, reps: 'AMRAP' },
  { id: 'x26', name: 'Push-ups',                   type: 'strength', met: 8.0, muscles: ['Chest', 'Triceps', 'Core'], sets: 3, reps: '12–20' },
  { id: 'x27', name: 'Lat pulldown',               type: 'strength', met: 5.0, muscles: ['Back', 'Biceps'], sets: 3, reps: '10–12' },
  { id: 'x28', name: 'Leg press',                  type: 'strength', met: 5.0, muscles: ['Quads', 'Glutes'], sets: 3, reps: '10–12' },
  { id: 'x29', name: 'Romanian deadlift',          type: 'strength', met: 5.0, muscles: ['Hamstrings', 'Glutes'], sets: 3, reps: '8–12' },
  { id: 'x30', name: 'Lunges (walking)',           type: 'strength', met: 6.0, muscles: ['Quads', 'Glutes'], sets: 3, reps: '12 / leg' },
  { id: 'x31', name: 'Dumbbell curl',              type: 'strength', met: 3.5, muscles: ['Biceps'], sets: 3, reps: '10–12' },
  { id: 'x32', name: 'Triceps pushdown',           type: 'strength', met: 3.5, muscles: ['Triceps'], sets: 3, reps: '10–15' },
  { id: 'x33', name: 'Lateral raise',              type: 'strength', met: 3.5, muscles: ['Shoulders'], sets: 3, reps: '12–15' },
  { id: 'x34', name: 'Plank',                      type: 'strength', met: 4.0, muscles: ['Core'], sets: 3, reps: '45–60 s' },
  { id: 'x35', name: 'Hanging leg raise',          type: 'strength', met: 4.5, muscles: ['Core'], sets: 3, reps: '10–15' },
  { id: 'x36', name: 'Calf raise',                 type: 'strength', met: 3.5, muscles: ['Calves'], sets: 4, reps: '15–20' },
  { id: 'x37', name: 'Hip thrust',                 type: 'strength', met: 5.0, muscles: ['Glutes'], sets: 3, reps: '10–12' },
  { id: 'x38', name: 'Burpees',                    type: 'strength', met: 8.0, muscles: ['Full body'], sets: 4, reps: '10–15' },

  // ── Mobility / low intensity ──
  { id: 'x40', name: 'Yoga (hatha)',               type: 'mobility', met: 2.5, muscles: ['Full body'] },
  { id: 'x41', name: 'Yoga (power / vinyasa)',     type: 'mobility', met: 4.0, muscles: ['Full body'] },
  { id: 'x42', name: 'Pilates',                    type: 'mobility', met: 3.0, muscles: ['Core'] },
  { id: 'x43', name: 'Stretching / cool-down',     type: 'mobility', met: 2.3, muscles: ['Full body'] },
  { id: 'x44', name: 'Household chores',           type: 'mobility', met: 3.3, muscles: ['Full body'] },
];

export const EXERCISE_TYPES = ['cardio', 'strength', 'mobility', 'sport'];

/** Kcal burned. Uses MET × 3.5 × bodyweight(kg) / 200 per minute. */
export function burnFor(exercise, minutes, weightKg) {
  return (exercise.met * 3.5 * weightKg / 200) * minutes;
}

/** Ready-made weekly splits the user can drop into their log. */
export const WORKOUT_PLANS = [
  {
    id: 'p1',
    name: 'Push / Pull / Legs',
    goalFit: ['gain', 'recomp'],
    level: 'Intermediate',
    days: 6,
    blurb: 'Highest-volume split for building muscle. Six sessions, each muscle hit twice a week.',
    schedule: [
      { day: 'Push', items: ['x22', 'x23', 'x33', 'x32'] },
      { day: 'Pull', items: ['x21', 'x24', 'x27', 'x31'] },
      { day: 'Legs', items: ['x20', 'x29', 'x30', 'x36'] },
      { day: 'Push', items: ['x26', 'x23', 'x33', 'x32'] },
      { day: 'Pull', items: ['x25', 'x24', 'x27', 'x35'] },
      { day: 'Legs', items: ['x28', 'x37', 'x30', 'x34'] },
    ],
  },
  {
    id: 'p2',
    name: 'Upper / Lower (4 day)',
    goalFit: ['gain', 'recomp', 'maintain'],
    level: 'Beginner–Intermediate',
    days: 4,
    blurb: 'The best strength-per-hour ratio for most people. Four days, plenty of recovery.',
    schedule: [
      { day: 'Upper A', items: ['x22', 'x24', 'x23', 'x31'] },
      { day: 'Lower A', items: ['x20', 'x29', 'x30', 'x36'] },
      { day: 'Upper B', items: ['x25', 'x27', 'x33', 'x32'] },
      { day: 'Lower B', items: ['x21', 'x28', 'x37', 'x34'] },
    ],
  },
  {
    id: 'p3',
    name: 'Fat-loss circuit + steps',
    goalFit: ['lose'],
    level: 'All levels',
    days: 5,
    blurb: 'Full-body resistance to hold muscle in a deficit, plus low-intensity cardio that does not wreck recovery.',
    schedule: [
      { day: 'Full body A', items: ['x20', 'x26', 'x24', 'x34'] },
      { day: 'Cardio', items: ['x2', 'x5'] },
      { day: 'Full body B', items: ['x29', 'x22', 'x27', 'x38'] },
      { day: 'Cardio', items: ['x3', 'x8'] },
      { day: 'Full body C', items: ['x28', 'x25', 'x33', 'x35'] },
    ],
  },
  {
    id: 'p4',
    name: 'Home / no equipment',
    goalFit: ['lose', 'maintain', 'recomp'],
    level: 'Beginner',
    days: 4,
    blurb: 'Bodyweight only. No gym, no excuses — scales with reps rather than load.',
    schedule: [
      { day: 'Push focus', items: ['x26', 'x34', 'x38'] },
      { day: 'Cardio', items: ['x8', 'x2'] },
      { day: 'Legs focus', items: ['x30', 'x36', 'x35'] },
      { day: 'Mobility', items: ['x41', 'x43'] },
    ],
  },
  {
    id: 'p5',
    name: 'Beginner 3-day full body',
    goalFit: ['lose', 'gain', 'maintain', 'recomp'],
    level: 'Beginner',
    days: 3,
    blurb: 'If you have never trained, start here. Three full-body days, compound lifts only.',
    schedule: [
      { day: 'Day 1', items: ['x20', 'x22', 'x24', 'x34'] },
      { day: 'Day 2', items: ['x21', 'x23', 'x27', 'x30'] },
      { day: 'Day 3', items: ['x28', 'x26', 'x31', 'x36'] },
    ],
  },
];
