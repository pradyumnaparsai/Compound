import {
  DSA_WEEKS,
  FUNDAMENTALS,
  HLD,
  HLD_DAY1,
  HLD_DAY2,
  LLD,
  LLD_DAY1,
  LLD_DAY2,
  MOCK_RETRO_STEPS,
  STAR_STORIES,
} from './prepContent';

export type PrepKind = 'dsa' | 'lld' | 'hld' | 'fundamentals' | 'behavioral' | 'mock' | 'review';

export type PrepStep = { id: string; title: string };

/** Without `steps` the item itself is the checkbox; with steps it is done once every step is. */
export type PrepItem = {
  id: string; // `${date}.${slot}`: stable, it is the key of the stored check
  kind: PrepKind;
  title: string;
  detail?: string;
  badge?: string; // e.g. "Day 1/2"
  /** Planned effort; a day should add up to roughly 2-2.5 h (mocks replace practice, so they may be shorter). */
  minutes: number;
  steps: PrepStep[];
};

export type PrepDay = {
  date: string;
  /** Study week 1-6, null for the buffer days and the wedding break. */
  week: number | null;
  focus: string;
  rest: boolean;
  items: PrepItem[];
};

type Mock = { title: string; minutes: number; steps?: string[]; detail?: string; slot?: string };
type Drill = { kind: 'lld' | 'hld'; name: string; detail: string };

type Spec = {
  date: string;
  lld?: 1 | 2;
  hld?: 1 | 2;
  fund?: boolean;
  /** Extra design drill on a fundamentals day: 45 min for LLD, 35 min for an HLD outline. */
  drill?: Drill;
  /** Index of the first of two STAR stories to draft that day (0, 2, 4, 6). */
  star?: number;
  mock?: Mock;
};

const mock = (title: string, minutes = 100): Mock => ({ title, minutes });

const HLD_OUTLINE = 'Outline in ~35 min: requirements, API, schema, architecture, bottlenecks';
const LLD_DRILL = '45 min: entities, interfaces, core code, one concurrency or extension question';

/** Explicit calendar: the weeks are irregular (week 2 straddles the wedding break), so nothing is derived. */
const WEEKS: Spec[][] = [
  [
    { date: '2026-11-15', lld: 1 },
    { date: '2026-11-16', lld: 2 },
    { date: '2026-11-17', hld: 1 },
    { date: '2026-11-18', hld: 2 },
    { date: '2026-11-19', fund: true, drill: { kind: 'lld', name: 'Parking Lot', detail: LLD_DRILL } },
    { date: '2026-11-20', mock: mock('DSA mock') },
    { date: '2026-11-21', mock: mock('HLD mock') },
  ],
  [
    { date: '2026-11-22', fund: true, drill: { kind: 'hld', name: 'URL Shortener', detail: HLD_OUTLINE } },
    { date: '2026-11-27', lld: 1 },
    { date: '2026-11-28', lld: 2 },
    { date: '2026-11-29', hld: 1 },
    { date: '2026-11-30', hld: 2 },
    { date: '2026-12-01', mock: mock('DSA mock') },
    { date: '2026-12-02', mock: mock('HLD / design mock') },
  ],
  [
    { date: '2026-12-03', lld: 1 },
    { date: '2026-12-04', lld: 2 },
    { date: '2026-12-05', hld: 1 },
    { date: '2026-12-06', hld: 2 },
    { date: '2026-12-07', fund: true, drill: { kind: 'hld', name: 'Distributed Cache', detail: HLD_OUTLINE } },
    { date: '2026-12-08', mock: mock('DSA mock') },
    { date: '2026-12-09', mock: mock('LLD mock', 90) },
  ],
  [
    { date: '2026-12-10', lld: 1 },
    { date: '2026-12-11', lld: 2 },
    { date: '2026-12-12', hld: 1 },
    { date: '2026-12-13', hld: 2 },
    { date: '2026-12-14', fund: true, drill: { kind: 'lld', name: 'Splitwise', detail: LLD_DRILL } },
    { date: '2026-12-15', mock: mock('DSA mock') },
    { date: '2026-12-16', mock: mock('HLD mock') },
  ],
  [
    { date: '2026-12-17', lld: 1 },
    { date: '2026-12-18', lld: 2 },
    { date: '2026-12-19', hld: 1 },
    { date: '2026-12-20', hld: 2 },
    { date: '2026-12-21', fund: true, star: 0 },
    { date: '2026-12-22', mock: mock('DSA mock') },
    { date: '2026-12-23', mock: mock('LLD / code review mock', 90), star: 2 },
  ],
  [
    { date: '2026-12-24', lld: 1 },
    { date: '2026-12-25', lld: 2 },
    { date: '2026-12-26', hld: 1 },
    { date: '2026-12-27', hld: 2 },
    { date: '2026-12-28', fund: true, star: 4 },
    { date: '2026-12-29', mock: mock('Full DSA simulation', 150) },
    {
      date: '2026-12-30',
      mock: {
        title: 'HLD mock + behavioral round',
        slot: 'hbmock', // new id: this day's mock used to have different steps
        minutes: 150,
        detail: 'Replaces regular practice',
        steps: ['Do the HLD mock', 'Behavioral round: tell stories 1–6 and take follow-ups', ...MOCK_RETRO_STEPS.slice(1)],
      },
    },
  ],
];

export const WEDDING_BREAK = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];

const step = (itemId: string, i: number, title: string): PrepStep => ({ id: `${itemId}.${i + 1}`, title });
const withSteps = (id: string, titles: string[]) => titles.map((t, i) => step(id, i, t));

type Extra = Partial<Omit<PrepItem, 'id' | 'kind' | 'title' | 'steps' | 'minutes'>> & { stepTitles?: string[] };

function item(date: string, slot: string, kind: PrepKind, title: string, minutes: number, extra: Extra = {}): PrepItem {
  const id = `${date}.${slot}`;
  const { stepTitles = [], ...rest } = extra;
  return { id, kind, title, minutes, steps: withSteps(id, stepTitles), ...rest };
}

function dsaItems(date: string, week: number, practiceDay: number): PrepItem[] {
  const w = DSA_WEEKS[week];
  if (practiceDay < 4) {
    return [0, 1].map((k) => {
      const p = w.core[practiceDay * 2 + k];
      return item(date, `dsa${k + 1}`, 'dsa', p.title, k === 0 ? 40 : 30, {
        detail: p.pattern,
        badge: k === 0 ? 'Core · 35–40 min' : 'Core · 20–30 min',
      });
    });
  }
  return w.ext.map((p, k) =>
    item(date, `dsa${k + 1}`, 'dsa', p.title, 30, {
      detail: `${p.pattern} · or redo a Yellow/Red problem`,
      badge: 'Extension / revision',
    }),
  );
}

/** Two STAR stories to draft, starting at story `first` (0-based). */
function starItem(date: string, first: number): PrepItem {
  return item(date, 'star', 'behavioral', `STAR stories ${first + 1}–${first + 2}`, 40, {
    detail: 'Real stories with technical detail and follow-ups; fold in Amazon Leadership Principles',
    stepTitles: [STAR_STORIES[first], STAR_STORIES[first + 1]],
  });
}

function buildStudyDay(spec: Spec, week: number, practiceDay: number): PrepDay {
  const { date } = spec;
  const n = week + 1;
  if (spec.mock) {
    const m = spec.mock;
    const items = [
      item(date, m.slot ?? 'mock', 'mock', m.title, m.minutes, {
        detail: m.detail ?? 'Replaces regular DSA practice',
        stepTitles: m.steps ?? [...MOCK_RETRO_STEPS],
      }),
    ];
    if (spec.star !== undefined) items.push(starItem(date, spec.star));
    return { date, week: n, focus: spec.star !== undefined ? `${m.title} · Behavioral` : m.title, rest: false, items };
  }

  const items = dsaItems(date, week, practiceDay);
  let focus = 'DSA';
  if (spec.lld) {
    const ex = LLD[week];
    items.push(
      item(date, 'lld', 'lld', `LLD: ${ex.name}`, spec.lld === 1 ? 60 : 75, {
        detail: ex.concepts,
        badge: spec.lld === 1 ? 'Day 1/2 · Design' : 'Day 2/2 · Implementation',
        stepTitles: spec.lld === 1 ? LLD_DAY1 : LLD_DAY2,
      }),
    );
    focus += ' · LLD';
  }
  if (spec.hld) {
    const ex = HLD[week];
    items.push(
      item(date, 'hld', 'hld', `HLD: ${ex.name}`, 70, {
        detail: ex.concepts,
        badge: spec.hld === 1 ? 'Day 1/2 · Stages 1–4' : 'Day 2/2 · Stages 5–8',
        stepTitles: spec.hld === 1 ? HLD_DAY1 : HLD_DAY2,
      }),
    );
    focus += ' · HLD';
  }
  if (spec.fund) {
    const f = FUNDAMENTALS[week];
    items.push(item(date, 'fund', 'fundamentals', `Fundamentals: ${f.subject}`, 40, { detail: f.areas, badge: '30–45 min' }));
    focus += ' · Fundamentals';
  }
  if (spec.drill) {
    const d = spec.drill;
    const minutes = d.kind === 'hld' ? 35 : 45;
    items.push(
      item(date, 'drill', d.kind, `${d.kind === 'hld' ? 'HLD' : 'LLD'} drill: ${d.name}`, minutes, {
        detail: d.detail,
        badge: `Drill · ${minutes} min`,
      }),
    );
    focus += ` · ${d.kind === 'hld' ? 'HLD' : 'LLD'} drill`;
  }
  if (spec.star !== undefined) {
    items.push(starItem(date, spec.star));
    focus += ' · Behavioral';
  }
  return { date, week: n, focus, rest: false, items };
}

function buildPlan(): PrepDay[] {
  const days: PrepDay[] = [];
  WEEKS.forEach((specs, week) => {
    let practiceDay = 0;
    for (const spec of specs) {
      const day = buildStudyDay(spec, week, practiceDay);
      if (!spec.mock) practiceDay++;
      days.push(day);
    }
    if (week === 1) {
      // Study week 2 is split by the wedding break; its first day (Nov 22) is already in `days`.
      for (const date of WEDDING_BREAK) days.push({ date, week: null, focus: 'Wedding break · no catch-up', rest: true, items: [] });
    }
  });

  const buffer: PrepDay[] = [
    {
      date: '2026-12-31',
      week: null,
      focus: 'Behavioral · DSA revision',
      rest: false,
      items: [
        starItem('2026-12-31', 6),
        item('2026-12-31', 'retell', 'behavioral', 'Retell all 8 stories aloud', 40, {
          detail: 'Tie each to an Amazon Leadership Principle and prepare the follow-ups',
        }),
        item('2026-12-31', 'rev', 'dsa', 'Redo two Yellow/Red problems', 50, {
          detail: 'Pick the ones you would least like to see in an interview',
          badge: 'Revision',
          stepTitles: ['Problem 1: from scratch, timed', 'Problem 2: from scratch, timed'],
        }),
      ],
    },
    { date: '2027-01-01', week: null, focus: 'Rest / light revision', rest: true, items: [] },
    {
      date: '2027-01-02',
      week: null,
      focus: 'Buffer',
      rest: false,
      items: [item('2027-01-02', 'mock', 'mock', 'Full DSA mock', 150, { stepTitles: [...MOCK_RETRO_STEPS] })],
    },
    {
      date: '2027-01-03',
      week: null,
      focus: 'Buffer',
      rest: false,
      items: [item('2027-01-03', 'mock', 'mock', 'HLD + LLD mock', 150, { stepTitles: [...MOCK_RETRO_STEPS] })],
    },
    {
      date: '2027-01-04',
      week: null,
      focus: 'Behavioral mock · Review',
      rest: false,
      items: [
        item('2027-01-04', 'bmock', 'mock', 'Behavioral mock', 45, {
          detail: 'Tell stories under follow-up questions',
          stepTitles: ['Do the mock', 'Record weak spots and missing details'],
        }),
        item('2027-01-04', 'fb', 'review', 'Review feedback from all mocks', 45, { detail: 'Turn the repeated gaps into a short fix list' }),
        item('2027-01-04', 'rev', 'dsa', 'Redo a Yellow/Red problem', 25, { badge: 'Revision' }),
      ],
    },
  ];
  days.push(...buffer);

  // The wedding break was appended mid-way through week 2, so restore calendar order.
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Every day of the plan in calendar order, including the wedding break and the buffer. */
export const PREP_PLAN: PrepDay[] = buildPlan();
export const PREP_START = PREP_PLAN[0].date;
export const PREP_END = PREP_PLAN[PREP_PLAN.length - 1].date;
