// FuryFM – Canvas football game engine
// 60fps, pure JS (no React, no Firebase).

const PITCH_W = 400;
const PITCH_H = 580;
const GOAL_W = 120;
const GOAL_D = 20;
const PLAYER_R = 13;
const BALL_R = 8;
const MATCH_REAL_SECONDS = 180; // 3 real min = 90 game min
const BALL_FRICTION = 0.962;
const PLAYER_SPEED = 2.6;
const PASS_POWER = 9.5;
const SHOOT_POWER = 13;
const GOAL_X_MIN = (PITCH_W - GOAL_W) / 2;
const GOAL_X_MAX = (PITCH_W + GOAL_W) / 2;

// Minimum frames an AI player holds ball before deciding to act
const MIN_HOLD = { GK: 70, CB: 45, LB: 45, RB: 45, LWB: 40, RWB: 40,
                   CDM: 30, CM: 25, LM: 20, RM: 20, CAM: 18, LW: 15, RW: 15, ST: 12 };

const FORMATIONS = {
  '4-3-3': [
    { pos: 'GK',  x: 50, y: 95 },
    { pos: 'LB',  x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB',  x: 63, y: 78 }, { pos: 'RB',  x: 85, y: 75 },
    { pos: 'CDM', x: 50, y: 55 },
    { pos: 'CM',  x: 28, y: 45 }, { pos: 'CM',  x: 72, y: 45 },
    { pos: 'LW',  x: 18, y: 22 }, { pos: 'ST',  x: 50, y: 15 }, { pos: 'RW',  x: 82, y: 22 },
  ],
  '4-4-2': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'LM', x: 18, y: 48 }, { pos: 'CM', x: 37, y: 52 }, { pos: 'CM', x: 63, y: 52 }, { pos: 'RM', x: 82, y: 48 },
    { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
    { pos: 'LWB', x: 12, y: 52 }, { pos: 'CDM', x: 50, y: 55 }, { pos: 'CM', x: 32, y: 48 }, { pos: 'CM', x: 68, y: 48 }, { pos: 'RWB', x: 88, y: 52 },
    { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
  ],
  '4-2-3-1': [
    { pos: 'GK',  x: 50, y: 95 },
    { pos: 'LB',  x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'CDM', x: 37, y: 58 }, { pos: 'CDM', x: 63, y: 58 },
    { pos: 'LW',  x: 18, y: 35 }, { pos: 'CAM', x: 50, y: 38 }, { pos: 'RW', x: 82, y: 35 },
    { pos: 'ST',  x: 50, y: 15 },
  ],
  '3-4-3': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
    { pos: 'LM', x: 18, y: 50 }, { pos: 'CM', x: 37, y: 52 }, { pos: 'CM', x: 63, y: 52 }, { pos: 'RM', x: 82, y: 50 },
    { pos: 'LW', x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 },
  ],
};

function d(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Ball ─────────────────────────────────────────────────────────────────────

class Ball {
  constructor() { this.reset(); this.trail = []; }

  reset() {
    this.x = PITCH_W / 2; this.y = PITCH_H / 2;
    this.vx = 0; this.vy = 0; this.owner = null;
    this.trail = [];
  }

  kick(dirX, dirY, power) {
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.vx = (dirX / len) * power;
    this.vy = (dirY / len) * power;
    this.owner = null;
  }

  update() {
    if (this.owner) {
      // Stick slightly ahead of carrier in facing direction
      this.x = this.owner.x + this.owner.fx * (PLAYER_R + BALL_R + 3);
      this.y = this.owner.y + this.owner.fy * (PLAYER_R + BALL_R + 3);
      this.vx = 0; this.vy = 0; this.trail = [];
      return;
    }
    const spd = Math.abs(this.vx) + Math.abs(this.vy);
    if (spd > 5) { this.trail.push({ x: this.x, y: this.y }); if (this.trail.length > 4) this.trail.shift(); }
    else this.trail = [];

    this.x += this.vx; this.y += this.vy;
    this.vx *= BALL_FRICTION; this.vy *= BALL_FRICTION;
    if (Math.abs(this.vx) < 0.04) this.vx = 0;
    if (Math.abs(this.vy) < 0.04) this.vy = 0;

    // Side walls bounce
    if (this.x < BALL_R) { this.x = BALL_R; this.vx *= -0.6; }
    else if (this.x > PITCH_W - BALL_R) { this.x = PITCH_W - BALL_R; this.vx *= -0.6; }
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────

class Player {
  constructor(team, idx, x, y, pos, name, overall) {
    this.team = team; this.idx = idx;
    this.x = x; this.y = y; this.baseX = x; this.baseY = y;
    this.pos = pos; this.name = name;
    this.overall = Math.min(99, Math.max(50, overall || 75));
    this.speed = PLAYER_SPEED * (0.78 + this.overall / 280);
    this.fx = 0; this.fy = team === 'home' ? -1 : 1; // facing direction
    this.hasBall = false; this.isUser = false;
    this.heldFrames = 0; // frames carrying ball
  }

  moveTo(tx, ty, mult = 1) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const step = Math.min(this.speed * mult, dist);
    this.x += (dx / dist) * step; this.y += (dy / dist) * step;
    this.fx = dx / dist; this.fy = dy / dist;
  }

  canCapture(ball) {
    if (ball.owner) return false;
    return d(this.x, this.y, ball.x, ball.y) < PLAYER_R + BALL_R + 5;
  }
}

// ─── FootballGame ─────────────────────────────────────────────────────────────

export class FootballGame {
  constructor() {
    this.home = []; this.away = [];
    this.ball = new Ball();
    this.homeScore = 0; this.awayScore = 0;
    this.frame = 0; this.totalFrames = MATCH_REAL_SECONDS * 60;
    this.finished = false;
    this.isHost = true; this.isAwayClient = false;
    this.userPlayer = null; this.awayUserPlayer = null;
    this.goalFlash = 0; this.goalPause = 0; this.lastGoalTeam = null;
    this.homeClub = 'Home'; this.awayClub = 'Away';
    this.onGoal = null; this.onTick = null; this.onSwitch = null;
    this._pendingAction = null; // 'shoot' | 'pass'
    this._awayPendingAction = null;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  start(homeSquad, awaySquad, homeFm, awayFm, isHost, homeClub, awayClub) {
    this.isHost = isHost !== false;
    this.isAwayClient = !this.isHost;
    this.homeClub = homeClub || 'Home';
    this.awayClub = awayClub || 'Away';

    this.home = this._spawn(homeSquad, homeFm || '4-3-3', 'home');
    this.away = this._spawn(awaySquad, awayFm || '4-3-3', 'away');

    // User controls best home attacker (host) or best away attacker (away client)
    if (!this.isAwayClient) {
      this.userPlayer = this._bestAttacker(this.home);
      this.userPlayer.isUser = true;
    } else {
      this.awayUserPlayer = this._bestAttacker(this.away);
      this.awayUserPlayer.isUser = true;
    }

    this._kickoff('home');
    if (this.onSwitch && this.userPlayer) this.onSwitch(this.userPlayer.name);
  }

  _spawn(squad, formation, team) {
    const layout = FORMATIONS[formation] || FORMATIONS['4-3-3'];
    return layout.slice(0, 11).map((f, i) => {
      const sq = (squad || [])[i];
      const px = team === 'home' ? (f.x / 100) * PITCH_W : ((100 - f.x) / 100) * PITCH_W;
      const py = team === 'home' ? (f.y / 100) * PITCH_H : ((100 - f.y) / 100) * PITCH_H;
      return new Player(team, i, px, py, sq?.position || f.pos, sq?.name || `P${i + 1}`, sq?.overall || 75);
    });
  }

  _bestAttacker(players) {
    const pool = players.filter(p => ['ST','LW','RW','CAM'].includes(p.pos));
    const src = pool.length ? pool : players;
    return src.reduce((b, p) => p.overall > b.overall ? p : b, src[0]);
  }

  _kickoff(team) {
    // Reset positions
    [...this.home, ...this.away].forEach(p => {
      p.x = p.baseX; p.y = p.baseY; p.hasBall = false; p.heldFrames = 0;
    });
    this.ball.reset();

    // Give ball to a CM/CDM on kicking team who is NOT the user player
    const pool = (team === 'home' ? this.home : this.away);
    let kicker = pool.find(p => ['CM', 'CDM'].includes(p.pos) && !p.isUser);
    if (!kicker) kicker = pool.find(p => !p.isUser);
    if (!kicker) kicker = pool[0];

    // Move kicker to centre
    kicker.x = PITCH_W / 2;
    kicker.y = PITCH_H / 2 + (team === 'home' ? 8 : -8);
    this._give(kicker);
  }

  _give(player) {
    [...this.home, ...this.away].forEach(p => { p.hasBall = false; });
    if (!player) return;
    this.ball.owner = player;
    player.hasBall = true;
    player.heldFrames = 0;
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(keys, remoteAwayInput) {
    if (this.finished) return;

    if (this.goalPause > 0) { this.goalPause--; if (this.goalFlash > 0) this.goalFlash--; return; }
    if (this.goalFlash > 0) this.goalFlash--;

    this.frame++;
    if (this.onTick) this.onTick(Math.floor((this.frame / this.totalFrames) * 90));

    // 1. User / remote input
    if (!this.isAwayClient) {
      this._userInput(keys);
    } else {
      this._awayInput(keys);
    }
    if (!this.isAwayClient && remoteAwayInput && this.awayUserPlayer) {
      this._applyRemote(this.awayUserPlayer, remoteAwayInput);
    }

    // 2. AI for all non-user players
    this._runAI();

    // 3. Ball physics
    this.ball.update();

    // 4. Ball capture (user gets priority)
    if (!this.ball.owner) this._capture();

    // 5. Increment held frames
    [...this.home, ...this.away].forEach(p => {
      if (p.hasBall) p.heldFrames++;
      else p.heldFrames = 0;
    });

    // 6. Auto-switch user to ball carrier on their team
    if (!this.isAwayClient) this._autoSwitch();

    // 7. Goal detection
    const g = this._checkGoal();
    if (g) this._handleGoal(g);

    // 8. Clamp
    [...this.home, ...this.away].forEach(p => {
      p.x = Math.max(PLAYER_R, Math.min(PITCH_W - PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(PITCH_H - PLAYER_R, p.y));
    });

    if (this.frame >= this.totalFrames) this.finished = true;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _userInput(keys) {
    const p = this.userPlayer; if (!p) return;
    const jx = keys.joystickX || 0, jy = keys.joystickY || 0;
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A'] || jx < -0.2) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || jx >  0.2) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W'] || jy < -0.2) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S'] || jy >  0.2) dy += 1;
    if (dx || dy) {
      const sp = keys['Shift'] ? 1.4 : 1;
      p.moveTo(p.x + dx * 50, p.y + dy * 50, sp);
    }
    if (keys['_spaceDown']) { keys['_spaceDown'] = false; if (p.hasBall) this._act(p); }
    if (keys['_tabDown'])   { keys['_tabDown']   = false; this.switchUser(); }
    // Touch buttons
    if (this._pendingAction) { if (p.hasBall) { if (this._pendingAction === 'shoot') this._shoot(p); else this._pass(p); } this._pendingAction = null; }
  }

  _awayInput(keys) {
    const p = this.awayUserPlayer; if (!p) return;
    const jx = keys.joystickX || 0, jy = keys.joystickY || 0;
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A'] || jx < -0.2) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || jx >  0.2) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W'] || jy < -0.2) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S'] || jy >  0.2) dy += 1;
    if (dx || dy) p.moveTo(p.x + dx * 50, p.y + dy * 50, keys['Shift'] ? 1.4 : 1);
    if (keys['_spaceDown']) { keys['_spaceDown'] = false; if (p.hasBall) this._act(p); }
    if (keys['_tabDown'])   { keys['_tabDown']   = false; this.switchAwayUser(); }
    if (this._awayPendingAction) { if (p.hasBall) { if (this._awayPendingAction === 'shoot') this._shoot(p); else this._pass(p); } this._awayPendingAction = null; }
  }

  _applyRemote(awayPlayer, inp) {
    if (!inp) return;
    awayPlayer.x += (inp.x - awayPlayer.x) * 0.35;
    awayPlayer.y += (inp.y - awayPlayer.y) * 0.35;
    if (inp.fx !== undefined) { awayPlayer.fx = inp.fx; awayPlayer.fy = inp.fy; }
    if (inp.action === 'shoot' && awayPlayer.hasBall) this._shoot(awayPlayer);
    else if (inp.action === 'pass' && awayPlayer.hasBall) this._pass(awayPlayer);
  }

  _act(p) {
    const goalY = p.team === 'home' ? 0 : PITCH_H;
    const distGoal = d(p.x, p.y, PITCH_W / 2, goalY);
    if (distGoal < 220) this._shoot(p); else this._pass(p);
  }

  // Public trigger methods for touch buttons
  triggerShoot() { if (this.isAwayClient) this._awayPendingAction = 'shoot'; else this._pendingAction = 'shoot'; }
  triggerPass()  { if (this.isAwayClient) this._awayPendingAction = 'pass';  else this._pendingAction = 'pass'; }

  // ── Switch control ─────────────────────────────────────────────────────────

  switchUser() {
    if (!this.userPlayer || this.isAwayClient) return;
    const near = this.home
      .filter(p => !p.isUser)
      .sort((a, b) => d(a.x, a.y, this.ball.x, this.ball.y) - d(b.x, b.y, this.ball.x, this.ball.y))[0];
    if (!near) return;
    this.userPlayer.isUser = false; near.isUser = true; this.userPlayer = near;
    if (this.onSwitch) this.onSwitch(near.name);
  }

  switchAwayUser() {
    if (!this.awayUserPlayer) return;
    const near = this.away
      .filter(p => !p.isUser)
      .sort((a, b) => d(a.x, a.y, this.ball.x, this.ball.y) - d(b.x, b.y, this.ball.x, this.ball.y))[0];
    if (!near) return;
    this.awayUserPlayer.isUser = false; near.isUser = true; this.awayUserPlayer = near;
    if (this.onSwitch) this.onSwitch(near.name);
  }

  _autoSwitch() {
    // When home team wins the ball, auto-give control to ball carrier
    const carrier = this.ball.owner;
    if (carrier && carrier.team === 'home' && carrier !== this.userPlayer) {
      this.userPlayer.isUser = false; carrier.isUser = true; this.userPlayer = carrier;
      if (this.onSwitch) this.onSwitch(carrier.name);
    }
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  _capture() {
    const user = this.isAwayClient ? this.awayUserPlayer : this.userPlayer;
    const all = [...this.home, ...this.away];
    // Sort: user first, then by distance to ball
    const sorted = all.slice().sort((a, b) => {
      if (a === user) return -1; if (b === user) return 1;
      return d(a.x, a.y, this.ball.x, this.ball.y) - d(b.x, b.y, this.ball.x, this.ball.y);
    });
    for (const p of sorted) {
      if (p.canCapture(this.ball)) { this._give(p); break; }
    }
  }

  // ── AI ─────────────────────────────────────────────────────────────────────

  _runAI() {
    const ball = this.ball;
    const ownerTeam = ball.owner?.team || null;
    const all = [...this.home, ...this.away];

    // Per-team: only allow 2 players to actively press the ball at once
    let homePress = 0, awayPress = 0;
    const MAX_PRESS = 2;

    // Sort by distance to ball so nearest players get first pick on pressing
    const byDist = all.filter(p => !p.isUser).sort(
      (a, b) => d(a.x, a.y, ball.x, ball.y) - d(b.x, b.y, ball.x, ball.y)
    );

    for (const p of byDist) {
      const myTeamHasBall = ownerTeam === p.team;
      const oppHasBall = ownerTeam && ownerTeam !== p.team;
      const distToBall = d(p.x, p.y, ball.x, ball.y);
      const presserCount = p.team === 'home' ? homePress : awayPress;
      const canPress = oppHasBall && presserCount < MAX_PRESS && distToBall < 200;

      if (canPress) {
        if (p.team === 'home') homePress++; else awayPress++;
      }

      this._aiTick(p, ball, myTeamHasBall, canPress, ownerTeam);
    }
  }

  _aiTick(p, ball, myBall, shouldPress, ownerTeam) {
    const oppGoalY = p.team === 'home' ? 0 : PITCH_H;
    const myGoalY  = p.team === 'home' ? PITCH_H : 0;

    // ── Has ball ─────────────────────────────────────────────────
    if (p.hasBall) {
      const minHold = MIN_HOLD[p.pos] || 25;
      const distGoal = d(p.x, p.y, PITCH_W / 2, oppGoalY);

      // GK: quickly distribute
      if (p.pos === 'GK') {
        if (p.heldFrames < minHold) {
          p.moveTo(p.baseX, p.baseY, 0.4); // hold ground
        } else {
          this._pass(p);
        }
        return;
      }

      if (p.heldFrames < minHold) {
        // Dribble toward goal slowly
        const dir = p.team === 'home' ? -1 : 1;
        p.moveTo(
          p.x + (PITCH_W / 2 - p.x) * 0.03,
          p.y + dir * 8,
          0.85
        );
        return;
      }

      // Decide: shoot or pass
      const shooters = ['ST','LW','RW','CAM','CM','CDM'];
      const shootDist = p.team === 'home' ? 220 : 220;
      if (shooters.includes(p.pos) && distGoal < shootDist) {
        this._shoot(p);
      } else {
        this._pass(p);
      }
      return;
    }

    // ── No ball ──────────────────────────────────────────────────

    // GK: track ball along goal line
    if (p.pos === 'GK') {
      const boxTop  = p.team === 'home' ? PITCH_H - 110 : 0;
      const boxBot  = p.team === 'home' ? PITCH_H       : 110;
      const inBox   = ball.y >= Math.min(boxTop, boxBot) && ball.y <= Math.max(boxTop, boxBot);
      const gkY     = p.team === 'home' ? PITCH_H - PLAYER_R - 5 : PLAYER_R + 5;
      const trackX  = Math.max(GOAL_X_MIN + PLAYER_R + 4, Math.min(GOAL_X_MAX - PLAYER_R - 4, ball.x));
      if (inBox && !ball.owner) {
        p.moveTo(ball.x, ball.y, 1.2); // rush out for loose ball in box
      } else {
        p.moveTo(trackX, gkY, 0.9);
      }
      // Try steal if adjacent to carrier in box
      if (ball.owner && inBox) this._trySteal(p, ball);
      return;
    }

    // Pressing player chases ball / tries to tackle
    if (shouldPress) {
      const carrier = ball.owner;
      if (carrier) {
        p.moveTo(carrier.x, carrier.y, 1.05);
        this._trySteal(p, ball);
      } else {
        p.moveTo(ball.x, ball.y, 1.05);
      }
      return;
    }

    // Teammates in possession: support run / positional movement
    if (myBall) {
      const dir = p.team === 'home' ? -1 : 1;
      const fwdY = p.baseY + dir * 15;
      // Drift toward ball X-side slightly + forward lean
      const targetX = p.baseX + (ball.x - PITCH_W / 2) * 0.18;
      p.moveTo(targetX, fwdY, 0.6);
      return;
    }

    // Opponent has ball (not pressing): hold defensive shape, shift toward ball
    const shiftX = (ball.x - PITCH_W / 2) * 0.15;
    const shiftY = (ball.y - p.baseY) * 0.12;
    p.moveTo(p.baseX + shiftX, p.baseY + shiftY, 0.55);
  }

  _trySteal(defender, ball) {
    const carrier = ball.owner;
    if (!carrier || carrier.team === defender.team) return;
    if (d(defender.x, defender.y, carrier.x, carrier.y) > PLAYER_R * 2.8) return;
    // steal probability increases with defender rating and decreases with carrier rating
    const chance = 0.006 + (defender.overall - carrier.overall) / 1800;
    if (Math.random() < Math.max(0.003, chance)) {
      carrier.hasBall = false;
      ball.owner = null;
      // Pop ball loose between the two players
      ball.x = (defender.x + carrier.x) / 2;
      ball.y = (defender.y + carrier.y) / 2;
      ball.vx = (defender.x - carrier.x) * 0.25;
      ball.vy = (defender.y - carrier.y) * 0.25;
      carrier.heldFrames = 0;
    }
  }

  // ── Shoot & Pass ───────────────────────────────────────────────────────────

  _shoot(p) {
    const goalY = p.team === 'home' ? 0 : PITCH_H;
    const spread = (100 - p.overall) / 700 * (GOAL_W / 2);
    const gx = PITCH_W / 2 + (Math.random() - 0.5) * GOAL_W * 0.45;
    const finalX = gx + (Math.random() - 0.5) * spread;
    const finalY = goalY + (Math.random() - 0.5) * spread * 0.25;
    const power = SHOOT_POWER * (0.82 + p.overall / 550);
    this.ball.kick(finalX - p.x, finalY - p.y, power);
    p.hasBall = false; p.heldFrames = 0;
  }

  _pass(p) {
    const mates = (p.team === 'home' ? this.home : this.away).filter(t => t !== p);
    const opps  = (p.team === 'home' ? this.away : this.home);
    const fwd   = p.team === 'home' ? -1 : 1;

    // Score each teammate: prefer forward, open, not too close
    let best = null, bestScore = -Infinity;
    for (const t of mates) {
      const dist = d(p.x, p.y, t.x, t.y);
      if (dist < 20 || dist > 260) continue;
      const fwdBonus = (t.y - p.y) * fwd < 0 ? 50 : 0;
      const marked = opps.some(o => d(o.x, o.y, t.x, t.y) < 30);
      const score = fwdBonus - dist * 0.25 - (marked ? 100 : 0);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (!best) best = mates[Math.floor(Math.random() * mates.length)];
    if (!best) return;

    const err = (100 - p.overall) / 280 * 40;
    this.ball.kick(
      best.x + (Math.random() - 0.5) * err - p.x,
      best.y + (Math.random() - 0.5) * err - p.y,
      PASS_POWER * (0.88 + Math.random() * 0.22)
    );
    p.hasBall = false; p.heldFrames = 0;
  }

  // ── Goals ──────────────────────────────────────────────────────────────────

  _checkGoal() {
    const bx = this.ball.x, by = this.ball.y;
    const inX = bx > GOAL_X_MIN && bx < GOAL_X_MAX;
    if (by < -GOAL_D / 2 && inX) return 'home';   // home attacks up → scores top
    if (by > PITCH_H + GOAL_D / 2 && inX) return 'away';
    return null;
  }

  _handleGoal(team) {
    if (team === 'home') this.homeScore++; else this.awayScore++;
    this.lastGoalTeam = team;
    this.goalFlash = 42;
    this.goalPause = 90;
    if (this.onGoal) this.onGoal(this.homeScore, this.awayScore, team);
    // Reset to kickoff for the team that conceded
    this._kickoff(team === 'home' ? 'away' : 'home');
  }

  // ── Remote sync ────────────────────────────────────────────────────────────

  applyRemoteState(state) {
    if (!state) return;
    const lerp = 0.45;
    if (state.homePlayers) state.homePlayers.forEach((s, i) => {
      const p = this.home[i]; if (!p || p.isUser) return;
      p.x += (s.x - p.x) * lerp; p.y += (s.y - p.y) * lerp;
      p.hasBall = !!s.hasBall;
      if (s.fx !== undefined) { p.fx = s.fx; p.fy = s.fy; }
    });
    if (state.awayPlayers) state.awayPlayers.forEach((s, i) => {
      const p = this.away[i]; if (!p || p.isUser) return;
      p.x += (s.x - p.x) * lerp; p.y += (s.y - p.y) * lerp;
      p.hasBall = !!s.hasBall;
      if (s.fx !== undefined) { p.fx = s.fx; p.fy = s.fy; }
    });
    if (state.ball && !this.ball.owner) {
      this.ball.x += (state.ball.x - this.ball.x) * lerp;
      this.ball.y += (state.ball.y - this.ball.y) * lerp;
      this.ball.vx = state.ball.vx || 0; this.ball.vy = state.ball.vy || 0;
    }
    if (state.homeScore !== undefined) {
      if (state.homeScore !== this.homeScore || state.awayScore !== this.awayScore) {
        this.homeScore = state.homeScore; this.awayScore = state.awayScore;
        if (this.onGoal) this.onGoal(this.homeScore, this.awayScore, null);
      }
    }
    if (state.minute !== undefined && this.onTick) this.onTick(state.minute);
    if (state.finished) this.finished = true;
  }

  getSerializableState() {
    return {
      homePlayers: this.home.map(p => ({ x: p.x, y: p.y, hasBall: p.hasBall, fx: p.fx, fy: p.fy })),
      awayPlayers: this.away.map(p => ({ x: p.x, y: p.y, hasBall: p.hasBall, fx: p.fx, fy: p.fy })),
      ball: { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy },
      homeScore: this.homeScore, awayScore: this.awayScore,
      minute: Math.floor((this.frame / this.totalFrames) * 90),
      finished: this.finished,
    };
  }

  getAwayClientInput() {
    const p = this.awayUserPlayer; if (!p) return null;
    return { x: p.x, y: p.y, fx: p.fx, fy: p.fy, action: null };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, PITCH_W, PITCH_H);
    this._drawPitch(ctx);
    this._drawGoals(ctx);
    this._drawPlayers(ctx);
    this._drawBall(ctx);
    this._drawHUD(ctx);
    if (this.goalFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.goalFlash / 42) * 0.4})`;
      ctx.fillRect(0, 0, PITCH_W, PITCH_H);
      ctx.save();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
      ctx.fillText('GOAL!', PITCH_W / 2, PITCH_H / 2 - 10);
      const who = this.lastGoalTeam === 'home' ? this.homeClub : this.awayClub;
      ctx.font = 'bold 18px sans-serif'; ctx.fillText(who, PITCH_W / 2, PITCH_H / 2 + 22);
      ctx.restore();
    }
  }

  _drawPitch(ctx) {
    ctx.fillStyle = '#1e7b38'; ctx.fillRect(0, 0, PITCH_W, PITCH_H);
    ctx.fillStyle = '#1a7034';
    for (let i = 0; i < PITCH_H; i += 58) ctx.fillRect(0, i, PITCH_W, 29);

    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, PITCH_W - 4, PITCH_H - 4);
    ctx.beginPath(); ctx.moveTo(2, PITCH_H / 2); ctx.lineTo(PITCH_W - 2, PITCH_H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(PITCH_W / 2, PITCH_H / 2, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.arc(PITCH_W / 2, PITCH_H / 2, 3, 0, Math.PI * 2); ctx.fill();

    const penW = 155, penH = 105, penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 2, penW, penH);
    ctx.strokeRect(penX, PITCH_H - penH - 2, penW, penH);

    const sixW = 75, sixH = 38, sixX = (PITCH_W - sixW) / 2;
    ctx.strokeRect(sixX, 2, sixW, sixH);
    ctx.strokeRect(sixX, PITCH_H - sixH - 2, sixW, sixH);
  }

  _drawGoals(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(GOAL_X_MIN, -GOAL_D, GOAL_W, GOAL_D + 2);
    ctx.fillRect(GOAL_X_MIN, PITCH_H - 2, GOAL_W, GOAL_D);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.strokeRect(GOAL_X_MIN, -GOAL_D, GOAL_W, GOAL_D);
    ctx.strokeRect(GOAL_X_MIN, PITCH_H, GOAL_W, GOAL_D);
  }

  _drawPlayers(ctx) {
    for (const p of [...this.home, ...this.away]) {
      const isHome = p.team === 'home';
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = isHome ? '#4a90d9' : '#e84c4c';
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = isHome ? '#2060a0' : '#a02020'; ctx.lineWidth = 2; ctx.stroke();
      if (p.isUser) {
        ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.hasBall) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R + 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.font = `bold ${PLAYER_R - 3}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.idx + 1, p.x, p.y + 0.5);
      ctx.restore();
    }
  }

  _drawBall(ctx) {
    const b = this.ball;
    b.trail.forEach((pt, i) => {
      ctx.fillStyle = `rgba(255,255,255,${((i + 1) / b.trail.length) * 0.22})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, BALL_R * 0.55, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + BALL_R + 1, BALL_R * 0.65, BALL_R * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#ccc');
    ctx.fillStyle = g; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  _drawHUD(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, PITCH_W, 30);
    const min = Math.floor((this.frame / this.totalFrames) * 90);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';  ctx.fillText(this.homeClub, 8, 15);
    ctx.textAlign = 'right'; ctx.fillText(this.awayClub, PITCH_W - 8, 15);
    ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${this.homeScore}  –  ${this.awayScore}`, PITCH_W / 2, 10);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#bbb';
    ctx.fillText(`${min}'`, PITCH_W / 2, 23);
  }

  static get PITCH_W() { return PITCH_W; }
  static get PITCH_H() { return PITCH_H; }
}
