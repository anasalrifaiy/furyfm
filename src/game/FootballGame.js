// Pure JS Canvas football game engine — no React, no Firebase.
// Runs at 60fps via requestAnimationFrame in MatchGame.js.

const PITCH_W = 400;
const PITCH_H = 580;
const GOAL_W = 120;
const GOAL_D = 18;
const PLAYER_R = 14;
const BALL_R = 9;
const MATCH_REAL_SECONDS = 180; // 3 real min = 90 game min
const BALL_FRICTION = 0.965;
const PLAYER_BASE_SPEED = 2.8;
const PASS_POWER = 9;
const SHOOT_POWER = 13;
const GOAL_X_MIN = PITCH_W / 2 - GOAL_W / 2;
const GOAL_X_MAX = PITCH_W / 2 + GOAL_W / 2;

// Formation positions (percentages, same as Match.js lines 43-79)
const FORMATIONS = {
  '4-3-3': [
    { pos: 'GK',  x: 50, y: 95 },
    { pos: 'LB',  x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB',  x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'CDM', x: 50, y: 55 },
    { pos: 'CM',  x: 28, y: 45 }, { pos: 'CM', x: 72, y: 45 },
    { pos: 'LW',  x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 },
  ],
  '4-4-2': [
    { pos: 'GK', x: 50, y: 95 },
    { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
    { pos: 'LM', x: 18, y: 48 }, { pos: 'CM', x: 37, y: 52 }, { pos: 'CM', x: 63, y: 52 }, { pos: 'RM', x: 82, y: 48 },
    { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
  ],
  '3-5-2': [
    { pos: 'GK',  x: 50, y: 95 },
    { pos: 'CB',  x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
    { pos: 'LWB', x: 12, y: 52 }, { pos: 'CDM', x: 50, y: 55 }, { pos: 'CM', x: 32, y: 48 }, { pos: 'CM', x: 68, y: 48 }, { pos: 'RWB', x: 88, y: 52 },
    { pos: 'ST',  x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 },
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

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Ball ────────────────────────────────────────────────────────────────────

class Ball {
  constructor() {
    this.x = PITCH_W / 2;
    this.y = PITCH_H / 2;
    this.vx = 0;
    this.vy = 0;
    this.owner = null;
    this.trail = []; // last few free positions for motion trail
  }

  kick(dirX, dirY, power) {
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    this.vx = (dirX / len) * power;
    this.vy = (dirY / len) * power;
    this.owner = null;
  }

  update() {
    if (this.owner) {
      // Stick to carrier's forward-facing offset
      this.x = this.owner.x + this.owner.facingX * (PLAYER_R + BALL_R + 2);
      this.y = this.owner.y + this.owner.facingY * (PLAYER_R + BALL_R + 2);
      this.vx = 0;
      this.vy = 0;
      this.trail = [];
      return;
    }

    // Record trail when moving fast
    const speed = Math.abs(this.vx) + Math.abs(this.vy);
    if (speed > 6) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 4) this.trail.shift();
    } else {
      this.trail = [];
    }

    this.x += this.vx;
    this.y += this.vy;
    this.vx *= BALL_FRICTION;
    this.vy *= BALL_FRICTION;

    // Bounce off side walls (not top/bottom — those are goal lines)
    if (this.x < BALL_R) {
      this.x = BALL_R;
      this.vx *= -0.65;
    } else if (this.x > PITCH_W - BALL_R) {
      this.x = PITCH_W - BALL_R;
      this.vx *= -0.65;
    }

    // Stop nearly-still ball
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
  }

  reset() {
    this.x = PITCH_W / 2;
    this.y = PITCH_H / 2;
    this.vx = 0;
    this.vy = 0;
    this.owner = null;
    this.trail = [];
  }
}

// ─── Player ──────────────────────────────────────────────────────────────────

class Player {
  constructor(team, index, x, y, position, name, overall) {
    this.team = team;
    this.index = index;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.vx = 0;
    this.vy = 0;
    this.position = position;
    this.name = name;
    this.overall = Math.max(50, Math.min(99, overall || 75));
    this.hasBall = false;
    this.isUserControlled = false;
    // Home attacks up (vy = -1), away attacks down (vy = 1)
    this.facingX = 0;
    this.facingY = team === 'home' ? -1 : 1;
    this.speed = PLAYER_BASE_SPEED * (0.75 + this.overall / 300);
    this.sprintMult = 1;
  }

  moveToward(tx, ty, speedMult = 1) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return;
    const step = Math.min(this.speed * speedMult, d);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.facingX = dx / d;
    this.facingY = dy / d;
  }

  tryCaptureBall(ball) {
    if (ball.owner !== null) return false;
    const d = dist(this.x, this.y, ball.x, ball.y);
    if (d < PLAYER_R + BALL_R + 4) {
      ball.owner = this;
      this.hasBall = true;
      return true;
    }
    return false;
  }

  releaseBall() {
    this.hasBall = false;
  }
}

// ─── FootballGame ─────────────────────────────────────────────────────────────

export class FootballGame {
  constructor() {
    this.homePlayers = [];
    this.awayPlayers = [];
    this.ball = new Ball();
    this.homeScore = 0;
    this.awayScore = 0;
    this.frameCount = 0;
    this.totalFrames = MATCH_REAL_SECONDS * 60;
    this.finished = false;
    this.isHost = true;
    this.userPlayer = null;  // home controlled player
    this.awayUserPlayer = null; // away controlled player (when receiving remote)

    this.goalFlash = 0; // frames remaining for white flash
    this.goalPause = 0; // frames to pause after a goal
    this.lastGoalTeam = null;

    this.homeClub = 'Home';
    this.awayClub = 'Away';

    // Callbacks set by MatchGame.js
    this.onGoal = null;
    this.onTick = null;
    this.onControlSwitch = null;

    // Remote away input (host reads this each frame)
    this.remoteAwayInput = null;

    // Received game state (away client sets this via applyRemoteState)
    this._remoteState = null;
    this._isAwayClient = false;
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  start(homeSquad, awaySquad, homeFormation, awayFormation, isHost, homeClub, awayClub) {
    this.isHost = isHost !== false;
    this._isAwayClient = !this.isHost;
    this.homeClub = homeClub || 'Home';
    this.awayClub = awayClub || 'Away';

    this.homePlayers = this._spawnPlayers(homeSquad, homeFormation, 'home');
    this.awayPlayers = this._spawnPlayers(awaySquad, awayFormation, 'away');

    // User controls the best attacker on the home team (or away team if away client)
    if (!this._isAwayClient) {
      this.userPlayer = this._bestAttacker(this.homePlayers);
      this.userPlayer.isUserControlled = true;
    } else {
      this.awayUserPlayer = this._bestAttacker(this.awayPlayers);
      this.awayUserPlayer.isUserControlled = true;
    }

    // Kick off
    this.ball.reset();
    this._assignBallToKickOff();

    if (this.onControlSwitch && this.userPlayer) {
      this.onControlSwitch(this.userPlayer.name);
    }
  }

  _spawnPlayers(squad, formation, team) {
    const layout = FORMATIONS[formation] || FORMATIONS['4-3-3'];
    const players = [];
    const squadArr = Array.isArray(squad) ? squad.slice(0, 11) : [];

    for (let i = 0; i < 11; i++) {
      const f = layout[i] || layout[0];
      let px, py;
      if (team === 'home') {
        px = (f.x / 100) * PITCH_W;
        py = (f.y / 100) * PITCH_H;
      } else {
        px = ((100 - f.x) / 100) * PITCH_W;
        py = ((100 - f.y) / 100) * PITCH_H;
      }

      const sq = squadArr[i];
      const name = sq ? sq.name : `Player ${i + 1}`;
      const overall = sq ? (sq.overall || 75) : 75;
      const pos = sq ? (sq.position || f.pos) : f.pos;

      players.push(new Player(team, i, px, py, pos, name, overall));
    }
    return players;
  }

  _bestAttacker(players) {
    const attackers = players.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position));
    const pool = attackers.length > 0 ? attackers : players;
    return pool.reduce((best, p) => (p.overall > best.overall ? p : best), pool[0]);
  }

  _assignBallToKickOff() {
    // Give ball to home center forward at kickoff
    const st = this.homePlayers.find(p => p.position === 'ST') || this.homePlayers[9];
    if (st) {
      this.ball.owner = st;
      st.hasBall = true;
      // Move ST to center for kickoff
      st.x = PITCH_W / 2;
      st.y = PITCH_H / 2 + 10;
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  update(keys, remoteAwayInput) {
    if (this.finished) return;

    // Away client: just render received state
    if (this._isAwayClient) {
      this._handleAwayClientInput(keys);
      return;
    }

    // Pause after goal
    if (this.goalPause > 0) {
      this.goalPause--;
      if (this.goalFlash > 0) this.goalFlash--;
      return;
    }
    if (this.goalFlash > 0) this.goalFlash--;

    this.frameCount++;

    // Notify minute change
    const gameMinute = Math.floor((this.frameCount / this.totalFrames) * 90);
    if (this.onTick) this.onTick(gameMinute);

    // Apply remote away input (multiplayer host)
    if (remoteAwayInput && this.awayUserPlayer) {
      this._applyRemoteInput(this.awayUserPlayer, remoteAwayInput);
    }

    // Handle user input
    this._handleInput(keys);

    // Update all player AI
    this._updateAI();

    // Ball capture attempts (any free player near loose ball)
    if (!this.ball.owner) {
      const all = [...this.homePlayers, ...this.awayPlayers];
      for (const p of all) {
        if (!p.isUserControlled) {
          if (p.tryCaptureBall(this.ball)) {
            p.hasBall = true;
            // Clear previous owner's hasBall flag
            all.forEach(q => { if (q !== p) q.hasBall = false; });
            break;
          }
        }
      }
    }

    // User player tries to capture loose ball
    const controlled = this._isAwayClient ? this.awayUserPlayer : this.userPlayer;
    if (controlled && controlled.tryCaptureBall(this.ball)) {
      controlled.hasBall = true;
      [...this.homePlayers, ...this.awayPlayers].forEach(q => { if (q !== controlled) q.hasBall = false; });
    }

    // Update ball physics
    this.ball.update();

    // Check for goals
    const goal = this._checkGoal();
    if (goal) {
      if (goal === 'home') {
        this.homeScore++;
      } else {
        this.awayScore++;
      }
      this.lastGoalTeam = goal;
      this.goalFlash = 36; // 0.6s flash at 60fps
      this.goalPause = 90; // 1.5s pause
      if (this.onGoal) this.onGoal(this.homeScore, this.awayScore, goal);
      this._resetAfterGoal();
    }

    // Clamp players to pitch
    this._clampPlayers();

    // Match end
    if (this.frameCount >= this.totalFrames) {
      this.finished = true;
    }
  }

  _handleInput(keys) {
    const p = this.userPlayer;
    if (!p) return;

    const jx = keys.joystickX || 0;
    const jy = keys.joystickY || 0;

    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A'] || jx < -0.2) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || jx > 0.2)  dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W'] || jy < -0.2) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S'] || jy > 0.2)  dy += 1;

    if (dx !== 0 || dy !== 0) {
      const sprint = keys['Shift'] ? 1.45 : 1;
      p.moveToward(p.x + dx * 40, p.y + dy * 40, sprint);
    }

    // Space / action button
    if (keys['_spaceDown']) {
      keys['_spaceDown'] = false;
      if (p.hasBall) {
        this._userAction(p);
      }
    }

    // Tab = switch control
    if (keys['_tabDown']) {
      keys['_tabDown'] = false;
      this.switchControl();
    }
  }

  _handleAwayClientInput(keys) {
    const p = this.awayUserPlayer;
    if (!p) return;

    const jx = keys.joystickX || 0;
    const jy = keys.joystickY || 0;

    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A'] || jx < -0.2) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || jx > 0.2)  dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W'] || jy < -0.2) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S'] || jy > 0.2)  dy += 1;

    if (dx !== 0 || dy !== 0) {
      const sprint = keys['Shift'] ? 1.45 : 1;
      p.moveToward(p.x + dx * 40, p.y + dy * 40, sprint);
    }

    if (keys['_spaceDown'] && p.hasBall) {
      keys['_spaceDown'] = false;
      this._userAction(p);
    }

    if (keys['_tabDown']) {
      keys['_tabDown'] = false;
      this.switchAwayControl();
    }
  }

  _applyRemoteInput(awayPlayer, input) {
    if (!input || !awayPlayer) return;
    // Smoothly move the away player's position to what remote sent
    const alpha = 0.4; // interpolation factor
    awayPlayer.x += (input.x - awayPlayer.x) * alpha;
    awayPlayer.y += (input.y - awayPlayer.y) * alpha;
    awayPlayer.facingX = input.facingX || awayPlayer.facingX;
    awayPlayer.facingY = input.facingY || awayPlayer.facingY;

    if (input.action === 'shoot' && awayPlayer.hasBall) {
      this._shoot(awayPlayer);
    } else if (input.action === 'pass' && awayPlayer.hasBall) {
      this._pass(awayPlayer);
    }
  }

  _userAction(p) {
    const isHome = p.team === 'home';
    const goalY = isHome ? 0 : PITCH_H; // target goal Y
    const distToGoal = Math.abs(p.y - goalY);

    if (distToGoal < 200) {
      this._shoot(p);
    } else {
      this._pass(p);
    }
  }

  // Public trigger methods for touch buttons
  triggerShoot() {
    const p = this.userPlayer || this.awayUserPlayer;
    if (p && p.hasBall) this._shoot(p);
  }

  triggerPass() {
    const p = this.userPlayer || this.awayUserPlayer;
    if (p && p.hasBall) this._pass(p);
  }

  _shoot(p) {
    const goalY = p.team === 'home' ? 0 : PITCH_H;
    const goalX = PITCH_W / 2 + (Math.random() - 0.5) * GOAL_W * 0.6;
    const dx = goalX - p.x;
    const dy = goalY - p.y;
    const accuracySpread = ((100 - p.overall) / 800) * (PITCH_W / 2);
    const finalX = goalX + (Math.random() - 0.5) * accuracySpread;
    const finalY = goalY + (Math.random() - 0.5) * (accuracySpread * 0.3);
    const power = SHOOT_POWER * (0.8 + p.overall / 500);
    this.ball.kick(finalX - p.x, finalY - p.y, power);
    p.hasBall = false;
    p.releaseBall();
  }

  _pass(p) {
    const teammates = p.team === 'home' ? this.homePlayers : this.awayPlayers;
    const opponents = p.team === 'home' ? this.awayPlayers : this.homePlayers;

    // Find open teammate in a forward arc
    const forwardY = p.team === 'home' ? -1 : 1;
    let best = null;
    let bestScore = -Infinity;

    for (const t of teammates) {
      if (t === p) continue;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < 15 || d > 280) continue;
      const dy = (t.y - p.y) * forwardY;
      const forwardBonus = dy < 0 ? 40 : 0; // prefer passes forward
      const marked = opponents.some(o => dist(o.x, o.y, t.x, t.y) < 35);
      if (marked) continue;
      const score = forwardBonus - d * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    if (!best) {
      // Nearest teammate fallback
      best = teammates.reduce((acc, t) => {
        if (t === p) return acc;
        const d = dist(p.x, p.y, t.x, t.y);
        return d < dist(p.x, p.y, acc.x, acc.y) ? t : acc;
      }, teammates.find(t => t !== p) || p);
    }

    if (best && best !== p) {
      const acc = (100 - p.overall) / 300;
      const jitterX = (Math.random() - 0.5) * acc * 80;
      const jitterY = (Math.random() - 0.5) * acc * 80;
      this.ball.kick(best.x + jitterX - p.x, best.y + jitterY - p.y, PASS_POWER);
      p.hasBall = false;
      p.releaseBall();
    }
  }

  switchControl() {
    if (!this.userPlayer || this._isAwayClient) return;
    const candidates = this.homePlayers.filter(p => p !== this.userPlayer);
    if (!candidates.length) return;

    const nearest = candidates.reduce((best, p) => {
      const db = dist(best.x, best.y, this.ball.x, this.ball.y);
      const dp = dist(p.x, p.y, this.ball.x, this.ball.y);
      return dp < db ? p : best;
    });

    this.userPlayer.isUserControlled = false;
    nearest.isUserControlled = true;
    this.userPlayer = nearest;
    if (this.onControlSwitch) this.onControlSwitch(nearest.name);
  }

  switchAwayControl() {
    if (!this.awayUserPlayer) return;
    const candidates = this.awayPlayers.filter(p => p !== this.awayUserPlayer);
    if (!candidates.length) return;

    const nearest = candidates.reduce((best, p) => {
      const db = dist(best.x, best.y, this.ball.x, this.ball.y);
      const dp = dist(p.x, p.y, this.ball.x, this.ball.y);
      return dp < db ? p : best;
    });

    this.awayUserPlayer.isUserControlled = false;
    nearest.isUserControlled = true;
    this.awayUserPlayer = nearest;
    if (this.onControlSwitch) this.onControlSwitch(nearest.name);
  }

  // ── AI ────────────────────────────────────────────────────────────────────

  _updateAI() {
    const ball = this.ball;
    const ballOwnerTeam = ball.owner ? ball.owner.team : null;

    for (const p of [...this.homePlayers, ...this.awayPlayers]) {
      if (p.isUserControlled) continue;
      if (p.hasBall && ball.owner !== p) p.hasBall = false;

      const myTeam = p.team;
      const myGoalY = myTeam === 'home' ? PITCH_H : 0;
      const oppGoalY = myTeam === 'home' ? 0 : PITCH_H;
      const hasPossession = ballOwnerTeam === myTeam;

      switch (p.position) {
        case 'GK':
          this._aiGK(p, ball, myGoalY, oppGoalY);
          break;
        case 'CB': case 'LB': case 'RB': case 'LWB': case 'RWB':
          this._aiDefender(p, ball, hasPossession, myGoalY, oppGoalY);
          break;
        case 'CDM': case 'CM': case 'LM': case 'RM':
          this._aiMidfielder(p, ball, hasPossession, oppGoalY);
          break;
        case 'CAM': case 'LW': case 'RW': case 'ST':
          this._aiAttacker(p, ball, hasPossession, oppGoalY);
          break;
        default:
          this._aiMidfielder(p, ball, hasPossession, oppGoalY);
      }
    }
  }

  _aiGK(p, ball, myGoalY, oppGoalY) {
    const goalLineY = myGoalY === PITCH_H ? PITCH_H - PLAYER_R - 4 : PLAYER_R + 4;
    const distBallToGoal = Math.abs(ball.y - myGoalY);

    if (p.hasBall) {
      // GK distributes: pass to nearest defender
      const defenders = (p.team === 'home' ? this.homePlayers : this.awayPlayers)
        .filter(q => ['CB', 'LB', 'RB'].includes(q.position));
      if (defenders.length > 0) {
        const target = defenders[Math.floor(Math.random() * defenders.length)];
        this.ball.kick(target.x - p.x, target.y - p.y, PASS_POWER * 0.9);
        p.hasBall = false;
        p.releaseBall();
      }
      return;
    }

    if (distBallToGoal < 120) {
      // Rush to intercept
      p.moveToward(ball.x, ball.y, 1.1);
    } else {
      // Stay on goal line, track ball X
      p.moveToward(Math.max(GOAL_X_MIN + 20, Math.min(GOAL_X_MAX - 20, ball.x)), goalLineY, 0.8);
    }
  }

  _aiDefender(p, ball, hasPossession, myGoalY, oppGoalY) {
    const opponents = p.team === 'home' ? this.awayPlayers : this.homePlayers;

    if (p.hasBall) {
      // Pass to nearest midfielder
      const mids = (p.team === 'home' ? this.homePlayers : this.awayPlayers)
        .filter(q => ['CDM', 'CM', 'LM', 'RM'].includes(q.position));
      if (mids.length > 0) {
        const target = mids.reduce((a, b) =>
          dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b);
        this.ball.kick(target.x - p.x, target.y - p.y, PASS_POWER);
        p.hasBall = false;
        p.releaseBall();
      }
      return;
    }

    // Track nearest dangerous attacker in our half
    const danger = opponents
      .filter(o => ['ST', 'LW', 'RW', 'CAM'].includes(o.position))
      .filter(o => {
        const oIsInOurHalf = p.team === 'home'
          ? o.y > PITCH_H / 2 - 60
          : o.y < PITCH_H / 2 + 60;
        return oIsInOurHalf;
      });

    if (danger.length > 0) {
      const nearest = danger.reduce((a, b) =>
        dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b);
      // Intercept between attacker and our goal
      const tx = (nearest.x + p.baseX) / 2;
      const ty = (nearest.y + myGoalY) / 2;
      p.moveToward(tx, ty, 0.9);
    } else if (!hasPossession) {
      // Press ball if near base
      if (dist(p.x, p.y, ball.x, ball.y) < 120) {
        p.moveToward(ball.x, ball.y, 0.85);
      } else {
        p.moveToward(p.baseX, p.baseY, 0.7);
      }
    } else {
      // We have possession: hold position + slight forward lean
      const advanceY = p.team === 'home' ? p.baseY - 20 : p.baseY + 20;
      p.moveToward(p.baseX, Math.min(PITCH_H - 20, Math.max(20, advanceY)), 0.5);
    }
  }

  _aiMidfielder(p, ball, hasPossession, oppGoalY) {
    if (p.hasBall) {
      const dGoal = dist(p.x, p.y, PITCH_W / 2, oppGoalY);
      if (dGoal < 220) {
        // Shoot
        this._aiShoot(p, oppGoalY);
      } else {
        // Pass forward
        this._aiPass(p);
      }
      return;
    }

    if (hasPossession) {
      // Support run: drift toward space ahead of ball
      const forwardBias = p.team === 'home' ? -30 : 30;
      p.moveToward(p.baseX + (ball.x - PITCH_W / 2) * 0.3, p.baseY + forwardBias, 0.75);
    } else {
      // Press toward ball if within range, else hold shape
      const d = dist(p.x, p.y, ball.x, ball.y);
      if (d < 100) {
        p.moveToward(ball.x, ball.y, 0.9);
      } else {
        p.moveToward(p.baseX, p.baseY, 0.65);
      }
    }
  }

  _aiAttacker(p, ball, hasPossession, oppGoalY) {
    if (p.hasBall) {
      const dGoal = dist(p.x, p.y, PITCH_W / 2, oppGoalY);
      if (dGoal < 190) {
        this._aiShoot(p, oppGoalY);
      } else {
        // Dribble toward goal
        const tx = p.x + (PITCH_W / 2 - p.x) * 0.05;
        const ty = p.y + (oppGoalY - p.y) * 0.08;
        p.moveToward(tx, ty, 1.0);
      }
      return;
    }

    if (hasPossession) {
      // Make a run into space behind the defence
      const runX = p.baseX + (Math.random() - 0.5) * 60;
      const runY = p.team === 'home'
        ? Math.max(20, p.baseY - 30)
        : Math.min(PITCH_H - 20, p.baseY + 30);
      p.moveToward(runX, runY, 0.9);
    } else {
      // Press aggressively
      p.moveToward(ball.x, ball.y, 0.95);
    }
  }

  _aiShoot(p, oppGoalY) {
    const spread = ((100 - p.overall) / 700) * (PITCH_W / 2);
    const gx = PITCH_W / 2 + (Math.random() - 0.5) * GOAL_W * 0.5;
    const gy = oppGoalY + (Math.random() - 0.5) * spread * 0.2;
    const power = SHOOT_POWER * (0.75 + p.overall / 500);
    this.ball.kick(gx - p.x, gy - p.y, power);
    p.hasBall = false;
    p.releaseBall();
  }

  _aiPass(p) {
    const teammates = p.team === 'home' ? this.homePlayers : this.awayPlayers;
    const opponents = p.team === 'home' ? this.awayPlayers : this.homePlayers;
    const forwardDir = p.team === 'home' ? -1 : 1;

    const candidates = teammates.filter(t => {
      if (t === p) return false;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < 20 || d > 250) return false;
      const isForward = (t.y - p.y) * forwardDir < 0;
      const marked = opponents.some(o => dist(o.x, o.y, t.x, t.y) < 38);
      return isForward && !marked;
    });

    const target = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : teammates.find(t => t !== p);

    if (target) {
      const acc = (100 - p.overall) / 300;
      this.ball.kick(
        target.x + (Math.random() - 0.5) * acc * 60 - p.x,
        target.y + (Math.random() - 0.5) * acc * 60 - p.y,
        PASS_POWER * (0.85 + Math.random() * 0.3)
      );
      p.hasBall = false;
      p.releaseBall();
    }
  }

  // ── Goal detection ────────────────────────────────────────────────────────

  _checkGoal() {
    const bx = this.ball.x;
    const by = this.ball.y;
    const inGoalX = bx > GOAL_X_MIN && bx < GOAL_X_MAX;

    if (by < -GOAL_D / 2 && inGoalX) return 'home'; // ball went into top goal → home scores
    if (by > PITCH_H + GOAL_D / 2 && inGoalX) return 'away'; // bottom goal → away scores
    return null;
  }

  _resetAfterGoal() {
    // Reset all players to formation positions
    for (const p of [...this.homePlayers, ...this.awayPlayers]) {
      p.x = p.baseX;
      p.y = p.baseY;
      p.hasBall = false;
    }
    this.ball.reset();
    this._assignBallToKickOff();
  }

  _clampPlayers() {
    for (const p of [...this.homePlayers, ...this.awayPlayers]) {
      p.x = Math.max(PLAYER_R, Math.min(PITCH_W - PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(PITCH_H - PLAYER_R, p.y));
    }
  }

  // ── Remote state sync (away client) ──────────────────────────────────────

  applyRemoteState(state) {
    if (!state) return;

    // Update player positions from host
    if (state.homePlayers) {
      state.homePlayers.forEach((s, i) => {
        const p = this.homePlayers[i];
        if (!p) return;
        if (!p.isUserControlled) {
          p.x += (s.x - p.x) * 0.5;
          p.y += (s.y - p.y) * 0.5;
        }
        p.hasBall = s.hasBall || false;
        if (s.facingX !== undefined) p.facingX = s.facingX;
        if (s.facingY !== undefined) p.facingY = s.facingY;
      });
    }
    if (state.awayPlayers) {
      state.awayPlayers.forEach((s, i) => {
        const p = this.awayPlayers[i];
        if (!p) return;
        if (!p.isUserControlled) {
          p.x += (s.x - p.x) * 0.5;
          p.y += (s.y - p.y) * 0.5;
        }
        p.hasBall = s.hasBall || false;
        if (s.facingX !== undefined) p.facingX = s.facingX;
        if (s.facingY !== undefined) p.facingY = s.facingY;
      });
    }
    if (state.ball && !this.ball.owner) {
      this.ball.x += (state.ball.x - this.ball.x) * 0.5;
      this.ball.y += (state.ball.y - this.ball.y) * 0.5;
      this.ball.vx = state.ball.vx || 0;
      this.ball.vy = state.ball.vy || 0;
    }
    if (state.homeScore !== undefined) this.homeScore = state.homeScore;
    if (state.awayScore !== undefined) this.awayScore = state.awayScore;
    if (state.finished) this.finished = true;

    if (state.homeScore !== undefined && this.onGoal) {
      this.onGoal(state.homeScore, state.awayScore, null);
    }
    if (state.minute !== undefined && this.onTick) {
      this.onTick(state.minute);
    }
  }

  getSerializableState() {
    return {
      homePlayers: this.homePlayers.map(p => ({
        x: p.x, y: p.y, hasBall: p.hasBall, facingX: p.facingX, facingY: p.facingY,
      })),
      awayPlayers: this.awayPlayers.map(p => ({
        x: p.x, y: p.y, hasBall: p.hasBall, facingX: p.facingX, facingY: p.facingY,
      })),
      ball: { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy },
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      minute: Math.floor((this.frameCount / this.totalFrames) * 90),
      finished: this.finished,
    };
  }

  getAwayClientInput() {
    const p = this.awayUserPlayer;
    if (!p) return null;
    return {
      x: p.x,
      y: p.y,
      facingX: p.facingX,
      facingY: p.facingY,
      action: null,
    };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  render(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, PITCH_W, PITCH_H);

    this._drawPitch(ctx);
    this._drawGoals(ctx);
    this._drawPlayers(ctx);
    this._drawBall(ctx);
    this._drawHUD(ctx);

    if (this.goalFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.goalFlash / 36) * 0.45})`;
      ctx.fillRect(0, 0, PITCH_W, PITCH_H);

      // Goal text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      ctx.fillText('GOAL!', PITCH_W / 2, PITCH_H / 2 - 10);
      const scorer = this.lastGoalTeam === 'home' ? this.homeClub : this.awayClub;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(scorer, PITCH_W / 2, PITCH_H / 2 + 22);
      ctx.shadowBlur = 0;
    }
  }

  _drawPitch(ctx) {
    // Base grass
    ctx.fillStyle = '#1e7b38';
    ctx.fillRect(0, 0, PITCH_W, PITCH_H);

    // Alternating stripes
    ctx.fillStyle = '#1a7034';
    for (let i = 0; i < PITCH_H; i += 60) {
      ctx.fillRect(0, i, PITCH_W, 30);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;

    // Border
    ctx.strokeRect(2, 2, PITCH_W - 4, PITCH_H - 4);

    // Center line
    ctx.beginPath();
    ctx.moveTo(2, PITCH_H / 2);
    ctx.lineTo(PITCH_W - 2, PITCH_H / 2);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H / 2, 55, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(PITCH_W / 2, PITCH_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penW = 160, penH = 110;
    const penX = (PITCH_W - penW) / 2;
    // Top penalty area
    ctx.strokeRect(penX, 2, penW, penH);
    // Bottom penalty area
    ctx.strokeRect(penX, PITCH_H - penH - 2, penW, penH);

    // Goal areas (6-yard box)
    const sixW = 80, sixH = 40;
    const sixX = (PITCH_W - sixW) / 2;
    ctx.strokeRect(sixX, 2, sixW, sixH);
    ctx.strokeRect(sixX, PITCH_H - sixH - 2, sixW, sixH);
  }

  _drawGoals(ctx) {
    const gx = GOAL_X_MIN;
    const gw = GOAL_W;

    // Net fill
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    // Top goal (away goal)
    ctx.fillRect(gx, -GOAL_D, gw, GOAL_D + 2);
    // Bottom goal (home goal)
    ctx.fillRect(gx, PITCH_H - 2, gw, GOAL_D);

    // Goal posts
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    // Top
    ctx.strokeRect(gx, -GOAL_D, gw, GOAL_D);
    // Bottom
    ctx.strokeRect(gx, PITCH_H, gw, GOAL_D);
  }

  _drawPlayers(ctx) {
    const all = [...this.homePlayers, ...this.awayPlayers];
    for (const p of all) {
      const isHome = p.team === 'home';
      const baseColor = isHome ? '#4a90d9' : '#e84c4c';
      const borderColor = isHome ? '#2060a0' : '#a02020';

      ctx.save();

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Circle fill
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // User-controlled ring
      if (p.isUserControlled) {
        ctx.strokeStyle = '#f5a623';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ball indicator
      if (p.hasBall) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shirt number
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${PLAYER_R - 3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.index + 1, p.x, p.y + 0.5);

      ctx.restore();
    }
  }

  _drawBall(ctx) {
    const b = this.ball;

    // Motion trail
    b.trail.forEach((pt, i) => {
      const alpha = ((i + 1) / b.trail.length) * 0.25;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, BALL_R * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + BALL_R + 1, BALL_R * 0.7, BALL_R * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    const grad = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  _drawHUD(ctx) {
    // Top semi-transparent score bar
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, PITCH_W, 32);

    const minute = Math.floor((this.frameCount / this.totalFrames) * 90);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.homeClub, 10, 16);

    ctx.textAlign = 'right';
    ctx.fillText(this.awayClub, PITCH_W - 10, 16);

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${this.homeScore}  –  ${this.awayScore}`, PITCH_W / 2, 11);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(`${minute}'`, PITCH_W / 2, 24);
  }

  // Expose constants for MatchGame.js
  static get PITCH_W() { return PITCH_W; }
  static get PITCH_H() { return PITCH_H; }
}
