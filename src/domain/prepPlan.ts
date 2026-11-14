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
  PROJECT_TOPICS,
  STAR_STORIES,
} from './prepContent';

export type PrepKind = 'dsa' | 'lld' | 'hld' | 'fundamentals' | 'project' | 'behavioral' | 'mock' | 'recruiting' | 'review';

export type PrepStep = { id: string; title: string };

/** Without `steps` the item itself is the checkbox; with steps it is done once every step is. */
export type PrepItem = {
  id: string; // `${date}.${slot}`: stable, it is the key of the stored check
  kind: PrepKind;
  title: string;
  detail?: string;
  badge?: string; // e.g. "Day 1/2"
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

type Spec = {
  date: string;
  lld?: 1 | 2;
  hld?: 1 | 2;
  fund?: boolean;
  mock?: string;
};

/** Explicit calendar: the weeks are irregular (week 2 straddles the wedding break), so nothing is derived. */
const WEEKS: Spec[][] = [
  [
    { date: '2026-11-15', lld: 1 },
    { date: '2026-11-16', lld: 2 },
    { date: '2026-11-17', hld: 1 },
    { date: '2026-11-18', hld: 2 },
    { date: '2026-11-19', fund: true },
    { date: '2026-11-20', mock: 'DSA mock' },
    { date: '2026-11-21', mock: 'HLD mock' },
  ],
  [
    { date: '2026-11-22', fund: true },
    { date: '2026-11-27', lld: 1 },
    { date: '2026-11-28', lld: 2 },
    { date: '2026-11-29', hld: 1 },
    { date: '2026-11-30', hld: 2 },
    { date: '2026-12-01', mock: 'DSA mock' },
    { date: '2026-12-02', mock: 'HLD / design mock' },
  ],
  [
    { date: '2026-12-03', lld: 1 },
    { date: '2026-12-04', lld: 2 },
    { date: '2026-12-05', hld: 1 },
    { date: '2026-12-06', hld: 2 },
    { date: '2026-12-07', fund: true },
    { date: '2026-12-08', mock: 'DSA mock' },
    { date: '2026-12-09', mock: 'LLD mock' },
  ],
  [
    { date: '2026-12-10', lld: 1 },
    { date: '2026-12-11', lld: 2 },
    { date: '2026-12-12', hld: 1 },
    { date: '2026-12-13', hld: 2 },
    { date: '2026-12-14', fund: true },
    { date: '2026-12-15', mock: 'DSA mock' },
    { date: '2026-12-16', mock: 'HLD mock' },
  ],
  [
    { date: '2026-12-17', lld: 1 },
    { date: '2026-12-18', lld: 2 },
    { date: '2026-12-19', hld: 1 },
    { date: '2026-12-20', hld: 2 },
    { date: '2026-12-21', fund: true },
    { date: '2026-12-22', mock: 'DSA mock' },
    { date: '2026-12-23', mock: 'LLD / code review mock' },
  ],
  [
    { date: '2026-12-24', lld: 1 },
    { date: '2026-12-25', lld: 2 },
    { date: '2026-12-26', hld: 1 },
    { date: '2026-12-27', hld: 2 },
    { date: '2026-12-28', fund: true },
    { date: '2026-12-29', mock: 'Full DSA simulation' },
    { date: '2026-12-30', mock: 'HLD + Walmart project + behavioral mock' },
  ],
];

export const WEDDING_BREAK = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];

/** Recruiting milestone, shown on the first day of each pipeline phase. */
const RECRUITING: Record<string, string> = {
  '2026-11-15': 'Resume refinement, referrals, recruiter conversations',
  '2026-11-27': 'Applications, screening, initial interviews',
  '2026-12-06': 'Start priority-company interview loops',
  '2026-12-17': 'Priority interviews + targeted preparation',
  '2026-12-24': 'Continue interviews, address remaining gaps',
};

const step = (itemId: string, i: number, title: string): PrepStep => ({ id: `${itemId}.${i + 1}`, title });
const withSteps = (id: string, titles: string[]) => titles.map((t, i) => step(id, i, t));

function item(date: string, slot: string, kind: PrepKind, title: string, extra: Partial<PrepItem> & { stepTitles?: string[] } = {}): PrepItem {
  const id = `${date}.${slot}`;
  const { stepTitles = [], ...rest } = extra;
  return { id, kind, title, steps: withSteps(id, stepTitles), ...rest };
}

function dsaItems(date: string, week: number, practiceDay: number): PrepItem[] {
  const w = DSA_WEEKS[week];
  if (practiceDay < 4) {
    return [0, 1].map((k) => {
      const p = w.core[practiceDay * 2 + k];
      return item(date, `dsa${k + 1}`, 'dsa', p.title, { detail: p.pattern, badge: k === 0 ? 'Core · 35–40 min' : 'Core · 20–30 min' });
    });
  }
  return w.ext.map((p, k) =>
    item(date, `dsa${k + 1}`, 'dsa', p.title, {
      detail: `${p.pattern} · or redo a Yellow/Red problem`,
      badge: 'Extension / revision',
    }),
  );
}

function projectItems(date: string, week: number): PrepItem[] {
  const inv = PROJECT_TOPICS.inventory;
  const mig = PROJECT_TOPICS.migration;
  const out: PrepItem[] = [];
  switch (week) {
    case 0:
      out.push(item(date, 'project', 'project', `Walmart project: ${inv.name}`, { detail: 'Draft the full walkthrough', stepTitles: [...inv.steps] }));
      break;
    case 1:
      out.push(item(date, 'project', 'project', `Walmart project: ${inv.name}`, { detail: 'Rehearse aloud, prepare follow-up questions' }));
      break;
    case 2:
      out.push(item(date, 'project', 'project', `Walmart project: ${mig.name}`, { detail: 'Draft the full walkthrough', stepTitles: [...mig.steps] }));
      break;
    case 3:
      out.push(item(date, 'project', 'project', `Walmart project: ${mig.name}`, { detail: 'Rehearse aloud, prepare follow-up questions' }));
      break;
    case 4:
      out.push(item(date, 'project', 'project', 'Walmart projects: both walkthroughs', { detail: 'Rehearse back to back, ~10 min each' }));
      break;
    default:
      out.push(item(date, 'project', 'project', 'Walmart projects: final polish', { detail: 'Trim both walkthroughs and list likely follow-ups' }));
  }
  return out;
}

function storyItem(date: string, week: number): PrepItem {
  if (week < 4) {
    const a = week * 2;
    return item(date, 'stories', 'behavioral', `STAR stories ${a + 1}–${a + 2}`, {
      detail: 'Real stories with technical detail and follow-ups; fold in Amazon Leadership Principles',
      stepTitles: [STAR_STORIES[a], STAR_STORIES[a + 1]],
    });
  }
  return item(date, 'stories', 'behavioral', week === 4 ? 'STAR stories: retell all 8 aloud' : 'STAR stories: polish the weakest ones', {
    detail: 'Cover challenge, incident, decision, disagreement, cross-team, mistake, mentoring, impact',
  });
}

function buildStudyDay(spec: Spec, week: number, practiceDay: number): PrepDay {
  const { date } = spec;
  const n = week + 1;
  if (spec.mock) {
    const title = spec.mock;
    const items = [item(date, 'mock', 'mock', title, { detail: 'Replaces regular DSA practice', stepTitles: [...MOCK_RETRO_STEPS] })];
    if (RECRUITING[date]) items.push(item(date, 'recruit', 'recruiting', RECRUITING[date]));
    return { date, week: n, focus: title, rest: false, items };
  }

  const items = dsaItems(date, week, practiceDay);
  let focus = 'DSA';
  if (spec.lld) {
    const ex = LLD[week];
    items.push(
      item(date, 'lld', 'lld', `LLD: ${ex.name}`, {
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
      item(date, 'hld', 'hld', `HLD: ${ex.name}`, {
        detail: ex.concepts,
        badge: spec.hld === 1 ? 'Day 1/2 · Stages 1–4' : 'Day 2/2 · Stages 5–8',
        stepTitles: spec.hld === 1 ? HLD_DAY1 : HLD_DAY2,
      }),
    );
    focus += ' · HLD';
  }
  if (spec.fund) {
    const f = FUNDAMENTALS[week];
    items.push(item(date, 'fund', 'fundamentals', `Fundamentals: ${f.subject}`, { detail: f.areas, badge: '30–45 min' }));
    items.push(...projectItems(date, week), storyItem(date, week));
    focus += ' · Fundamentals · Projects';
  }
  if (RECRUITING[date]) items.push(item(date, 'recruit', 'recruiting', `Recruiting: ${RECRUITING[date]}`));
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
    { date: '2026-12-31', week: null, focus: 'Buffer', rest: false, items: [item('2026-12-31', 'review', 'review', 'Revise behavioral stories and project architecture')] },
    { date: '2027-01-01', week: null, focus: 'Rest / light revision', rest: true, items: [] },
    {
      date: '2027-01-02',
      week: null,
      focus: 'Buffer',
      rest: false,
      items: [item('2027-01-02', 'mock', 'mock', 'Full DSA mock', { stepTitles: [...MOCK_RETRO_STEPS] })],
    },
    {
      date: '2027-01-03',
      week: null,
      focus: 'Buffer',
      rest: false,
      items: [item('2027-01-03', 'mock', 'mock', 'HLD + LLD mock', { stepTitles: [...MOCK_RETRO_STEPS] })],
    },
    {
      date: '2027-01-04',
      week: null,
      focus: 'Buffer',
      rest: false,
      items: [item('2027-01-04', 'review', 'review', 'Review feedback and remaining applications')],
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

