import { exercises, findAlternatives, muscleLabels } from '@/domains/exercises/catalog';
import { techniqueCues } from '@/domains/exercises/technique';
import { generatePlan } from '@/domains/program/generate-plan';
import { limitations } from '@/domains/profile/profile';

const profile: Parameters<typeof generatePlan>[0] = {
  goal: 'fat_loss',
  experience: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: 'gym',
  limitations: [],
};

describe('exercise catalog', () => {
  it('has unique ids', () => {
    expect(new Set(exercises.map(({ id }) => id)).size).toBe(exercises.length);
  });

  it('gives every exercise a technique note, a place to do it and its main muscles', () => {
    for (const exercise of exercises) {
      expect([exercise.id, techniqueCues[exercise.id]?.length]).toEqual([exercise.id, expect.any(Number)]);
      expect(exercise.equipment.length).toBeGreaterThan(0);
      expect(exercise.primary.length).toBeGreaterThan(0);
    }
  });

  it('uses only known muscles and zones', () => {
    for (const exercise of exercises) {
      for (const muscle of [...exercise.primary, ...exercise.secondary]) {
        expect(Object.keys(muscleLabels)).toContain(muscle);
      }
      for (const area of exercise.loads) {
        expect(limitations).toContain(area);
      }
    }
  });

  it('covers strength, functional, cardio and mobility work', () => {
    expect(new Set(exercises.map(({ category }) => category))).toEqual(
      new Set(['strength', 'functional', 'cardio', 'mobility']),
    );
  });
});

describe('findAlternatives', () => {
  it('offers the same movement first and respects equipment and limitations', () => {
    const options = findAlternatives('bench-press', { equipment: 'gym', limitations: [], allowDemanding: true });

    expect(options[0].pattern).toBe('horizontal_push');
    expect(options.map(({ id }) => id)).not.toContain('bench-press');

    const home = findAlternatives('bench-press', { equipment: 'dumbbells', limitations: [], allowDemanding: true });
    expect(home.every(({ equipment }) => equipment.includes('dumbbells'))).toBe(true);

    const safe = findAlternatives('back-squat', { equipment: 'gym', limitations: ['knees'], allowDemanding: true });
    expect(safe.every(({ loads }) => !loads.includes('knees'))).toBe(true);
  });

  it('keeps demanding lifts away from those not ready for them', () => {
    const options = findAlternatives('machine-chest-press', { equipment: 'gym', limitations: [], allowDemanding: false });

    expect(options.length).toBeGreaterThan(0);
    expect(options.every(({ demanding }) => !demanding)).toBe(true);
  });

  it('skips excluded exercises and unknown ids', () => {
    const options = findAlternatives('bench-press', { equipment: 'gym', limitations: [], allowDemanding: true, excluded: ['push-up'] });

    expect(options.map(({ id }) => id)).not.toContain('push-up');
    expect(findAlternatives('custom', { equipment: 'gym', limitations: [], allowDemanding: true })).toEqual([]);
  });
});

describe('plans across the directions', () => {
  it('adds a warm-up and a cardio finisher when the time and goal allow', () => {
    const [day] = generatePlan(profile);

    expect(day.exercises[0]).toMatchObject({ targetSets: 1, repsMin: null, targetDurationSec: 60 });
    expect(day.exercises.at(-1)).toMatchObject({ targetSets: 1, repsMin: null, targetDurationSec: 900 });
  });

  it('keeps short sessions to strength work only', () => {
    const [day] = generatePlan({ ...profile, sessionMinutes: 30 });

    expect(day.exercises.every(({ repsMin }) => repsMin !== null)).toBe(true);
  });

  it('skips cardio for strength goals', () => {
    const [day] = generatePlan({ ...profile, goal: 'strength' });

    expect(day.exercises.at(-1)?.repsMin).not.toBeNull();
  });

  it('adds only low-threshold cardio, never running or swimming unasked', () => {
    for (const equipment of ['gym', 'dumbbells', 'bar', 'bodyweight'] as const) {
      for (let daysPerWeek = 2; daysPerWeek <= 5; daysPerWeek += 1) {
        const plan = generatePlan({ ...profile, equipment, daysPerWeek: daysPerWeek as 2 | 3 | 4 | 5 });
        const ids = plan.flatMap((day) => day.exercises.map(({ exerciseId }) => exerciseId));

        expect(ids.filter((id) => ['running', 'cycling', 'swimming', 'stair-climber', 'jump-rope'].includes(id))).toEqual([]);
      }
    }
  });

  it('leaves out exercises the user does not want', () => {
    const [first] = generatePlan(profile);
    const unwanted = first.exercises[1].exerciseId;

    const ids = generatePlan({ ...profile, excluded: [unwanted] }).flatMap((day) =>
      day.exercises.map(({ exerciseId }) => exerciseId),
    );

    expect(ids).not.toContain(unwanted);
  });

  it('never adds a finisher that loads a limited zone', () => {
    const plan = generatePlan({ ...profile, limitations: ['knees', 'ankles', 'hips'] });

    for (const day of plan) {
      for (const { exerciseId } of day.exercises) {
        const exercise = exercises.find(({ id }) => id === exerciseId);
        expect(exercise?.loads.some((area) => ['knees', 'ankles', 'hips'].includes(area))).toBe(false);
      }
    }
  });
});
