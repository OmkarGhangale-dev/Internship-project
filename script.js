/* =========================================================
   ATHLEX — AI Workout Generator
   Vanilla JavaScript (ES6+)

   Sections:
   1. DOM references
   2. Exercise database ("the AI's knowledge")
   3. Workout generation engine (supports multiple muscle groups)
   4. Form state + pill selection (multi-select for muscle group)
   5. Rendering the results
   6. Replace-exercise logic
   7. Chat assistant (rule + pattern matching engine)
   8. Misc UI (mobile nav, smooth scroll)

   NOTE ON "AI":
   This app ships with a self-contained, rule-based generator
   (see section 3) so it works instantly with zero setup and
   no API key. It is written so a real LLM call is a drop-in
   replacement — see the commented `callOpenAI()` function at
   the bottom of section 3 for exactly where that swap goes.
   ========================================================= */


/* ============ 1. DOM REFERENCES ============ */
const workoutForm     = document.getElementById('workoutForm');
const formError       = document.getElementById('formError');
const generateBtn     = document.getElementById('generateBtn');
const heroGenerateBtn = document.getElementById('heroGenerateBtn');
const regenerateBtn   = document.getElementById('regenerateBtn');

const resultsSection  = document.getElementById('results');
const workoutTitleEl  = document.getElementById('workoutTitle');
const warmupList      = document.getElementById('warmupList');
const cooldownList    = document.getElementById('cooldownList');
const tipsList        = document.getElementById('tipsList');
const exerciseGrid    = document.getElementById('exerciseGrid');
const cardTemplate    = document.getElementById('exerciseCardTemplate');

const chatForm  = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatLog   = document.getElementById('chatLog');

const navToggle = document.getElementById('navToggle');
const mainNav   = document.getElementById('mainNav');

const MAX_MUSCLE_GROUPS = 3;


/* ============ 2. EXERCISE DATABASE ============
   Each exercise lists which equipment setups it works with and
   which joints/areas it stresses, so we can filter it out when
   the user reports an injury there.

   equipment values used: "Gym", "Home", "Dumbbells", "Bodyweight"
   stress values used:    "knee", "shoulder", "lowerback", "wrist" */
const EXERCISE_DB = {
  Chest: [
    { name: 'Barbell Bench Press',        equipment: ['Gym'],                          stress: ['shoulder', 'wrist'] },
    { name: 'Dumbbell Bench Press',       equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Incline Dumbbell Press',     equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Push-Up',                    equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: ['wrist'] },
    { name: 'Cable Crossover',            equipment: ['Gym'],                          stress: ['shoulder'] },
    { name: 'Chest Dip',                  equipment: ['Gym', 'Bodyweight'],             stress: ['shoulder'] },
    { name: 'Dumbbell Fly',               equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
  ],
  Back: [
    { name: 'Pull-Up',                    equipment: ['Gym', 'Bodyweight'],             stress: ['shoulder'] },
    { name: 'Lat Pulldown',               equipment: ['Gym'],                           stress: [] },
    { name: 'Bent-Over Barbell Row',      equipment: ['Gym'],                           stress: ['lowerback'] },
    { name: 'Single-Arm Dumbbell Row',    equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['lowerback'] },
    { name: 'Seated Cable Row',           equipment: ['Gym'],                           stress: ['lowerback'] },
    { name: 'Superman Hold',              equipment: ['Gym', 'Home', 'Bodyweight'],     stress: [] },
    { name: 'Inverted Row',               equipment: ['Gym', 'Home', 'Bodyweight'],     stress: [] },
  ],
  Legs: [
    { name: 'Barbell Back Squat',         equipment: ['Gym'],                           stress: ['knee', 'lowerback'] },
    { name: 'Goblet Squat',               equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['knee'] },
    { name: 'Bodyweight Squat',           equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: ['knee'] },
    { name: 'Walking Lunge',              equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: ['knee'] },
    { name: 'Romanian Deadlift',          equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['lowerback'] },
    { name: 'Leg Press',                  equipment: ['Gym'],                           stress: ['knee'] },
    { name: 'Glute Bridge',               equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: [] },
    { name: 'Calf Raise',                 equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: [] },
  ],
  Shoulders: [
    { name: 'Standing Barbell Press',     equipment: ['Gym'],                           stress: ['shoulder', 'lowerback'] },
    { name: 'Dumbbell Shoulder Press',    equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Lateral Raise',              equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Front Raise',                equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Pike Push-Up',               equipment: ['Gym', 'Home', 'Bodyweight'],     stress: ['shoulder', 'wrist'] },
    { name: 'Face Pull',                  equipment: ['Gym'],                           stress: ['shoulder'] },
  ],
  Biceps: [
    { name: 'Barbell Curl',               equipment: ['Gym'],                           stress: ['wrist'] },
    { name: 'Dumbbell Curl',              equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['wrist'] },
    { name: 'Hammer Curl',                equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['wrist'] },
    { name: 'Concentration Curl',         equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['wrist'] },
    { name: 'Chin-Up',                    equipment: ['Gym', 'Bodyweight'],             stress: ['shoulder'] },
  ],
  Triceps: [
    { name: 'Close-Grip Bench Press',     equipment: ['Gym'],                           stress: ['wrist', 'shoulder'] },
    { name: 'Triceps Dip',                equipment: ['Gym', 'Bodyweight'],             stress: ['shoulder'] },
    { name: 'Overhead Dumbbell Extension',equipment: ['Gym', 'Home', 'Dumbbells'],      stress: ['shoulder'] },
    { name: 'Cable Pushdown',             equipment: ['Gym'],                           stress: ['wrist'] },
    { name: 'Diamond Push-Up',            equipment: ['Gym', 'Home', 'Dumbbells', 'Bodyweight'], stress: ['wrist'] },
  ],
};

// Full Body pulls a light spread from every group above.
EXERCISE_DB['Full Body'] = [
  ...EXERCISE_DB.Legs.slice(0, 2),
  ...EXERCISE_DB.Chest.slice(0, 2),
  ...EXERCISE_DB.Back.slice(0, 2),
  ...EXERCISE_DB.Shoulders.slice(0, 1),
  ...EXERCISE_DB.Biceps.slice(0, 1),
  ...EXERCISE_DB.Triceps.slice(0, 1),
];

// Flat lookup of every real exercise (skip "Full Body" to avoid duplicates)
// used by the chat assistant to recognize specific exercise names.
const ALL_EXERCISES = Object.entries(EXERCISE_DB)
  .filter(([group]) => group !== 'Full Body')
  .flatMap(([group, list]) => list.map((ex) => ({ ...ex, group })));

const WARMUP_MOVES = [
  '5 minutes light cardio (bike, row, or jog) to raise core temperature',
  'Arm circles — 15 each direction',
  'Bodyweight squats — 15 reps',
  'Band pull-aparts or shoulder rolls — 15 reps',
  'Hip circles and leg swings — 10 each side',
  'Cat-cow stretch — 8 slow reps',
];

const COOLDOWN_MOVES = [
  'Standing quad stretch — 30s each side',
  'Chest doorway stretch — 30s',
  "Child's pose — 45s",
  'Seated hamstring stretch — 30s each side',
  'Deep breathing, 5 slow breaths to bring heart rate down',
];

const GENERAL_TIPS = [
  'Stop a set 1-2 reps before your form breaks down.',
  'Log your weights each session so you can track progressive overload.',
  'Sip water between sets — aim to finish a bottle over the session.',
  'Prioritize sleep; most recovery happens overnight, not in the gym.',
];


/* ============ 3. WORKOUT GENERATION ENGINE ============ */

/**
 * Maps a training Goal + Experience level to sets/reps/rest.
 * This is the "programming logic" a coach would apply.
 */
function getPrescription(goal, experience) {
  const base = {
    'Muscle Gain': { sets: 4, reps: '8-12',  rest: 75 },
    'Fat Loss':    { sets: 3, reps: '15-20', rest: 35 },
    'Strength':    { sets: 5, reps: '3-6',   rest: 150 },
    'Endurance':   { sets: 3, reps: '18-25', rest: 30 },
  }[goal];

  // Beginners get one fewer set so they can focus on learning form.
  const experienceAdjust = { Beginner: -1, Intermediate: 0, Advanced: 1 };
  const adjustedSets = Math.max(2, base.sets + experienceAdjust[experience]);

  return { sets: adjustedSets, reps: base.reps, restSeconds: base.rest };
}

/** How many total exercises fit in the session, based on duration + experience. */
function getExerciseCount(duration, experience) {
  const byDuration = { '30': 4, '45': 5, '60': 6, '90': 8 };
  let count = byDuration[duration] || 5;
  if (experience === 'Advanced') count += 1;
  if (experience === 'Beginner') count = Math.max(3, count - 1);
  return count;
}

/** Turns free-text injuries into a list of "stress" tags to avoid. */
function parseInjuryTags(injuriesText) {
  const text = (injuriesText || '').toLowerCase();
  const tags = [];
  if (text.includes('knee')) tags.push('knee');
  if (text.includes('shoulder')) tags.push('shoulder');
  if (text.includes('back')) tags.push('lowerback');
  if (text.includes('wrist')) tags.push('wrist');
  return tags;
}

/** Filters the exercise pool for one muscle group by equipment access and injury tags. */
function getAvailableExercises(muscleGroup, equipment, avoidTags) {
  const pool = EXERCISE_DB[muscleGroup] || [];
  return pool.filter((ex) => {
    const equipmentOk = ex.equipment.includes(equipment);
    const injuryOk = !ex.stress.some((tag) => avoidTags.includes(tag));
    return equipmentOk && injuryOk;
  });
}

/** Picks `count` random, non-repeating exercises from a pool. */
function pickRandomExercises(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function pickRandomItems(list, count) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

function formatRest(seconds) {
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`;
}

/** Small, deterministic "coaching cue" generator per exercise + goal. */
function buildExerciseTip(name, goal) {
  const goalCue = {
    'Muscle Gain': 'control the lowering phase for 2-3 seconds to maximize muscle tension.',
    'Fat Loss': 'keep rest short and move with purpose to keep your heart rate up.',
    'Strength': 'brace your core and move the weight with maximal intent on every rep.',
    'Endurance': 'focus on smooth, consistent pacing rather than speed.',
  }[goal];
  return `On ${name}, ${goalCue}`;
}

/**
 * Splits the total exercise count evenly across the selected muscle
 * groups. Any remainder (e.g. 7 exercises / 2 groups) is handed out
 * one-by-one starting from the first selected group, so the split
 * stays as even as possible: [4, 3] rather than [7, 0].
 */
function splitCountAcrossGroups(totalCount, groupCount) {
  const base = Math.floor(totalCount / groupCount);
  let remainder = totalCount % groupCount;
  const counts = [];
  for (let i = 0; i < groupCount; i++) {
    counts.push(base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return counts;
}

/**
 * Builds a full workout object from validated form data.
 * This is the core "AI" function. It's synchronous and local —
 * generateWorkoutAsync() below wraps it with a simulated delay
 * so the UI can show a loading state, matching how a real API
 * call would behave.
 *
 * formData.muscleGroups is an ARRAY (1-3 groups), which lets users
 * train combos like "Chest & Shoulders" or "Back & Biceps" in one
 * session — exercises are split evenly across the chosen groups.
 */
function buildWorkout(formData) {
  const { muscleGroups, goal, experience, equipment, duration, injuries } = formData;

  const avoidTags = parseInjuryTags(injuries);
  const prescription = getPrescription(goal, experience);

  // Make sure we always have at least 2 exercises per selected group,
  // even for a short 30-minute session covering multiple groups.
  const baseTotal = getExerciseCount(duration, experience);
  const totalExerciseCount = Math.max(baseTotal, muscleGroups.length * 2);

  const perGroupCounts = splitCountAcrossGroups(totalExerciseCount, muscleGroups.length);

  let injuryFallback = false;
  const allChosen = [];

  muscleGroups.forEach((group, i) => {
    let pool = getAvailableExercises(group, equipment, avoidTags);
    const wanted = perGroupCounts[i];

    // Safety net: if injury filtering leaves too few exercises for
    // this group, fall back to ignoring the filter rather than
    // shorting the workout, but flag it clearly to the user.
    if (pool.length < Math.min(2, wanted)) {
      pool = getAvailableExercises(group, equipment, []);
      injuryFallback = true;
    }

    const chosen = pickRandomExercises(pool, Math.min(wanted, pool.length));
    chosen.forEach((ex) => allChosen.push({ ...ex, group }));
  });

  const exercises = allChosen.map((ex) => ({
    name: ex.name,
    sets: prescription.sets,
    reps: prescription.reps,
    rest: formatRest(prescription.restSeconds),
    tip: buildExerciseTip(ex.name, goal),
    group: ex.group,
  }));

  const tips = [...GENERAL_TIPS];
  if (injuryFallback && injuries && injuries.trim()) {
    tips.unshift(
      `We couldn't fully avoid every movement related to "${injuries.trim()}" across all your ` +
      `selected muscle groups with this equipment — go lighter and stop any exercise that causes pain.`
    );
  } else if (avoidTags.length && injuries && injuries.trim()) {
    tips.unshift(`Exercises that load your reported area (${injuries.trim()}) were filtered out.`);
  }

  return {
    title: `${muscleGroups.join(' & ')} — ${goal}`,
    subtitle: `${experience} · ${equipment} · ${duration} min`,
    warmup: pickRandomItems(WARMUP_MOVES, 4),
    cooldown: pickRandomItems(COOLDOWN_MOVES, 3),
    exercises,
    tips: pickRandomItems(tips, Math.min(4, tips.length)),
  };
}

/**
 * Wraps buildWorkout() in a Promise with an artificial delay so the
 * rest of the app can treat it exactly like an async API call.
 * ---------------------------------------------------------------
 * TO CONNECT A REAL LLM (e.g. OpenAI) INSTEAD:
 * Replace the body of this function with a call to callOpenAI()
 * (defined further down, currently commented out) and make sure
 * it resolves with an object shaped like buildWorkout()'s return
 * value so renderWorkout() doesn't need to change at all.
 */
function generateWorkoutAsync(formData) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(buildWorkout(formData)), 900);
  });
}

/* ---------------------------------------------------------------
   REAL AI INTEGRATION (OPTIONAL — commented out)
   Uncomment and add your own API key handling to use a real LLM
   instead of the local generator above. Never put a real API key
   directly in client-side JS for a deployed app — route this
   through your own backend so the key isn't exposed publicly.

async function callOpenAI(formData) {
  const prompt = `Create a ${formData.duration}-minute workout targeting
${formData.muscleGroups.join(' and ')} for a ${formData.experience} lifter training for
${formData.goal}, using ${formData.equipment} equipment.
Avoid movements that aggravate: ${formData.injuries || 'none'}.
Return ONLY valid JSON with this shape:
{
  "title": string,
  "warmup": string[],
  "exercises": [{ "name": string, "sets": number, "reps": string, "rest": string, "tip": string, "group": string }],
  "cooldown": string[],
  "tips": string[]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
--------------------------------------------------------------- */


/* ============ 4. FORM STATE + PILL SELECTION ============ */

// Holds the user's current choices. muscleGroup is an ARRAY because
// users can train more than one group in a session (e.g. Chest + Shoulders).
const formState = {
  muscleGroup: [],
  goal: null,
  experience: null,
  equipment: null,
  duration: null,
  injuries: '',
};

// Wire up every pill-group. Groups marked data-multi="true" (currently
// just Muscle Group) toggle multiple selections; everything else stays
// single-select.
document.querySelectorAll('.pill-group').forEach((group) => {
  const groupName = group.dataset.group;
  const isMulti = group.dataset.multi === 'true';

  group.addEventListener('click', (event) => {
    const clicked = event.target.closest('.pill');
    if (!clicked) return;

    if (isMulti) {
      const alreadyActive = clicked.classList.contains('active');
      const activeCount = group.querySelectorAll('.pill.active').length;

      if (!alreadyActive && activeCount >= MAX_MUSCLE_GROUPS) {
        formError.textContent = `You can select up to ${MAX_MUSCLE_GROUPS} muscle groups.`;
        return;
      }

      clicked.classList.toggle('active');
      formState[groupName] = [...group.querySelectorAll('.pill.active')].map((p) => p.dataset.value);
    } else {
      group.querySelectorAll('.pill').forEach((pill) => pill.classList.remove('active'));
      clicked.classList.add('active');
      formState[groupName] = clicked.dataset.value;
    }

    formError.textContent = '';
  });
});

/** Returns an array of human-readable labels for any missing required field. */
function validateFormState() {
  const missing = [];
  if (!formState.muscleGroup.length) missing.push('Muscle Group');
  if (!formState.goal) missing.push('Goal');
  if (!formState.experience) missing.push('Experience Level');
  if (!formState.equipment) missing.push('Equipment');
  if (!formState.duration) missing.push('Duration');
  return missing;
}

/** Toggles the Generate button between idle and loading visuals. */
function setGeneratingState(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.querySelector('.btn-label').hidden = isLoading;
  generateBtn.querySelector('.btn-spinner').hidden = !isLoading;
}

workoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  formState.injuries = document.getElementById('injuries').value;
  const missing = validateFormState();

  if (missing.length) {
    formError.textContent = `Please select: ${missing.join(', ')}.`;
    return;
  }

  formError.textContent = '';
  setGeneratingState(true);

  try {
    const workout = await generateWorkoutAsync({
      muscleGroups: [...formState.muscleGroup],
      goal: formState.goal,
      experience: formState.experience,
      equipment: formState.equipment,
      duration: formState.duration,
      injuries: formState.injuries,
    });
    renderWorkout(workout);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    // Graceful error handling — never let a failed "API call" break the page.
    formError.textContent = 'Something went wrong generating your workout. Please try again.';
    console.error('Workout generation failed:', err);
  } finally {
    setGeneratingState(false);
  }
});

regenerateBtn.addEventListener('click', () => {
  workoutForm.requestSubmit();
});

heroGenerateBtn.addEventListener('click', () => {
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
});


/* ============ 5. RENDERING THE RESULTS ============ */

// Keep the last generated workout in memory so "Replace Exercise"
// can know which exercises are already in use (to avoid duplicates).
let currentWorkout = null;

function renderWorkout(workout) {
  currentWorkout = workout;

  workoutTitleEl.textContent = workout.title;

  fillList(warmupList, workout.warmup);
  fillList(cooldownList, workout.cooldown);
  fillList(tipsList, workout.tips);

  exerciseGrid.innerHTML = '';
  workout.exercises.forEach((exercise) => {
    exerciseGrid.appendChild(buildExerciseCard(exercise));
  });
}

function fillList(listEl, items) {
  listEl.innerHTML = '';
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    listEl.appendChild(li);
  });
}

/** Clones the <template> in the HTML and fills it with exercise data. */
function buildExerciseCard(exercise) {
  const fragment = cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.exercise-card');

  card.dataset.name = exercise.name;
  card.dataset.group = exercise.group;
  card.querySelector('.exercise-name').textContent = exercise.name;
  card.querySelector('.stat-sets').textContent = exercise.sets;
  card.querySelector('.stat-reps').textContent = exercise.reps;
  card.querySelector('.stat-rest').textContent = exercise.rest;
  card.querySelector('.exercise-tip').textContent = exercise.tip.replace(/^On [^,]+,\s*/, '');

  card.querySelector('.btn-replace').addEventListener('click', () => handleReplaceExercise(card));

  return card;
}


/* ============ 6. REPLACE EXERCISE ============ */

function handleReplaceExercise(cardEl) {
  if (!currentWorkout) return;

  // Each card remembers which muscle group it came from, which matters
  // now that a workout can span up to 3 different groups at once.
  const group = cardEl.dataset.group;
  const avoidTags = parseInjuryTags(formState.injuries);
  const pool = getAvailableExercises(group, formState.equipment, avoidTags);

  // Exclude exercises already showing anywhere in the current workout so
  // we don't "replace" one exercise with a duplicate of another card.
  const namesInUse = currentWorkout.exercises.map((ex) => ex.name);
  const candidates = pool.filter((ex) => !namesInUse.includes(ex.name));

  if (!candidates.length) {
    cardEl.querySelector('.exercise-tip').textContent =
      'No alternative available for your current equipment/injury filters.';
    return;
  }

  const replacement = pickRandomExercises(candidates, 1)[0];
  const prescription = getPrescription(formState.goal, formState.experience);

  const newExerciseData = {
    name: replacement.name,
    sets: prescription.sets,
    reps: prescription.reps,
    rest: formatRest(prescription.restSeconds),
    tip: buildExerciseTip(replacement.name, formState.goal),
    group,
  };

  // Update currentWorkout so future replacements/duplicates stay accurate.
  const index = currentWorkout.exercises.findIndex((ex) => ex.name === cardEl.dataset.name);
  if (index !== -1) currentWorkout.exercises[index] = newExerciseData;

  cardEl.dataset.name = newExerciseData.name;
  cardEl.querySelector('.exercise-name').textContent = newExerciseData.name;
  cardEl.querySelector('.stat-sets').textContent = newExerciseData.sets;
  cardEl.querySelector('.stat-reps').textContent = newExerciseData.reps;
  cardEl.querySelector('.stat-rest').textContent = newExerciseData.rest;
  cardEl.querySelector('.exercise-tip').textContent =
    newExerciseData.tip.replace(/^On [^,]+,\s*/, '');

  // Retrigger the fade-in animation.
  cardEl.classList.remove('swapping');
  void cardEl.offsetWidth; // force reflow so the animation restarts
  cardEl.classList.add('swapping');
}


/* ============ 7. CHAT ASSISTANT ============
   A rule + pattern matching responder, upgraded to be far more
   specific than a single keyword-per-topic lookup:

   1. Exercise-swap pattern ("replace/swap/alternative to X") is
      checked FIRST and matched against the real exercise database,
      so it names an actual alternative instead of a generic answer.
   2. "Best exercise for X" pattern is checked next and answers
      from the database too.
   3. Every remaining topic is SCORED (not just first-match) across
      many phrasings per topic, so slightly different wording still
      lands on the right, specific answer.
   4. Only if nothing scores above 0 do we fall back to a general
      reply — and that fallback now points the user toward topics
      the assistant DOES know well, instead of a vague answer. */

/**
 * Finds the closest exercise in the database to a free-text query by
 * counting how many significant words (4+ letters) from the query
 * appear in each exercise's name. This lets "bench" match "Dumbbell
 * Bench Press", "squats" match "Barbell Back Squat", etc.
 */
function findExerciseByName(query) {
  const words = query.toLowerCase().replace(/[?.!]/g, '').split(/\s+/).filter((w) => w.length >= 4);
  if (!words.length) return null;

  let best = null;
  let bestScore = 0;
  ALL_EXERCISES.forEach((ex) => {
    const nameLower = ex.name.toLowerCase();
    const score = words.filter((w) => nameLower.includes(w) || w.includes(nameLower.split(' ')[0])).length;
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  });
  return bestScore > 0 ? best : null;
}

/** Handles "replace/swap/alternative to/substitute for <exercise>" questions specifically. */
function tryExerciseReplacementReply(text) {
  const match = text.match(/(?:replace|swap|alternative to|substitute for)\s+(.+)/i);
  if (!match) return null;

  const found = findExerciseByName(match[1]);
  if (!found) return null;

  const equipment = formState.equipment || 'Gym';
  const avoidTags = parseInjuryTags(formState.injuries);
  const pool = getAvailableExercises(found.group, equipment, avoidTags).filter((ex) => ex.name !== found.name);

  if (!pool.length) {
    return `${found.name} doesn't have a close equipment-matched substitute in your current ` +
      `setup, but any compound ${found.group.toLowerCase()} movement can work as a fallback.`;
  }

  const alt = pickRandomExercises(pool, 1)[0];
  return `Yes — a solid alternative to ${found.name} is ${alt.name}. It trains the same ` +
    `${found.group.toLowerCase()} muscles and fits ${equipment.toLowerCase()} equipment. ` +
    `You can also hit the "Replace Exercise" button on that card to swap it automatically.`;
}

/** Handles "best exercise/move for <muscle>" questions using the real database. */
function tryBestExerciseReply(text) {
  const match = text.match(/best\s+(?:exercise|move|workout)s?\s+for\s+([a-z\s]+)/i);
  if (!match) return null;

  const muscleWord = match[1].trim().toLowerCase().replace(/[?.!]/g, '');
  const groupKey = Object.keys(EXERCISE_DB).find(
    (g) => g.toLowerCase().includes(muscleWord) || muscleWord.includes(g.toLowerCase())
  );
  if (!groupKey || groupKey === 'Full Body') return null;

  const top = EXERCISE_DB[groupKey][0];
  const second = EXERCISE_DB[groupKey][1];
  return `For ${groupKey.toLowerCase()}, ${top.name} is a great anchor movement since it's a ` +
    `compound lift you can progressively overload. ${second.name} pairs well with it for volume.`;
}

// Topic library: each topic lists several PHRASINGS so more of your
// wording gets recognized. Reply is picked by the topic with the most
// matched phrasings, not just the first one that happens to hit.
const CHAT_TOPICS = [
  {
    keywords: ['how much protein', 'protein should i eat', 'protein intake', 'protein per day'],
    reply: 'A common target is roughly 1.6-2.2g of protein per kg of bodyweight per day when ' +
      'training for muscle gain or strength (lower end, ~1.2-1.6g/kg, is fine for general health). ' +
      'Spread it across 3-4 meals for best results. This is general guidance, not personalized medical advice.',
  },
  {
    keywords: ['enough volume', 'too much volume', 'how many sets', 'sets per week', 'training volume'],
    reply: 'A common guideline is roughly 10-20 working sets per muscle group per week for growth, ' +
      'split across 2+ sessions. Beginners can grow on the lower end of that range; more advanced ' +
      'lifters often need the higher end to keep progressing.',
  },
  {
    keywords: ['sore', 'doms', 'muscle pain after workout'],
    reply: "Mild soreness (DOMS) 1-2 days after training is normal, especially with new exercises. " +
      "Sharp, sudden, or joint pain is different — stop that movement and consider rest or a " +
      "professional opinion if it persists more than a few days.",
  },
  {
    keywords: ['rest day', 'how often should i train', 'how many days a week', 'training frequency'],
    reply: 'Most people do well training each muscle group about 2x per week with at least one full ' +
      'rest day. Beginners can often recover with 3 full-body sessions per week; advanced lifters ' +
      'sometimes need more planned rest, not less.',
  },
  {
    keywords: ['cardio', 'running for fat loss', 'hiit vs steady state'],
    reply: 'For general health, ~150 minutes of moderate cardio per week is a solid baseline. If fat ' +
      'loss is the goal, a calorie deficit matters more than cardio type — HIIT saves time, steady-state ' +
      'is easier to recover from, so pick what you will actually stick to.',
  },
  {
    keywords: ['warm up', 'warmup', 'how to warm up'],
    reply: "A good warm-up raises heart rate and rehearses the movement you're about to train: " +
      "5 minutes of light cardio, then 1-2 light warm-up sets of your first exercise before your " +
      "working sets. That's exactly what the Warm-up section of your generated workout is built from.",
  },
  {
    keywords: ['cool down', 'cooldown', 'stretch after workout', 'stretching after'],
    reply: 'A short cool-down (2-5 minutes of static stretching on the muscles you trained, plus slow ' +
      'breathing) helps bring your heart rate down and is a good habit for long-term mobility.',
  },
  {
    keywords: ['stretch before', 'static stretching before workout'],
    reply: 'Save static (held) stretching for after your workout. Before training, dynamic movement — ' +
      'arm circles, leg swings, bodyweight squats — warms the muscle without temporarily reducing its ' +
      'power output, which static stretching can do right before lifting.',
  },
  {
    keywords: ['creatine'],
    reply: 'Creatine monohydrate is one of the most researched supplements — a typical dose is 3-5g ' +
      'daily, taken any time of day consistently (no need to "load" it). It mainly helps with strength ' +
      'and power output over time, not immediate performance in a single session.',
  },
  {
    keywords: ['deload', 'plateau', 'stuck progress', 'not progressing'],
    reply: 'If your lifts have stalled for 2-3+ weeks despite consistent effort, a deload week (roughly ' +
      'half your usual volume or intensity) often helps you come back stronger. Also double check sleep, ' +
      'protein intake, and whether you are actually adding weight/reps over time (progressive overload).',
  },
  {
    keywords: ['progressive overload'],
    reply: 'Progressive overload means gradually increasing the demand on a muscle over time — more ' +
      'weight, more reps, more sets, or better form/range of motion. Without it, the same workout ' +
      'repeated forever stops producing new results.',
  },
  {
    keywords: ['calorie deficit', 'lose weight', 'fat loss diet', 'cutting'],
    reply: 'Fat loss ultimately comes from a sustained calorie deficit — eating somewhat less than you ' +
      'burn. A moderate deficit (about 300-500 calories/day below maintenance) is easier to sustain and ' +
      'preserves more muscle than an extreme cut, especially if you keep protein and training up.',
  },
  {
    keywords: ['bulking', 'build muscle diet', 'calorie surplus', 'gain weight'],
    reply: 'To build muscle efficiently, eat in a slight calorie surplus (roughly 200-400 calories above ' +
      'maintenance), keep protein around 1.6-2.2g/kg bodyweight, and make sure your training progressively ' +
      'overloads the muscles you want to grow.',
  },
  {
    keywords: ['best time to workout', 'morning or evening workout'],
    reply: "The best time to train is whichever one you'll consistently stick to — research shows " +
      "small performance differences by time of day, but consistency over weeks and months matters far more.",
  },
  {
    keywords: ['reps to failure', 'train to failure', 'failure training'],
    reply: 'Training to failure (the point you physically cannot complete another rep) can be effective ' +
      "but is very fatiguing. Most sets are better stopped 1-2 reps short of failure (called RIR — reps " +
      "in reserve), saving true failure for your last set of an exercise occasionally.",
  },
  {
    keywords: ['superset', 'drop set'],
    reply: 'Supersets (two exercises back-to-back with no rest) and drop sets (reducing weight and ' +
      'continuing past normal failure) are both intensity techniques that add volume in less time — ' +
      'useful for advanced lifters, but not necessary for beginners still building a base.',
  },
  {
    keywords: ['compound vs isolation', 'compound exercise', 'isolation exercise'],
    reply: 'Compound exercises (squat, bench, row, deadlift) move multiple joints and build the most ' +
      'overall strength/size per set — build your workout around these. Isolation exercises (curls, ' +
      'lateral raises) target one muscle and are great for finishing off a specific area.',
  },
  {
    keywords: ['tempo', 'rep speed', 'how slow should i lift'],
    reply: 'A common tempo is about 2-3 seconds lowering the weight (the eccentric), a brief pause, then ' +
      'a controlled lift up. Slowing the lowering phase down increases time under tension, which can help ' +
      'muscle growth without needing more weight.',
  },
  {
    keywords: ['overtraining', 'signs of overtraining', 'too much training'],
    reply: 'Warning signs of overtraining include persistent fatigue, declining performance despite rest, ' +
      'poor sleep, irritability, and a higher resting heart rate. If several of these stack up, back off ' +
      'volume or take a deload week rather than pushing through.',
  },
  {
    keywords: ['knee pain squat', 'squats hurt my knee', 'knee hurts'],
    reply: "If squats bother your knees, try goblet squats or leg press with a controlled range of " +
      "motion, keep your knees tracking over your toes, and make sure you're warming up the knees " +
      "properly first. Sharp or worsening pain is worth getting checked by a professional.",
  },
  {
    keywords: ['shoulder pain bench', 'shoulder hurts', 'shoulder pain pressing'],
    reply: 'Shoulder pain during pressing is often improved by a slightly narrower grip, tucking your ' +
      'elbows closer to your body (~45°) instead of flared out, and adding face pulls for rear-delt/rotator ' +
      'cuff health. Persistent pain should be checked by a professional.',
  },
  {
    keywords: ['lower back hurts', 'lower back pain deadlift', 'back pain squat'],
    reply: 'Lower back strain in squats/deadlifts is often a bracing or range-of-motion issue — brace your ' +
      'core hard before each rep, avoid rounding your lower back, and consider reducing load or range ' +
      '(e.g. Romanian deadlift) while you rebuild. See a professional if pain persists.',
  },
  {
    keywords: ['wrist hurts', 'wrist pain push up', 'wrist pain bench'],
    reply: 'Wrist discomfort in pressing movements is often a wrist-position issue — keep the bar/dumbbell ' +
      'stacked directly over your wrist rather than letting it bend back, or try push-up handles/dumbbells ' +
      'to keep a neutral wrist angle.',
  },
  {
    keywords: ['spot reduction', 'lose belly fat only', 'target fat loss'],
    reply: "You can't spot-reduce fat from one area by training it directly (e.g. ab exercises won't " +
      'specifically burn belly fat). Fat loss happens across the whole body based on overall calorie ' +
      'balance — ab training builds the muscle underneath, which shows once overall body fat drops.',
  },
  {
    keywords: ['sleep', 'how much sleep'],
    reply: 'Aim for 7-9 hours most nights. Sleep is when most muscle repair and hormonal recovery happens — ' +
      'skimping on it can blunt strength gains and recovery even if your training and diet are dialed in.',
  },
  {
    keywords: ['pre workout', 'before workout meal', 'what to eat before training'],
    reply: 'A meal with carbs and some protein 1-3 hours before training (e.g. rice and chicken, oats and ' +
      'yogurt) works well for most people. If training very soon after eating, keep it lighter and lower fat ' +
      'so it does not sit heavy.',
  },
  {
    keywords: ['post workout meal', 'after workout meal', 'what to eat after training'],
    reply: 'Protein and carbs within a few hours of training (the "anabolic window" is wider than people ' +
      'think — it is not a tiny 30-minute cutoff) support recovery. Total daily protein/calories matter ' +
      'more than the exact timing.',
  },
  {
    keywords: ['vegan protein', 'plant based protein', 'protein without meat'],
    reply: 'Good plant protein sources include lentils, chickpeas, tofu, tempeh, edamame, seitan, and pea ' +
      'or soy protein powder. Combining a few sources across the day easily covers all essential amino acids.',
  },
  {
    keywords: ['home vs gym', 'is home workout effective', 'bodyweight only progress'],
    reply: 'Home and bodyweight training can absolutely build muscle and strength, especially for beginners ' +
      '— progression (harder variations, more reps, added pauses, or resistance bands/dumbbells) matters ' +
      'more than the specific location.',
  },
  {
    keywords: ['how long to see results', 'when will i see results', 'how long to gain muscle'],
    reply: 'Strength gains often show up within 2-4 weeks (mostly nervous-system adaptation at first). ' +
      'Visible muscle growth typically takes 6-12 weeks of consistent training and eating, and noticeable ' +
      'fat loss depends on your calorie deficit — usually a visible difference by 4-8 weeks.',
  },
];

const FALLBACK_REPLIES = [
  "I don't have a specific answer for that yet. Try asking about protein, training volume, rest " +
    'days, a specific exercise swap (e.g. "replace bench press"), or an injury area like knee or ' +
    'shoulder pain — those I can answer in detail.',
  'Could you be a bit more specific? For example: "how much protein should I eat", "replace squats", ' +
    'or "is 12 sets a week enough for chest" all get detailed answers from me.',
];

/** Scores every topic by counting how many of its phrasings appear in the text, highest wins. */
function scoreTopics(text) {
  return CHAT_TOPICS
    .map((topic) => ({
      topic,
      score: topic.keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function getBotReply(userText) {
  const text = userText.toLowerCase().trim();

  // 1. Specific exercise-swap questions get a real database answer.
  const swapReply = tryExerciseReplacementReply(text);
  if (swapReply) return swapReply;

  // 2. "Best exercise for X" questions get a real database answer.
  const bestReply = tryBestExerciseReply(text);
  if (bestReply) return bestReply;

  // 3. Everything else is matched against the scored topic library.
  const scored = scoreTopics(text);
  if (scored.length) return scored[0].topic.reply;

  // 4. Nothing matched — give a helpful fallback, not a random one.
  return FALLBACK_REPLIES[0];
}

function appendChatBubble(text, sender) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function appendTypingIndicator() {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble bot typing';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  appendChatBubble(text, 'user');
  chatInput.value = '';

  const typingBubble = appendTypingIndicator();

  // Simulated "thinking" delay to mirror a real network request.
  await new Promise((resolve) => setTimeout(resolve, 600));

  const reply = getBotReply(text);
  typingBubble.remove();
  appendChatBubble(reply, 'bot');
});


/* ============ 8. MISC UI ============ */

// Mobile hamburger menu toggle.
navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

// Close the mobile menu after a nav link is tapped.
mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

console.log('Athlex app loaded ✅');