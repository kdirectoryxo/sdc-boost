/**
 * Client-side age filtering for People lists.
 * API `age` is pipe-separated (person 1 | person 2), aligned with gender1 / gender2.
 */
export type AgeFilterMode = 'any' | 'female' | 'male';

const SDC_GENDER_FEMALE = 1;
const SDC_GENDER_MALE = 0;

function parseAgeSlots(
  ageStr: string | undefined,
  gender1: number,
  gender2: number,
): { age: number; gender: number }[] {
  if (!ageStr) return [];
  const parts = ageStr.split('|');
  const slots: { age: number; gender: number }[] = [];
  const p0 = parts[0]?.trim();
  if (p0) {
    const a = parseInt(p0, 10);
    if (!isNaN(a) && a >= 18 && a <= 100) {
      slots.push({ age: a, gender: gender1 });
    }
  }
  if (parts.length > 1) {
    const p1 = parts[1]?.trim();
    if (p1) {
      const a = parseInt(p1, 10);
      if (!isNaN(a) && a >= 18 && a <= 100) {
        slots.push({ age: a, gender: gender2 });
      }
    }
  }
  return slots;
}

/**
 * Ages to evaluate against min/max for the selected mode.
 * Empty array means: no applicable age (e.g. female-only mode but profile has no woman).
 */
export function getAgesForClientAgeFilter(
  ageStr: string | undefined,
  gender1: number,
  gender2: number,
  mode: AgeFilterMode,
): number[] {
  const slots = parseAgeSlots(ageStr, gender1, gender2);
  if (slots.length === 0) return [];

  if (mode === 'any') {
    return slots.map((s) => s.age);
  }
  if (mode === 'female') {
    return slots.filter((s) => s.gender === SDC_GENDER_FEMALE).map((s) => s.age);
  }
  return slots.filter((s) => s.gender === SDC_GENDER_MALE).map((s) => s.age);
}

/** Long help for the info icon next to “Leeftijd”. */
export const AGE_FILTER_MODE_GROUP_HELP =
  'Voor stellen hoort het eerste getal bij de eerste persoon op de kaart, het tweede bij de tweede (zelfde volgorde als de gekleurde leeftijden). ' +
  '“Alle”: het profiel blijft zichtbaar als minstens één van die leeftijden binnen het bereik valt. ' +
  '“Vrouw” of “Man”: alleen die leeftijd telt. Ontbrekende leeftijd: profiel blijft zichtbaar.';

/** UI: compact mode toggles next to the age inputs (labels are Dutch to match the People UI). */
export const AGE_FILTER_MODE_OPTIONS: {
  value: AgeFilterMode;
  icon: string;
  /** Short control label */
  label: string;
  /** Tooltip (native `title`) */
  title: string;
}[] = [
  {
    value: 'any',
    icon: 'mdi:account-multiple-outline',
    label: 'Alle',
    title:
      'Alle personen in het profiel: het profiel blijft zichtbaar als minimaal één leeftijd binnen het bereik valt. Voor stellen telt dus óf zij óf hij.',
  },
  {
    value: 'female',
    icon: 'mdi:gender-female',
    label: 'Vrouw',
    title:
      'Alleen de leeftijd van de vrouw (vrouwelijke persoon in het profiel). Andere personen tellen niet mee voor dit bereik.',
  },
  {
    value: 'male',
    icon: 'mdi:gender-male',
    label: 'Man',
    title:
      'Alleen de leeftijd van de man (mannelijke persoon in het profiel). Andere personen tellen niet mee voor dit bereik.',
  },
];
