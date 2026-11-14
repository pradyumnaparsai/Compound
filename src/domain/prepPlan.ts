import {
  DSA_WEEKS,
  FUNDAMENTALS,
  HLD,
  HLD_DAY1,
  HLD_DAY2,
  LLD,
  LLD_DAY1,
  LLD_DAY2,
  LLD_DRILL_STEPS,
  HLD_DRILL_STEPS,
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
  /** DSA week 1-6 during the study phase (Nov 15 - Dec 16); null in the mock phase and on the wedding break. */
  week: number | null;
  focus: string;
  rest: boolean;
  items: PrepItem[];
};

type Drill = { kind: 'lld' | 'hld'; name: string };
type Role = 'lld1' | 'lld2' | 'hld1' | 'hld2' | 'extra';

/**
 * Phase 1 (Nov 15 - Dec 16): study only, no mocks. Each DSA week is a bundle of days; the role of a day decides
 * what it holds: LLD design/implementation, HLD stages 1-4/5-8, or the "extra" day (extension DSA pair,
 * fundamentals and a design drill). Two-day exercises always sit on consecutive days, so none straddles the
 * wedding break. The two 4-day bundles have no extra day (core DSA + design already fill them), so their
 * extension pairs, fundamentals and drills move to phase 2.
 */
type Bundle = { week: number; days: [string, Role][]; extra?: { fund: number; drill: Drill } };

const BUNDLES: Bundle[] = [
  {
    week: 0,
    days: [['2026-11-15', 'lld1'], ['2026-11-16', 'lld2'], ['2026-11-17', 'hld1'], ['2026-11-18', 'hld2'], ['2026-11-19', 'extra']],
    extra: { fund: 0, drill: { kind: 'lld', name: 'Parking Lot' } },
  },
  {
    week: 1,
    days: [['2026-11-20', 'lld1'], ['2026-11-21', 'lld2'], ['2026-11-22', 'extra'], ['2026-11-27', 'hld1'], ['2026-11-28', 'hld2']],
    extra: { fund: 1, drill: { kind: 'hld', name: 'URL Shortener' } },
  },
  { week: 2, days: [['2026-11-29', 'lld1'], ['2026-11-30', 'lld2'], ['2026-12-01', 'hld1'], ['2026-12-02', 'hld2']] },
  {
    week: 3,
    days: [['2026-12-03', 'lld1'], ['2026-12-04', 'lld2'], ['2026-12-05', 'hld1'], ['2026-12-06', 'hld2'], ['2026-12-07', 'extra']],
    extra: { fund: 3, drill: { kind: 'lld', name: 'Splitwise' } },
  },
  {
    week: 4,
    days: [['2026-12-08', 'lld1'], ['2026-12-09', 'lld2'], ['2026-12-10', 'hld1'], ['2026-12-11', 'hld2'], ['2026-12-12', 'extra']],
    extra: { fund: 4, drill: { kind: 'hld', name: 'Distributed Cache' } },
  },
  { week: 5, days: [['2026-12-13', 'lld1'], ['2026-12-14', 'lld2'], ['2026-12-15', 'hld1'], ['2026-12-16', 'hld2']] },
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

/** Two core problems: pair 0 = problems 1-2, ... pair 3 = problems 7-8. */
function coreItems(date: string, week: number, pair: number): PrepItem[] {
  return [0, 1].map((k) => {
    const p = DSA_WEEKS[week].core[pair * 2 + k];
    return item(date, `dsa${k + 1}`, 'dsa', p.title, k === 0 ? 40 : 30, {
      detail: p.pattern,
      badge: k === 0 ? 'Core · 35–40 min' : 'Core · 20–30 min',
    });
  });
}

function extItems(date: string, week: number): PrepItem[] {
  return DSA_WEEKS[week].ext.map((p, k) =>
    item(date, `dsa${k + 1}`, 'dsa', p.title, 30, {
      detail: `${p.pattern} · or redo a Yellow/Red problem`,
      badge: 'Extension / revision',
    }),
  );
}

function lldItem(date: string, week: number, day: 1 | 2): PrepItem {
  const ex = LLD[week];
  return item(date, 'lld', 'lld', `LLD: ${ex.name}`, day === 1 ? 60 : 75, {
    detail: ex.concepts,
    badge: day === 1 ? 'Day 1/2 · Design' : 'Day 2/2 · Implementation',
    stepTitles: day === 1 ? LLD_DAY1 : LLD_DAY2,
  });
}

function hldItem(date: string, week: number, day: 1 | 2): PrepItem {
  const ex = HLD[week];
  return item(date, 'hld', 'hld', `HLD: ${ex.name}`, 70, {
    detail: ex.concepts,
    badge: day === 1 ? 'Day 1/2 · Stages 1–4' : 'Day 2/2 · Stages 5–8',
    stepTitles: day === 1 ? HLD_DAY1 : HLD_DAY2,
  });
}

function fundItem(date: string, index: number): PrepItem {
  const f = FUNDAMENTALS[index];
  return item(date, 'fund', 'fundamentals', `Fundamentals: ${f.subject}`, 40, { detail: f.areas, badge: '30–45 min' });
}

/** Extra design practice with its own checkboxes: LLD drill 45 min, HLD outline 35 min. */
function drillItem(date: string, d: Drill): PrepItem {
  const lld = d.kind === 'lld';
  const minutes = lld ? 45 : 35;
  return item(date, lld ? 'dl' : 'dh', d.kind, `${lld ? 'LLD' : 'HLD'} drill: ${d.name}`, minutes, {
    detail: lld ? 'Entities, interfaces, core code and one follow-up' : 'Outline in ~35 min: requirements to trade-offs',
    badge: `Drill · ${minutes} min`,
    stepTitles: lld ? LLD_DRILL_STEPS : HLD_DRILL_STEPS,
  });
}

function studyDay(date: string, b: Bundle, role: Role): PrepDay {
  const week = b.week;
  const base = { date, week: week + 1, rest: false };
  switch (role) {
    case 'lld1':
      return { ...base, focus: 'DSA · LLD', items: [...coreItems(date, week, 0), lldItem(date, week, 1)] };
    case 'lld2':
      return { ...base, focus: 'DSA · LLD', items: [...coreItems(date, week, 1), lldItem(date, week, 2)] };
    case 'hld1':
      return { ...base, focus: 'DSA · HLD', items: [...coreItems(date, week, 2), hldItem(date, week, 1)] };
    case 'hld2':
      return { ...base, focus: 'DSA · HLD', items: [...coreItems(date, week, 3), hldItem(date, week, 2)] };
    default: {
      const x = b.extra!;
      return {
        ...base,
        focus: `DSA · Fundamentals · ${x.drill.kind.toUpperCase()} drill`,
        items: [...extItems(date, week), fundItem(date, x.fund), drillItem(date, x.drill)],
      };
    }
  }
}

/** Two STAR stories to draft, starting at story `first` (0-based). */
function starItem(date: string, first: number): PrepItem {
  return item(date, 'star', 'behavioral', `STAR stories ${first + 1}–${first + 2}`, 40, {
    detail: 'Real stories with technical detail and follow-ups; fold in Amazon Leadership Principles',
    stepTitles: [STAR_STORIES[first], STAR_STORIES[first + 1]],
  });
}

/** Yellow/Red problems redone from scratch (one checkbox per problem when there are several). */
function redoItem(date: string, n: 1 | 2): PrepItem {
  return item(date, 'rev', 'dsa', n === 1 ? 'Redo a Yellow/Red problem' : 'Redo two Yellow/Red problems', 25 * n, {
    detail: 'Pick the ones you would least like to see in an interview',
    badge: 'Revision',
    stepTitles: n === 1 ? [] : ['Problem 1: from scratch, timed', 'Problem 2: from scratch, timed'],
  });
}

function revisitItem(date: string, kind: 'lld' | 'hld'): PrepItem {
  return item(date, 'rv', kind, `Design revisit (${kind.toUpperCase()})`, 45, {
    detail: 'Re-explain an earlier exercise aloud without notes: structure, concurrency/failures, trade-offs',
    badge: 'Revision',
    stepTitles: ['Pick the exercise you remember least', 'Explain it aloud from scratch', 'Note what you missed'],
  });
}

function mockItem(date: string, title: string, minutes: number, extra: Extra & { slot?: string } = {}): PrepItem {
  const { slot = 'mock', ...rest } = extra;
  return item(date, slot, 'mock', title, minutes, { detail: 'Replaces regular practice', stepTitles: [...MOCK_RETRO_STEPS], ...rest });
}

const reviewItem = (date: string): PrepItem =>
  item(date, 'fb', 'review', 'Review feedback from the mocks', 45, { detail: 'Turn the repeated gaps into a short fix list' });

const retellItem = (date: string): PrepItem =>
  item(date, 'retell', 'behavioral', 'Retell all 8 stories aloud', 40, {
    detail: 'Tie each to an Amazon Leadership Principle and prepare the follow-ups',
  });

const phase2 = (date: string, focus: string, items: PrepItem[]): PrepDay => ({ date, week: null, focus, rest: false, items });

/**
 * Phase 2 (Dec 17 - Jan 4): mocks alternate with lighter revision days. All 12 mocks live here, together with
 * the extension pairs and fundamentals that did not fit the two 4-day study bundles, the last design drills,
 * the STAR stories (from Dec 21) and Yellow/Red revision.
 */
function buildPhase2(): PrepDay[] {
  return [
    phase2('2026-12-17', 'DSA · Fundamentals · HLD drill', [...extItems('2026-12-17', 2), fundItem('2026-12-17', 2), drillItem('2026-12-17', { kind: 'hld', name: 'News Feed' })]),
    phase2('2026-12-18', 'DSA mock', [mockItem('2026-12-18', 'DSA mock', 100)]),
    phase2('2026-12-19', 'DSA · LLD drill · Revision', [...extItems('2026-12-19', 5), drillItem('2026-12-19', { kind: 'lld', name: 'Elevator' }), redoItem('2026-12-19', 1)]),
    phase2('2026-12-20', 'HLD mock', [mockItem('2026-12-20', 'HLD mock', 100)]),
    phase2('2026-12-21', 'Behavioral · HLD drill · Revision', [starItem('2026-12-21', 0), drillItem('2026-12-21', { kind: 'hld', name: 'Log Aggregation / Metrics Pipeline' }), redoItem('2026-12-21', 2)]),
    phase2('2026-12-22', 'LLD mock · Behavioral', [mockItem('2026-12-22', 'LLD / code review mock', 90), starItem('2026-12-22', 2)]),
    phase2('2026-12-23', 'Fundamentals · LLD drill · Revision', [fundItem('2026-12-23', 5), drillItem('2026-12-23', { kind: 'lld', name: 'Cab Booking' }), redoItem('2026-12-23', 2)]),
    phase2('2026-12-24', 'DSA mock', [mockItem('2026-12-24', 'DSA mock', 100)]),
    phase2('2026-12-25', 'Behavioral · Design revisit · Revision', [starItem('2026-12-25', 4), revisitItem('2026-12-25', 'hld'), redoItem('2026-12-25', 2)]),
    phase2('2026-12-26', 'HLD mock', [mockItem('2026-12-26', 'HLD mock', 100)]),
    phase2('2026-12-27', 'Behavioral · Design revisit · Revision', [starItem('2026-12-27', 6), revisitItem('2026-12-27', 'lld'), redoItem('2026-12-27', 2)]),
    phase2('2026-12-28', 'LLD mock · Behavioral', [mockItem('2026-12-28', 'LLD / code review mock', 90), retellItem('2026-12-28')]),
    phase2('2026-12-29', 'Full DSA simulation', [mockItem('2026-12-29', 'Full DSA simulation', 150)]),
    phase2('2026-12-30', 'HLD mock + behavioral round', [
      mockItem('2026-12-30', 'HLD mock + behavioral round', 150, {
        slot: 'hbmock', // own id: this day's mock used to have different steps
        stepTitles: ['Do the HLD mock', 'Behavioral round: tell your stories and take follow-ups', ...MOCK_RETRO_STEPS.slice(1)],
      }),
    ]),
    phase2('2026-12-31', 'DSA mock · Review', [mockItem('2026-12-31', 'DSA mock', 100), reviewItem('2026-12-31')]),
    { date: '2027-01-01', week: null, focus: 'Rest / light revision', rest: true, items: [] },
    phase2('2027-01-02', 'Full DSA mock', [mockItem('2027-01-02', 'Full DSA mock', 150)]),
    phase2('2027-01-03', 'HLD + LLD mock', [mockItem('2027-01-03', 'HLD + LLD mock', 150)]),
    phase2('2027-01-04', 'Behavioral mock · Review', [
      mockItem('2027-01-04', 'Behavioral mock', 45, {
        slot: 'bmock',
        detail: 'Tell stories under follow-up questions',
        stepTitles: ['Do the mock', 'Record weak spots and missing details'],
      }),
      reviewItem('2027-01-04'),
      redoItem('2027-01-04', 1),
    ]),
  ];
}

function buildPlan(): PrepDay[] {
  const days: PrepDay[] = [];
  for (const b of BUNDLES) for (const [date, role] of b.days) days.push(studyDay(date, b, role));
  for (const date of WEDDING_BREAK) days.push({ date, week: null, focus: 'Wedding break · no catch-up', rest: true, items: [] });
  days.push(...buildPhase2());
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Every day of the plan in calendar order, including the wedding break and the buffer. */
export const PREP_PLAN: PrepDay[] = buildPlan();
export const PREP_START = PREP_PLAN[0].date;
export const PREP_END = PREP_PLAN[PREP_PLAN.length - 1].date;
