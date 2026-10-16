export interface SquadPlayer {
  id: number | string;
  name: string;
  position: string;
  overall: number;
  age?: number;
  nationality?: string;
  price?: number;
}

export interface Manager {
  uid: string;
  email: string;
  managerName: string;
  budget: number;
  squad?: SquadPlayer[];
  formation?: string;
  lineup?: Record<string, SquadPlayer | null>;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  matchHistory?: Record<string, MatchRecord>;
}

export interface MatchRecord {
  opponent: string;
  homeScore: number;
  awayScore: number;
  playedAt: number;
}

export const FORMATIONS: Record<string, { def: number; mid: number; fwd: number }> = {
  '4-3-3': { def: 4, mid: 3, fwd: 3 },
  '4-4-2': { def: 4, mid: 4, fwd: 2 },
  '3-5-2': { def: 3, mid: 5, fwd: 2 },
  '4-2-3-1': { def: 4, mid: 5, fwd: 1 },
  '3-4-3': { def: 3, mid: 4, fwd: 3 },
};

const DEF = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const MID = ['CM', 'CDM', 'CAM', 'LM', 'RM'];
const FWD = ['ST', 'CF', 'LW', 'RW'];

const byRating = (a: SquadPlayer, b: SquadPlayer) => b.overall - a.overall;

// Best XI for a formation: best keeper, then the best players of each line, topped up from the rest
export function pickStartingXI(squad: SquadPlayer[], formation: string): SquadPlayer[] {
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const used = new Set<SquadPlayer>();
  const take = (pool: SquadPlayer[], n: number) => {
    const picked = pool.filter((p) => !used.has(p)).sort(byRating).slice(0, n);
    picked.forEach((p) => used.add(p));
    return picked;
  };
  const xi = [
    ...take(squad.filter((p) => p.position === 'GK'), 1),
    ...take(squad.filter((p) => DEF.includes(p.position)), f.def),
    ...take(squad.filter((p) => MID.includes(p.position)), f.mid),
    ...take(squad.filter((p) => FWD.includes(p.position)), f.fwd),
  ];
  if (xi.length < 11) xi.push(...take(squad, 11 - xi.length));
  return xi.slice(0, 11);
}

// Lineup saved by the web app if complete, otherwise the best XI
export function getStartingXI(m: Manager): SquadPlayer[] {
  const squad = m.squad || [];
  const saved = Object.values(m.lineup || {}).filter(Boolean) as SquadPlayer[];
  if (saved.length === 11) return saved;
  return pickStartingXI(squad, m.formation || '4-3-3');
}

const POSITIONS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'];

export function buildComputerSquad(rating: number) {
  return POSITIONS.map((position, i) => ({
    name: `CPU ${i + 1}`,
    position,
    overall: Math.max(45, Math.min(95, Math.round(rating + (((i * 7) % 9) - 4)))),
  }));
}
