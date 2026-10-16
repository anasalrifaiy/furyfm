export interface SquadPlayer {
  name: string;
  position: string;
  overall: number;
}

export interface GamePlayer {
  x: number;
  y: number;
  fx: number;
  fy: number;
  role: string;
  name: string;
  idx: number;
  team: 'home' | 'away';
  isUser: boolean;
  hasBall: boolean;
}

export class FootballGame {
  static readonly PITCH_W: number;
  static readonly PITCH_H: number;
  home: GamePlayer[];
  away: GamePlayer[];
  ball: { x: number; y: number };
  homeScore: number;
  awayScore: number;
  finished: boolean;
  goalFlash: number;
  goalPause: number;
  userPlayer: GamePlayer | null;
  onGoal: ((homeScore: number, awayScore: number, team: 'home' | 'away') => void) | null;
  onTick: ((minute: number) => void) | null;
  onSwitch: ((name: string) => void) | null;
  start(
    homeSquad: SquadPlayer[],
    awaySquad: SquadPlayer[],
    homeFormation: string,
    awayFormation: string,
    isHost: boolean,
    homeClub: string,
    awayClub: string
  ): void;
  update(keys: Record<string, any>, remoteInput: any): void;
  triggerPass(): void;
  triggerShoot(): void;
  triggerSwitch(): void;
}
