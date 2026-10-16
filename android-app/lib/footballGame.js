// FuryFM – Canvas football engine (60fps, pure JS: no React, no Firebase).
// The host simulates everything. An online away client only sends its input
// and renders the snapshots it receives.

const PITCH_W = 400;
const PITCH_H = 580;
const GOAL_W = 110;
const GOAL_D = 20;
const PLAYER_R = 11;
const BALL_R = 6;
const MATCH_REAL_SECONDS = 180; // 3 real minutes = 90 game minutes
const BALL_FRICTION = 0.972;
const GOAL_X_MIN = (PITCH_W - GOAL_W) / 2;
const GOAL_X_MAX = (PITCH_W + GOAL_W) / 2;
const BASE_SPEED = 2.15;
const FAST_BALL = 8.5; // above this speed outfield players cannot trap the ball

const FORMATIONS = {
  '4-3-3': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'CDM', x: 50, y: 58 },
    { pos: 'CM', x: 28, y: 46 }, { pos: 'CM', x: 72, y: 46 },
    { pos: 'LW', x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 },
  ],
  '4-4-2': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'LM', x: 18, y: 50 }, { pos: 'CM', x: 37, y: 54 }, { pos: 'CM', x: 63, y: 54 }, { pos: 'RM', x: 82, y: 50 },
    { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
    { pos: 'LWB', x: 12, y: 52 }, { pos: 'CDM', x: 50, y: 58 }, { pos: 'CM', x: 32, y: 48 }, { pos: 'CM', x: 68, y: 48 }, { pos: 'RWB', x: 88, y: 52 },
    { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'CDM', x: 37, y: 58 }, { pos: 'CDM', x: 63, y: 58 },
    { pos: 'LW', x: 18, y: 36 }, { pos: 'CAM', x: 50, y: 38 }, { pos: 'RW', x: 82, y: 36 },
    { pos: 'ST', x: 50, y: 15 },
  ],
  '3-4-3': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
    { pos: 'LM', x: 18, y: 50 }, { pos: 'CM', x: 37, y: 54 }, { pos: 'CM', x: 63, y: 54 }, { pos: 'RM', x: 82, y: 50 },
    { pos: 'LW', x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 },
  ],
};

const GROUPS = {
  GK: 'gk',
  CB: 'def', LB: 'def', RB: 'def', LWB: 'def', RWB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid', LM: 'mid', RM: 'mid',
  ST: 'fwd', CF: 'fwd', LW: 'fwd', RW: 'fwd',
};
const SHOOTER_ROLES = ['ST', 'LW', 'RW', 'CAM', 'CM', 'LM', 'RM', 'CDM'];
const MIN_HOLD = { CB: 40, LB: 35, RB: 35, LWB: 30, RWB: 30, CDM: 35, CM: 30, LM: 25, RM: 25, CAM: 25, LW: 20, RW: 20, ST: 18 };

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Ball ─────────────────────────────────────────────────────────────────────

class Ball {
  constructor() { this.reset(); }

  reset() {
    this.x = PITCH_W / 2; this.y = PITCH_H / 2;
    this.vx = 0; this.vy = 0;
    this.tx = this.x; this.ty = this.y; // render targets for online clients
    this.owner = null;
    this.lastTeam = null;
    this.receiver = null; // intended target of a pass in flight
    this.receiverTimer = 0;
    this.shot = false;
    this.saveTried = false;
  }

  speed() { return Math.hypot(this.vx, this.vy); }

  update() {
    if (this.owner) {
      const o = this.owner;
      const reach = PLAYER_R + BALL_R - 1;
      this.x += (o.x + o.fx * reach - this.x) * 0.55;
      this.y += (o.y + o.fy * reach - this.y) * 0.55;
      this.x = Math.max(BALL_R, Math.min(PITCH_W - BALL_R, this.x));
      this.y = Math.max(BALL_R, Math.min(PITCH_H - BALL_R, this.y));
      this.vx = 0; this.vy = 0;
      return;
    }

    this.x += this.vx; this.y += this.vy;
    this.vx *= BALL_FRICTION; this.vy *= BALL_FRICTION;
    if (Math.abs(this.vx) < 0.03) this.vx = 0;
    if (Math.abs(this.vy) < 0.03) this.vy = 0;

    if (this.x < BALL_R) { this.x = BALL_R; this.vx = Math.abs(this.vx) * 0.6; }
    else if (this.x > PITCH_W - BALL_R) { this.x = PITCH_W - BALL_R; this.vx = -Math.abs(this.vx) * 0.6; }

    // End lines bounce, except through the goal mouth
    const inMouth = this.x > GOAL_X_MIN && this.x < GOAL_X_MAX;
    if (!inMouth) {
      if (this.y < BALL_R) { this.y = BALL_R; this.vy = Math.abs(this.vy) * 0.6; }
      else if (this.y > PITCH_H - BALL_R) { this.y = PITCH_H - BALL_R; this.vy = -Math.abs(this.vy) * 0.6; }
    }

    if (this.receiver) {
      this.receiverTimer--;
      if (this.receiverTimer <= 0 || this.speed() < 0.8) this.receiver = null;
    }
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────

class Player {
  constructor(team, idx, x, y, role, name, overall) {
    this.team = team; this.idx = idx;
    this.x = x; this.y = y; this.baseX = x; this.baseY = y;
    this.tx = x; this.ty = y; // render targets for online clients
    this.vx = 0; this.vy = 0;
    this.fx = 0; this.fy = team === 'home' ? -1 : 1;
    this.role = role; this.name = name;
    this.overall = clamp(overall || 75, 40, 99);
    this.maxSpeed = BASE_SPEED * (0.86 + this.overall / 420);
    this.hasBall = false; this.isUser = false;
    this.hold = 0; this.think = 0;
    this.noCapture = 0; this.tackleCd = 0;
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
    this.awayHuman = false;
    this.goalFlash = 0; this.goalPause = 0; this.lastGoalTeam = null;
    this.kickoffTeam = 'home'; this.kickGrace = 0;
    this.homeClub = 'Home'; this.awayClub = 'Away';
    this.onGoal = null; this.onTick = null; this.onSwitch = null;

    this._touch = { pass: false, shoot: false, sw: false };
    this._seq = { pass: 0, shoot: 0, sw: 0 }; // away client -> host counters
    this._remoteSeq = { pass: 0, shoot: 0, sw: 0 };
    this._lastHb = -1; this._lastHbFrame = 0; this._hb = 0;
    this._clientInput = { dx: 0, dy: 0, sprint: false };
    this._lastMinute = -1;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  start(homeSquad, awaySquad, homeFm, awayFm, isHost, homeClub, awayClub) {
    this.isHost = isHost !== false;
    this.isAwayClient = !this.isHost;
    this.homeClub = homeClub || 'Home';
    this.awayClub = awayClub || 'Away';

    this.home = this._spawn(homeSquad, homeFm, 'home');
    this.away = this._spawn(awaySquad, awayFm, 'away');
    this._kickoff('home');
  }

  _spawn(squad, formation, team) {
    const layout = FORMATIONS[formation] || FORMATIONS['4-3-3'];
    const pool = (squad || []).slice(0, 11);
    const used = new Set();
    const take = (match) => {
      const i = pool.findIndex((s, k) => !used.has(k) && match(s));
      if (i >= 0) used.add(i);
      return i >= 0 ? pool[i] : null;
    };
    return layout.map((slot, i) => {
      const sq = take(s => s.position === slot.pos)
        || take(s => GROUPS[s.position] && GROUPS[s.position] === GROUPS[slot.pos])
        || take(() => true);
      const px = team === 'home' ? slot.x : 100 - slot.x;
      const py = team === 'home' ? slot.y : 100 - slot.y;
      return new Player(team, i, (px / 100) * PITCH_W, (py / 100) * PITCH_H,
        slot.pos, sq?.name || `Player ${i + 1}`, sq?.overall || 75);
    });
  }

  _kickoff(team) {
    const all = [...this.home, ...this.away];
    all.forEach(p => {
      p.x = p.tx = p.baseX; p.y = p.ty = p.baseY;
      p.vx = 0; p.vy = 0; p.hasBall = false;
      p.hold = 0; p.think = 0; p.noCapture = 0; p.tackleCd = 0;
      p.fx = 0; p.fy = p.team === 'home' ? -1 : 1;
    });
    this.ball.reset();
    this.kickoffTeam = team;
    this.kickGrace = 90;
    if (this.isAwayClient) return;

    const squad = team === 'home' ? this.home : this.away;
    const kicker = squad
      .filter(p => ['CM', 'CDM', 'CAM', 'ST'].includes(p.role))
      .sort((a, b) => Math.abs(a.baseY - PITCH_H / 2) - Math.abs(b.baseY - PITCH_H / 2))[0]
      || squad.find(p => p.role !== 'GK');
    kicker.x = kicker.tx = PITCH_W / 2;
    kicker.y = kicker.ty = PITCH_H / 2 + (team === 'home' ? 10 : -10);
    this._give(kicker);
    kicker.think = 40;

    this._setUser('home', team === 'home' ? kicker : this._nearestToBall('home'));
    if (this.awayHuman) this._setUser('away', team === 'away' ? kicker : this._nearestToBall('away'));
  }

  _give(p) {
    [...this.home, ...this.away].forEach(q => { q.hasBall = false; });
    const b = this.ball;
    b.owner = p; b.vx = 0; b.vy = 0;
    b.receiver = null; b.shot = false;
    if (p) { p.hasBall = true; p.hold = 0; b.lastTeam = p.team; }
  }

  _nearestToBall(team) {
    const b = this.ball;
    let best = null, bd = Infinity;
    for (const p of team === 'home' ? this.home : this.away) {
      if (p.role === 'GK') continue;
      const dd = dist(p.x, p.y, b.x, b.y);
      if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  }

  _setUser(team, p) {
    if (!p || p.role === 'GK') return;
    const cur = team === 'home' ? this.userPlayer : this.awayUserPlayer;
    if (p === cur) return;
    if (cur) cur.isUser = false;
    p.isUser = true;
    if (team === 'home') {
      this.userPlayer = p;
      if (this.onSwitch && !this.isAwayClient) this.onSwitch(p.name);
    } else {
      this.awayUserPlayer = p;
      if (this.onSwitch && this.isAwayClient) this.onSwitch(p.name);
    }
  }

  _isHuman(p) {
    return p.isUser && (p.team === 'home' || this.awayHuman);
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(keys, remoteAwayInput) {
    if (this.finished) return;
    keys = keys || {};
    const inp = this._readInput(keys);

    if (this.isAwayClient) { this._clientUpdate(inp); return; }

    if (this.goalPause > 0) {
      this.goalPause--;
      if (this.goalFlash > 0) this.goalFlash--;
      if (this.goalPause === 0) this._kickoff(this.kickoffTeam);
      return;
    }

    this.frame++;
    if (this.kickGrace > 0) this.kickGrace--;
    const minute = Math.min(90, Math.floor((this.frame / this.totalFrames) * 90));
    if (minute !== this._lastMinute) {
      this._lastMinute = minute;
      if (this.onTick) this.onTick(minute);
    }

    const all = [...this.home, ...this.away];
    all.forEach(p => {
      if (p.noCapture > 0) p.noCapture--;
      if (p.tackleCd > 0) p.tackleCd--;
    });

    // 1. Human input (home user, and the online away user if present)
    if (this.userPlayer) this._applyHuman(this.userPlayer, inp);
    this._handleRemote(remoteAwayInput);

    // 2. AI for everybody else
    this._runAI();

    // 3. Movement, ball, contests
    this._integrate(all);
    this.ball.update();
    this._tackles();
    this._capture();

    const goal = this._checkGoal();
    if (goal) { this._handleGoal(goal); return; }

    this._autoSwitch('home');
    if (this.awayHuman) this._autoSwitch('away');

    if (this.frame >= this.totalFrames) this.finished = true;
  }

  _integrate(all) {
    for (const p of all) {
      p.x += p.vx; p.y += p.vy;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0.35) {
        p.fx += (p.vx / sp - p.fx) * 0.2;
        p.fy += (p.vy / sp - p.fy) * 0.2;
        const len = Math.hypot(p.fx, p.fy) || 1;
        p.fx /= len; p.fy /= len;
      }
    }
    // Soft separation so players don't stack on top of each other
    const baseMin = PLAYER_R * 1.7;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const gkPair = a.role === 'GK' || b.role === 'GK';
        const min = gkPair && a.team !== b.team ? PLAYER_R * 3 : baseMin;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy);
        if (dd < min && dd > 0.01) {
          const push = ((min - dd) / dd) * (gkPair ? 0.5 : 0.25);
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
    for (const p of all) {
      p.x = clamp(p.x, PLAYER_R, PITCH_W - PLAYER_R);
      p.y = clamp(p.y, PLAYER_R, PITCH_H - PLAYER_R);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _readInput(keys) {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
    const jx = keys.joystickX || 0, jy = keys.joystickY || 0;
    if (Math.abs(jx) > 0.15) dx += jx;
    if (Math.abs(jy) > 0.15) dy += jy;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }

    const inp = {
      dx, dy,
      sprint: !!keys.Shift,
      pass: !!(keys._passDown || this._touch.pass),
      shoot: !!(keys._shootDown || this._touch.shoot),
      sw: !!(keys._tabDown || this._touch.sw),
    };
    keys._passDown = false; keys._shootDown = false; keys._tabDown = false;
    this._touch.pass = this._touch.shoot = this._touch.sw = false;
    return inp;
  }

  _applyHuman(p, inp) {
    const mag = Math.hypot(inp.dx, inp.dy);
    if (mag > 0.05) {
      const sp = p.maxSpeed * (inp.sprint ? 1.25 : 1) * (p.hasBall ? 0.93 : 1) * Math.min(1, mag);
      this._accel(p, (inp.dx / mag) * sp, (inp.dy / mag) * sp, 0.3);
    } else {
      this._accel(p, 0, 0, 0.35);
    }

    const team = p.team;
    const teamHasBall = this.ball.owner && this.ball.owner.team === team;
    if (inp.sw) {
      const near = this._nearestToBall(team);
      const cur = team === 'home' ? this.userPlayer : this.awayUserPlayer;
      if (near && near !== cur) this._setUser(team, near);
      else {
        const others = (team === 'home' ? this.home : this.away)
          .filter(q => q !== cur && q.role !== 'GK')
          .sort((a, b) => dist(a.x, a.y, this.ball.x, this.ball.y) - dist(b.x, b.y, this.ball.x, this.ball.y));
        if (others[0]) this._setUser(team, others[0]);
      }
      return;
    }

    if (inp.pass && !p.hasBall && !teamHasBall) this._humanTackle(p);

    if (inp.shoot) p.bufShoot = 10;
    else if (inp.pass) p.bufPass = 10;
    if (p.bufShoot > 0) p.bufShoot--;
    if (p.bufPass > 0) p.bufPass--;
    if (!p.hasBall) return;
    // A press made a few frames before regaining the ball still counts
    if (p.bufShoot > 0) { p.bufShoot = 0; this._shoot(p, inp.dx, mag > 0.3); }
    else if (p.bufPass > 0) {
      p.bufPass = 0;
      const aim = mag > 0.3 ? { x: inp.dx / mag, y: inp.dy / mag } : { x: p.fx, y: p.fy };
      this._pass(p, aim);
    }
  }

  _handleRemote(r) {
    if (!r) return;
    if (r.hb !== this._lastHb) { this._lastHb = r.hb; this._lastHbFrame = this.frame; }
    const stale = this.frame - this._lastHbFrame > 180;
    if (stale) {
      if (this.awayHuman) {
        this.awayHuman = false;
        if (this.awayUserPlayer) { this.awayUserPlayer.isUser = false; this.awayUserPlayer = null; }
      }
      return;
    }
    if (!this.awayHuman) {
      this.awayHuman = true;
      this._setUser('away', this._nearestToBall('away'));
    }
    const p = this.awayUserPlayer; if (!p) return;
    const inp = {
      dx: r.dx || 0, dy: r.dy || 0, sprint: !!r.sprint,
      pass: (r.passSeq || 0) > this._remoteSeq.pass,
      shoot: (r.shootSeq || 0) > this._remoteSeq.shoot,
      sw: (r.swSeq || 0) > this._remoteSeq.sw,
    };
    this._remoteSeq.pass = Math.max(this._remoteSeq.pass, r.passSeq || 0);
    this._remoteSeq.shoot = Math.max(this._remoteSeq.shoot, r.shootSeq || 0);
    this._remoteSeq.sw = Math.max(this._remoteSeq.sw, r.swSeq || 0);
    this._applyHuman(p, inp);
  }

  triggerShoot() { this._touch.shoot = true; }
  triggerPass() { this._touch.pass = true; }
  triggerSwitch() { this._touch.sw = true; }

  _autoSwitch(team) {
    const cur = team === 'home' ? this.userPlayer : this.awayUserPlayer;
    const b = this.ball;
    if (b.owner && b.owner.team === team) {
      if (b.owner !== cur && b.owner.role !== 'GK') this._setUser(team, b.owner);
      return;
    }
    if (!b.owner && b.receiver && b.receiver.team === team) {
      this._setUser(team, b.receiver);
      return;
    }
    if (this.frame % 10 !== 0 || !cur) return;
    const near = this._nearestToBall(team);
    if (near && near !== cur && dist(near.x, near.y, b.x, b.y) + 30 < dist(cur.x, cur.y, b.x, b.y)) {
      this._setUser(team, near);
    }
  }

  // ── Steering ───────────────────────────────────────────────────────────────

  _accel(p, dvx, dvy, k) {
    p.vx += (dvx - p.vx) * k;
    p.vy += (dvy - p.vy) * k;
  }

  _steer(p, tx, ty, mult = 1, arrive = true) {
    const dx = tx - p.x, dy = ty - p.y;
    const dd = Math.hypot(dx, dy);
    let sp = 0;
    if (dd > 2) {
      sp = p.maxSpeed * mult;
      if (arrive) sp *= Math.min(1, dd / 25);
    }
    this._accel(p, dd > 0 ? (dx / dd) * sp : 0, dd > 0 ? (dy / dd) * sp : 0, 0.2);
  }

  // ── AI ─────────────────────────────────────────────────────────────────────

  _runAI() {
    const ball = this.ball;
    const ownerTeam = ball.owner ? ball.owner.team : null;

    for (const team of ['home', 'away']) {
      const players = team === 'home' ? this.home : this.away;
      const chasers = new Map();

      const field = players
        .filter(p => p.role !== 'GK' && !this._isHuman(p) && !p.hasBall)
        .sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y));

      if (ownerTeam && ownerTeam !== team) {
        if (this.kickGrace <= 0) field.slice(0, 2).forEach((p, i) => chasers.set(p, i === 0 ? 1 : 0.9));
      } else if (!ownerTeam) {
        const recv = ball.receiver;
        if (recv && recv.team === team) { if (!this._isHuman(recv)) chasers.set(recv, 1); }
        else if (field[0]) chasers.set(field[0], 1);
      }

      // Goal-side man marking while the other team has the ball
      const marks = new Map();
      if (ownerTeam && ownerTeam !== team && this.kickGrace <= 0) {
        const threats = (team === 'home' ? this.away : this.home).filter(o => o.role !== 'GK' && !o.hasBall);
        const taken = new Set();
        const markers = players.filter(p => p.role !== 'GK' && !this._isHuman(p) && !p.hasBall && !chasers.has(p));
        for (const m of markers) {
          let best = null, bd = Infinity;
          for (const o of threats) {
            if (taken.has(o)) continue;
            const dd = dist(o.x, o.y, m.baseX, m.baseY);
            if (dd < bd && dd < 190) { bd = dd; best = o; }
          }
          if (best) { taken.add(best); marks.set(m, best); }
        }
      }

      for (const p of players) {
        if (this._isHuman(p)) continue;
        if (p.role === 'GK') this._aiKeeper(p);
        else if (p.hasBall) this._aiCarrier(p);
        else if (chasers.has(p)) this._aiChase(p, chasers.get(p), chasers.get(p) === 1);
        else {
          const t = this._formationTarget(p, ownerTeam);
          const o = marks.get(p);
          if (o) {
            const ownGoalDir = team === 'home' ? 1 : -1;
            const mx = o.x * 0.7 + t.x * 0.3;
            const my = clamp(o.y + ownGoalDir * 22, 60, PITCH_H - 60) * 0.7 + t.y * 0.3;
            this._steer(p, mx, my, 0.85);
          } else {
            const s = ownerTeam === team ? this._spread(p, t, players) : t;
            this._steer(p, s.x, s.y, 0.8);
          }
        }
      }
    }
  }

  // Keeps team-mates from bunching up: pushes the target away from nearby team-mates and the ball carrier
  _spread(p, t, players) {
    let x = t.x, y = t.y;
    for (const q of players) {
      if (q === p || q.role === 'GK') continue;
      const dx = x - q.x, dy = y - q.y, dd = Math.hypot(dx, dy);
      const need = q.hasBall ? 70 : 48;
      if (dd < need && dd > 0.1) { x += (dx / dd) * (need - dd) * 0.8; y += (dy / dd) * (need - dd) * 0.8; }
      else if (dd <= 0.1) x += 30;
    }
    return { x: clamp(x, PLAYER_R + 4, PITCH_W - PLAYER_R - 4), y: clamp(y, 130, PITCH_H - 130) };
  }

  _aiChase(p, mult, press = true) {
    const b = this.ball;
    if (b.owner) {
      const c = b.owner;
      if (press) {
        this._steer(p, c.x + c.vx * 5, c.y + c.vy * 5, mult, false);
      } else {
        // Second defender jockeys at a distance instead of piling onto the carrier
        const dx = p.x - c.x, dy = p.y - c.y, dd = Math.hypot(dx, dy) || 1;
        this._steer(p, c.x + (dx / dd) * 38, c.y + (dy / dd) * 38, mult, true);
      }
    } else {
      this._steer(p, b.x + b.vx * 6, b.y + b.vy * 6, mult, false);
    }
  }

  _formationTarget(p, ownerTeam) {
    const b = this.ball;
    const atk = p.team === 'home' ? -1 : 1;
    const progress = p.team === 'home' ? 1 - p.baseY / PITCH_H : p.baseY / PITCH_H;
    let ty = p.baseY + (b.y - PITCH_H / 2) * 0.28;
    const tx = p.baseX + (b.x - PITCH_W / 2) * 0.22;
    if (ownerTeam === p.team) ty += atk * progress * 45;
    else if (ownerTeam) ty -= atk * progress * 25;
    return {
      x: clamp(tx, PLAYER_R + 4, PITCH_W - PLAYER_R - 4),
      y: clamp(ty, 120, PITCH_H - 120),
    };
  }

  _aiCarrier(p) {
    const atk = p.team === 'home' ? -1 : 1;
    const goalY = atk < 0 ? 0 : PITCH_H;
    const opps = p.team === 'home' ? this.away : this.home;
    const dg = dist(p.x, p.y, PITCH_W / 2, goalY);

    p.hold++;
    if (p.think > 0) p.think--;

    let near = null, nd = Infinity;
    for (const o of opps) {
      const dd = dist(o.x, o.y, p.x, p.y);
      if (dd < nd) { nd = dd; near = o; }
    }

    if (dg < 95 && nd > 14) { this._shoot(p, 0, false); return; }

    if (p.think <= 0) {
      p.think = 10;
      if (SHOOTER_ROLES.includes(p.role) && dg < 170 && nd > 20) {
        if (Math.random() < (dg < 125 ? 0.3 : 0.1)) { this._shoot(p, 0, false); return; }
      }
      const pressured = nd < 30;
      if (p.hold > (MIN_HOLD[p.role] || 30) && ((pressured && Math.random() < 0.7) || Math.random() < 0.18)) {
        if (this._pass(p, null)) return;
      }
    }

    let tx = PITCH_W / 2 + (p.baseX - PITCH_W / 2) * 0.5;
    const ty = p.y + atk * 80;
    if (near && nd < 60 && (near.y - p.y) * atk > 0) tx = p.x + (p.x >= near.x ? 1 : -1) * 60;
    this._steer(p, tx, ty, 0.92, false);
  }

  _aiKeeper(p) {
    const b = this.ball;
    const atk = p.team === 'home' ? -1 : 1;
    const gkY = p.team === 'home' ? PITCH_H - PLAYER_R - 6 : PLAYER_R + 6;

    if (p.hasBall) {
      p.hold++;
      this._steer(p, PITCH_W / 2, gkY, 0.5);
      if (p.hold > 55) this._pass(p, null);
      return;
    }

    const towardMe = b.vy * (p.team === 'home' ? 1 : -1) > 1.5;
    if (!b.owner && towardMe && b.lastTeam !== p.team && Math.abs(b.vy) > 4) {
      const t = Math.min(40, Math.max(0, (gkY - b.y) / b.vy));
      const px = clamp(b.x + b.vx * t, GOAL_X_MIN + 6, GOAL_X_MAX - 6);
      this._steer(p, px, gkY, 1.6);
      return;
    }

    const inBox = Math.abs(b.x - PITCH_W / 2) < 85 && (p.team === 'home' ? b.y > PITCH_H - 105 : b.y < 105);
    if (inBox && !b.owner && dist(p.x, p.y, b.x, b.y) < 90 && !(b.receiver && b.receiver.team === p.team)) {
      this._steer(p, b.x, b.y, 1.1);
      return;
    }

    const distBallToGoal = p.team === 'home' ? PITCH_H - b.y : b.y;
    const tx = clamp(PITCH_W / 2 + (b.x - PITCH_W / 2) * 0.35, GOAL_X_MIN + 10, GOAL_X_MAX - 10);
    const ty = gkY + atk * Math.min(35, Math.max(0, distBallToGoal - 150) * 0.12);
    this._steer(p, tx, ty, 0.9);
  }

  // ── Pass & shoot ───────────────────────────────────────────────────────────

  _laneBlocked(p, t, opps) {
    const sx = t.x - p.x, sy = t.y - p.y;
    const len2 = sx * sx + sy * sy || 1;
    for (const o of opps) {
      const u = ((o.x - p.x) * sx + (o.y - p.y) * sy) / len2;
      if (u < 0.15 || u > 0.9) continue;
      if (dist(o.x, o.y, p.x + sx * u, p.y + sy * u) < 14) return true;
    }
    return false;
  }

  // aim = unit vector chosen by a human; null lets the AI choose a forward pass
  _pass(p, aim) {
    const mates = (p.team === 'home' ? this.home : this.away).filter(t => t !== p && t.role !== 'GK');
    const opps = p.team === 'home' ? this.away : this.home;
    const atk = p.team === 'home' ? -1 : 1;

    let best = null, bs = -Infinity;
    for (const t of mates) {
      const dx = t.x - p.x, dy = t.y - p.y;
      const dd = Math.hypot(dx, dy);
      if (dd < 35 || dd > 330) continue;
      let s;
      if (aim) {
        const cos = (dx * aim.x + dy * aim.y) / dd;
        if (cos < 0.6) continue; // only teammates roughly in the chosen direction
        s = cos * 220 - dd * 0.08;
        if (opps.some(o => dist(o.x, o.y, t.x, t.y) < 28)) s -= 25;
        if (this._laneBlocked(p, t, opps)) s -= 35;
      } else {
        s = (dy * atk / dd) * 60 + clamp((t.y - p.y) * atk * 0.15, -40, 40) - dd * 0.12;
        if (opps.some(o => dist(o.x, o.y, t.x, t.y) < 28)) s -= 70;
        if (this._laneBlocked(p, t, opps)) s -= 80;
      }
      if (s > bs) { bs = s; best = t; }
    }
    if (!best) {
      if (!aim) return false;
      // Nobody in that direction: play the ball into space where the player pointed
      this._kick(p, aim.x, aim.y, 8, 0.03);
      return true;
    }

    const dd = dist(p.x, p.y, best.x, best.y);
    const lead = Math.min(45, dd / 6);
    this._kick(p, best.x + best.vx * lead - p.x, best.y + best.vy * lead - p.y,
      clamp(dd * 0.028 * 1.3, 4.5, 12), ((100 - p.overall) / 100) * 0.14);
    this.ball.receiver = best;
    this.ball.receiverTimer = 100;
    if (this._isHuman(p)) this._setUser(p.team, best);
    return true;
  }

  _shoot(p, dirX, hasDir) {
    const atk = p.team === 'home' ? -1 : 1;
    const goalY = atk < 0 ? 0 : PITCH_H;
    const opps = p.team === 'home' ? this.away : this.home;
    const gk = opps.find(o => o.role === 'GK');
    const dg = dist(p.x, p.y, PITCH_W / 2, goalY);

    let aimX;
    if (hasDir) aimX = PITCH_W / 2 + dirX * GOAL_W * 0.4;
    else {
      const side = gk && gk.x > PITCH_W / 2 ? -1 : 1;
      aimX = PITCH_W / 2 + side * (10 + Math.random() * GOAL_W * 0.32);
    }
    const err = ((100 - p.overall) / 100) * 0.25 + (dg / PITCH_H) * 0.35;
    const power = clamp(12.5 + (p.overall - 70) / 40, 12, 14.5);
    this._kick(p, aimX - p.x, goalY + atk * 20 - p.y, power, err);
    this.ball.shot = true;
  }

  _kick(p, dx, dy, power, errRad) {
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * errRad;
    const b = this.ball;
    b.vx = Math.cos(a) * power; b.vy = Math.sin(a) * power;
    b.x = p.x + Math.cos(a) * (PLAYER_R + BALL_R + 1);
    b.y = p.y + Math.sin(a) * (PLAYER_R + BALL_R + 1);
    b.owner = null; b.lastTeam = p.team;
    b.receiver = null; b.shot = false; b.saveTried = false;
    p.hasBall = false; p.noCapture = 20; p.hold = 0;
  }

  // ── Contests ───────────────────────────────────────────────────────────────

  // Human tackle / interception: a button press when close enough to the carrier or the ball.
  _humanTackle(p) {
    if (p.tackleCd > 0) return;
    p.tackleCd = 45;
    const b = this.ball;
    const c = b.owner;
    if (c && c.team !== p.team) {
      if (c.role === 'GK') return;
      if (dist(p.x, p.y, c.x, c.y) > PLAYER_R * 2 + 12) return;
      const ratio = p.overall / c.overall;
      // Approaching from the front or side is easier than chasing from behind
      const front = (p.x - c.x) * c.fx + (p.y - c.y) * c.fy > 0 ? 1 : 0.6;
      if (Math.random() < clamp(0.42 * ratio * ratio * front, 0.1, 0.8)) {
        const dx = p.x - c.x, dy = p.y - c.y, dd = Math.hypot(dx, dy) || 1;
        c.hasBall = false; c.noCapture = 40;
        b.owner = null; b.lastTeam = p.team; b.receiver = null; b.shot = false;
        b.vx = (dx / dd) * 2.5; b.vy = (dy / dd) * 2.5;
        this._give(p);
      }
    } else if (!c && dist(p.x, p.y, b.x, b.y) < PLAYER_R + BALL_R + 16 && b.speed() < 14 && !b.shot) {
      p.noCapture = 0;
      this._give(p); // well-timed press cuts out a pass or loose ball
    }
  }

  _tackles() {
    const c = this.ball.owner;
    if (!c || c.role === 'GK') return;
    const opps = c.team === 'home' ? this.away : this.home;
    for (const o of opps) {
      if (this._isHuman(o)) continue; // human defenders must press the button
      if (o.tackleCd > 0 || o.noCapture > 0) continue;
      if (dist(o.x, o.y, c.x, c.y) > PLAYER_R * 2 + 3) continue;
      o.tackleCd = 20;
      const ratio = o.overall / c.overall;
      if (Math.random() < 0.5 * ratio * ratio) {
        const dx = o.x - c.x, dy = o.y - c.y, dd = Math.hypot(dx, dy) || 1;
        const b = this.ball;
        c.hasBall = false; c.noCapture = 40;
        b.owner = null; b.lastTeam = o.team;
        b.receiver = null; b.shot = false;
        b.vx = (dx / dd) * 2.5; b.vy = (dy / dd) * 2.5;
        return;
      }
    }
  }

  _capture() {
    const b = this.ball;
    if (b.owner) return;
    this._keeperDive();
    if (b.owner) return;
    const speed = b.speed();
    let best = null, bd = Infinity;

    for (const p of [...this.home, ...this.away]) {
      if (p.noCapture > 0) continue;
      const reach = PLAYER_R + BALL_R + (p.role === 'GK' ? 9 : 3);
      const dd = dist(p.x, p.y, b.x, b.y);
      if (dd > reach) continue;
      if (this._isHuman(p) && b.lastTeam !== p.team && speed > 3) continue; // must press to cut out a pass
      if (p.role === 'GK' && speed > 6.5 && b.shot && b.lastTeam !== p.team) continue; // handled by the dive
      if (p.role === 'GK' && speed > 6.5 && b.lastTeam === p.team) continue;
      if (p.role !== 'GK' && speed > FAST_BALL) {
        if (p.team === b.lastTeam || Math.random() > 0.22) continue;
      }
      if (dd < bd) { bd = dd; best = p; }
    }
    if (best) this._give(best);
  }

  // A shot heading into goal is checked against where it will cross the keeper's line,
  // so fast shots can't tunnel past the keeper between two frames.
  _keeperDive() {
    const b = this.ball;
    if (!b.shot || b.saveTried || b.owner) return;
    const team = b.lastTeam === 'home' ? 'away' : 'home';
    const gk = (team === 'home' ? this.home : this.away)[0];
    if (!gk || gk.role !== 'GK') return;
    const lineY = team === 'home' ? PITCH_H - PLAYER_R - 6 : PLAYER_R + 6;
    const toward = team === 'home' ? b.vy > 0 : b.vy < 0;
    const gap = (team === 'home' ? lineY - b.y : b.y - lineY);
    if (!toward || gap > Math.max(14, Math.abs(b.vy) * 1.2)) return; // gap < 0 means already past the line

    b.saveTried = true;
    const crossX = b.x;
    const lateral = Math.abs(crossX - gk.x);
    const reach = 44 + gk.overall / 6; // diving reach in px
    if (lateral > reach) return;
    const shooterOvr = 75;
    const prob = clamp(0.93 + (gk.overall - shooterOvr) / 250 - (lateral / reach) * 0.2, 0.6, 0.97);
    if (Math.random() > prob) return;
    gk.x = crossX; gk.y = lineY;
    if (Math.random() < 0.6) { this._give(gk); return; }
    b.vy = -b.vy * 0.45; b.vx += (Math.random() - 0.5) * 5;
    b.shot = false; b.lastTeam = gk.team; gk.noCapture = 15;
  }

  // ── Goals ──────────────────────────────────────────────────────────────────

  _checkGoal() {
    const b = this.ball;
    if (b.owner) return null;
    if (b.x > GOAL_X_MIN && b.x < GOAL_X_MAX) {
      if (b.y < -2) return 'home';
      if (b.y > PITCH_H + 2) return 'away';
    }
    return null;
  }

  _handleGoal(team) {
    if (team === 'home') this.homeScore++; else this.awayScore++;
    this.lastGoalTeam = team;
    this.goalFlash = 70;
    this.goalPause = 110;
    this.kickoffTeam = team === 'home' ? 'away' : 'home';
    const b = this.ball;
    b.vx = 0; b.vy = 0; b.owner = null; b.receiver = null; b.shot = false;
    [...this.home, ...this.away].forEach(p => { p.hasBall = false; p.vx = 0; p.vy = 0; });
    if (this.onGoal) this.onGoal(this.homeScore, this.awayScore, team);
  }

  // ── Online sync ────────────────────────────────────────────────────────────

  getSerializableState() {
    const r1 = v => Math.round(v * 10) / 10;
    const r2 = v => Math.round(v * 100) / 100;
    const pk = p => [r1(p.x), r1(p.y), r2(p.fx), r2(p.fy)];
    const o = this.ball.owner;
    return {
      h: this.home.map(pk),
      a: this.away.map(pk),
      b: [r1(this.ball.x), r1(this.ball.y), o ? (o.team === 'home' ? o.idx : 11 + o.idx) : -1],
      hs: this.homeScore, as: this.awayScore,
      m: Math.min(90, Math.floor((this.frame / this.totalFrames) * 90)),
      f: this.finished,
      hu: this.userPlayer ? this.userPlayer.idx : -1,
      au: this.awayUserPlayer ? this.awayUserPlayer.idx : -1,
      gf: this.goalFlash,
      gt: this.lastGoalTeam || '',
    };
  }

  applyRemoteState(s) {
    if (!s || !this.home.length) return;
    const apply = (list, arr) => {
      if (!arr) return;
      list.forEach((p, i) => {
        const v = arr[i]; if (!v) return;
        p.tx = v[0]; p.ty = v[1]; p.fx = v[2]; p.fy = v[3];
      });
    };
    apply(this.home, s.h);
    apply(this.away, s.a);

    const all = [...this.home, ...this.away];
    all.forEach(p => { p.hasBall = false; });
    this.ball.owner = null;
    if (s.b) {
      this.ball.tx = s.b[0]; this.ball.ty = s.b[1];
      const oi = s.b[2];
      if (oi >= 0) {
        const o = oi < 11 ? this.home[oi] : this.away[oi - 11];
        if (o) { o.hasBall = true; this.ball.owner = o; }
      }
    }

    if (s.hu >= 0 && this.home[s.hu]) {
      if (this.userPlayer) this.userPlayer.isUser = false;
      this.userPlayer = this.home[s.hu]; this.userPlayer.isUser = true;
    }
    if (s.au >= 0 && this.away[s.au]) this._setUser('away', this.away[s.au]);

    if (s.gt) this.lastGoalTeam = s.gt;
    this.goalFlash = s.gf || 0;
    if (s.hs !== this.homeScore || s.as !== this.awayScore) {
      this.homeScore = s.hs; this.awayScore = s.as;
      if (this.onGoal) this.onGoal(this.homeScore, this.awayScore, s.gt || null);
    }
    if (s.m !== undefined && s.m !== this._lastMinute) {
      this._lastMinute = s.m;
      if (this.onTick) this.onTick(s.m);
    }
    if (s.f) this.finished = true;
  }

  _clientUpdate(inp) {
    this._clientInput = { dx: inp.dx, dy: inp.dy, sprint: inp.sprint };
    if (inp.pass) this._seq.pass++;
    if (inp.shoot) this._seq.shoot++;
    if (inp.sw) this._seq.sw++;

    for (const p of [...this.home, ...this.away]) {
      p.x += (p.tx - p.x) * 0.35;
      p.y += (p.ty - p.y) * 0.35;
    }
    const b = this.ball;
    b.x += (b.tx - b.x) * 0.5;
    b.y += (b.ty - b.y) * 0.5;
  }

  getAwayClientInput() {
    this._hb++;
    return {
      dx: Math.round(this._clientInput.dx * 100) / 100,
      dy: Math.round(this._clientInput.dy * 100) / 100,
      sprint: this._clientInput.sprint,
      passSeq: this._seq.pass,
      shootSeq: this._seq.shoot,
      swSeq: this._seq.sw,
      hb: this._hb,
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, PITCH_W, PITCH_H);
    this._drawPitch(ctx);
    this._drawGoals(ctx);
    this._drawPlayers(ctx);
    this._drawBall(ctx);
    if (this.goalFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.goalFlash / 70) * 0.35})`;
      ctx.fillRect(0, 0, PITCH_W, PITCH_H);
      ctx.save();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
      ctx.fillText('GOAL!', PITCH_W / 2, PITCH_H / 2 - 10);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(this.lastGoalTeam === 'home' ? this.homeClub : this.awayClub, PITCH_W / 2, PITCH_H / 2 + 24);
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

    const penW = 170, penH = 105, penX = (PITCH_W - penW) / 2;
    ctx.strokeRect(penX, 2, penW, penH);
    ctx.strokeRect(penX, PITCH_H - penH - 2, penW, penH);
    const sixW = 80, sixH = 38, sixX = (PITCH_W - sixW) / 2;
    ctx.strokeRect(sixX, 2, sixW, sixH);
    ctx.strokeRect(sixX, PITCH_H - sixH - 2, sixW, sixH);
  }

  _drawGoals(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(GOAL_X_MIN, -GOAL_D, GOAL_W, GOAL_D + 2);
    ctx.fillRect(GOAL_X_MIN, PITCH_H - 2, GOAL_W, GOAL_D);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.strokeRect(GOAL_X_MIN, -GOAL_D, GOAL_W, GOAL_D);
    ctx.strokeRect(GOAL_X_MIN, PITCH_H, GOAL_W, GOAL_D);
  }

  _drawPlayers(ctx) {
    const all = [...this.home, ...this.away].sort((a, b) => a.y - b.y);
    for (const p of all) {
      const isHome = p.team === 'home';
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + PLAYER_R * 0.8, PLAYER_R, PLAYER_R * 0.45, 0, 0, Math.PI * 2); ctx.fill();

      const gk = p.role === 'GK';
      ctx.fillStyle = gk ? (isHome ? '#f2c94c' : '#27ae60') : (isHome ? '#2f80ed' : '#e5484d');
      ctx.strokeStyle = isHome ? '#1b4f9c' : '#9c2226'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(p.x + p.fx * PLAYER_R * 0.55, p.y + p.fy * PLAYER_R * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#fff'; ctx.font = `bold ${PLAYER_R - 3}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.idx + 1), p.x - p.fx * 1.5, p.y - p.fy * 1.5 + 0.5);

      if (p.isUser && (isHome || this.awayHuman || this.isAwayClient)) {
        ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - PLAYER_R - 6);
        ctx.lineTo(p.x - 5, p.y - PLAYER_R - 14);
        ctx.lineTo(p.x + 5, p.y - PLAYER_R - 14);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  _drawBall(ctx) {
    const b = this.ball;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + BALL_R, BALL_R * 0.8, BALL_R * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfcfcf');
    ctx.fillStyle = g; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  static get PITCH_W() { return PITCH_W; }
  static get PITCH_H() { return PITCH_H; }
}
