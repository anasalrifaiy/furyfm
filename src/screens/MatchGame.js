import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FootballGame } from '../game/FootballGame';
import { database } from '../firebase';
import { ref, set, onValue } from 'firebase/database';

const PITCH_W = FootballGame.PITCH_W;
const PITCH_H = FootballGame.PITCH_H;

export default function MatchGame({
  homeSquad,
  awaySquad,
  homeFormation,
  awayFormation,
  isHost,
  matchId,
  isPractice,
  homeClubName,
  awayClubName,
  onMatchEnd,
  onBack,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef({});
  const rafRef = useRef(null);
  const dbWriteRef = useRef(null);
  const dbUnsubRef = useRef(null);
  const remoteInputRef = useRef(null);
  const onMatchEndRef = useRef(onMatchEnd);

  useEffect(() => { onMatchEndRef.current = onMatchEnd; }, [onMatchEnd]);

  const [score, setScore] = useState({ home: 0, away: 0 });
  const [gameMinute, setGameMinute] = useState(0);
  const [controlledName, setControlledName] = useState('');
  const [showControls, setShowControls] = useState(true);

  // Virtual joystick state
  const joystickRef = useRef({ active: false, baseX: 0, baseY: 0, touchId: null });
  const rootRef = useRef(null);
  const passBtnRef = useRef(null);
  const shootBtnRef = useRef(null);
  const switchBtnRef = useRef(null);
  const joyZoneRef = useRef(null);
  const joyBaseRef = useRef(null);
  const joyKnobRef = useRef(null);
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  // ── Init game ────────────────────────────────────────────────────────────

  useEffect(() => {
    const game = new FootballGame();
    gameRef.current = game;

    game.onGoal = (hs, as) => {
      setScore({ home: hs, away: as });
    };
    game.onTick = (min) => setGameMinute(min);
    game.onSwitch = (name) => setControlledName(name);

    game.start(
      homeSquad,
      awaySquad,
      homeFormation || '4-3-3',
      awayFormation || '4-3-3',
      isHost,
      homeClubName,
      awayClubName,
    );

    setControlledName(
      isHost
        ? (game.userPlayer?.name || '')
        : (game.awayUserPlayer?.name || ''),
    );

    // Keyboard listeners
    const onKeyDown = (e) => {
      keysRef.current[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        keysRef.current['_passDown'] = true;
      }
      if (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K' || e.key === 'Enter') {
        e.preventDefault();
        keysRef.current['_shootDown'] = true;
      }
      if (e.key === 'Tab' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        keysRef.current['_tabDown'] = true;
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
    };
    const onBlur = () => { keysRef.current = {}; };
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Host: game loop + Firebase write ────────────────────────────────────
    if (isHost || isPractice) {
      let writeFinalState = null;
      const loop = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        game.update(keysRef.current, remoteInputRef.current);
        game.render(ctx);

        if (game.finished) {
          if (writeFinalState) writeFinalState();
          onMatchEndRef.current && onMatchEndRef.current(game.homeScore, game.awayScore);
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // Write state to Firebase every ~50ms (online only)
      if (!isPractice && matchId) {
        const gameStateRef = ref(database, `liveGame/${matchId}/gameState`);
        writeFinalState = () => set(gameStateRef, game.getSerializableState()).catch(() => {});
        dbWriteRef.current = setInterval(() => {
          if (game.finished) return;
          set(gameStateRef, game.getSerializableState()).catch(() => {});
        }, 50);

        // Read away player input
        const awayInputRef = ref(database, `liveGame/${matchId}/awayInput`);
        dbUnsubRef.current = onValue(awayInputRef, (snap) => {
          if (snap.exists()) remoteInputRef.current = snap.val();
        });
      }
    }

    // ── Away client: send input + read state ─────────────────────────────────
    if (!isHost && !isPractice && matchId) {
      const gameStateRef = ref(database, `liveGame/${matchId}/gameState`);
      const awayInputRef = ref(database, `liveGame/${matchId}/awayInput`);

      // Render loop for away client (renders received state)
      const loop = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        game.update(keysRef.current);
        game.render(ctx);

        if (game.finished) {
          onMatchEndRef.current && onMatchEndRef.current(game.homeScore, game.awayScore);
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // Receive host state
      const unsub = onValue(gameStateRef, (snap) => {
        if (snap.exists()) game.applyRemoteState(snap.val());
      });

      // Send own input every 50ms
      dbWriteRef.current = setInterval(() => {
        const input = game.getAwayClientInput();
        if (input) set(awayInputRef, input).catch(() => {});
      }, 50);

      dbUnsubRef.current = unsub;
    }

    // Hide controls hint after 6 seconds
    const hintTimer = setTimeout(() => setShowControls(false), 6000);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (dbWriteRef.current) clearInterval(dbWriteRef.current);
      if (dbUnsubRef.current) dbUnsubRef.current();
      clearTimeout(hintTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch controls ───────────────────────────────────────────────────────

  // Floating joystick: touch anywhere in the left zone. Native non-passive listeners are
  // required so preventDefault actually stops the page from scrolling.
  useEffect(() => {
    const zone = joyZoneRef.current;
    const root = rootRef.current;
    if (!zone || !root) return undefined;
    const R = 55;
    const prevBody = document.body.style.cssText;
    const prevHtml = document.documentElement.style.cssText;
    document.body.style.cssText += ';overflow:hidden;overscroll-behavior:none;touch-action:none;';
    document.documentElement.style.cssText += ';overflow:hidden;overscroll-behavior:none;';

    const show = (on, bx, by, kx, ky) => {
      const base = joyBaseRef.current, knob = joyKnobRef.current;
      if (!base || !knob) return;
      base.style.display = on ? 'block' : 'none';
      if (on) {
        base.style.left = (bx - R) + 'px'; base.style.top = (by - R) + 'px';
        knob.style.left = (R - 24 + kx) + 'px'; knob.style.top = (R - 24 + ky) + 'px';
      }
    };
    const reset = () => {
      joystickRef.current.active = false;
      keysRef.current.joystickX = 0;
      keysRef.current.joystickY = 0;
      show(false);
    };
    const onStart = (e) => {
      e.preventDefault();
      if (joystickRef.current.active) return;
      const t = e.changedTouches[0];
      const rect = zone.getBoundingClientRect();
      joystickRef.current = { active: true, baseX: t.clientX, baseY: t.clientY, touchId: t.identifier };
      show(true, t.clientX - rect.left, t.clientY - rect.top, 0, 0);
    };
    const onMove = (e) => {
      e.preventDefault();
      const j = joystickRef.current;
      if (!j.active) return;
      const t = Array.from(e.changedTouches).find(x => x.identifier === j.touchId);
      if (!t) return;
      let dx = t.clientX - j.baseX, dy = t.clientY - j.baseY;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      const dead = len < 8;
      keysRef.current.joystickX = dead ? 0 : dx / R;
      keysRef.current.joystickY = dead ? 0 : dy / R;
      const rect = zone.getBoundingClientRect();
      show(true, j.baseX - rect.left, j.baseY - rect.top, dx, dy);
    };
    const onEnd = (e) => {
      e.preventDefault();
      const j = joystickRef.current;
      if (Array.from(e.changedTouches).some(x => x.identifier === j.touchId)) reset();
    };
    const block = (e) => { if (e.cancelable) e.preventDefault(); };

    zone.addEventListener('touchstart', onStart, { passive: false });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd, { passive: false });
    zone.addEventListener('touchcancel', onEnd, { passive: false });
    root.addEventListener('touchmove', block, { passive: false });
    return () => {
      zone.removeEventListener('touchstart', onStart);
      zone.removeEventListener('touchmove', onMove);
      zone.removeEventListener('touchend', onEnd);
      zone.removeEventListener('touchcancel', onEnd);
      root.removeEventListener('touchmove', block);
      document.body.style.cssText = prevBody;
      document.documentElement.style.cssText = prevHtml;
      reset();
    };
  }, []);

  // Action buttons use native touch events so they fire immediately even while another
  // finger is holding the joystick (React Native's responder system handles one touch at a time).
  useEffect(() => {
    const cleanups = [];
    const bind = (el, fn) => {
      if (!el) return;
      const down = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        el.style.opacity = '0.6';
        fn();
      };
      const up = () => { el.style.opacity = '1'; };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up);
      el.addEventListener('touchcancel', up);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);
      cleanups.push(() => {
        el.removeEventListener('touchstart', down);
        el.removeEventListener('touchend', up);
        el.removeEventListener('touchcancel', up);
        el.removeEventListener('mousedown', down);
        el.removeEventListener('mouseup', up);
      });
    };
    bind(passBtnRef.current, () => gameRef.current?.triggerPass());
    bind(shootBtnRef.current, () => gameRef.current?.triggerShoot());
    bind(switchBtnRef.current, () => gameRef.current?.triggerSwitch());
    return () => cleanups.forEach(c => c());
  }, []);

  const handleShootBtn = useCallback(() => {
    gameRef.current?.triggerShoot();
  }, []);

  const handlePassBtn = useCallback(() => {
    gameRef.current?.triggerPass();
  }, []);

  const handleSwitchBtn = useCallback(() => {
    gameRef.current?.triggerSwitch();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View ref={rootRef} style={styles.root}>

      {/* Score / minute HUD */}
      <View style={styles.hud}>
        <Text style={styles.teamName} numberOfLines={1}>{homeClubName}</Text>
        <View style={styles.scorebox}>
          <Text style={styles.score}>{score.home}</Text>
          <Text style={styles.scoreDash}> – </Text>
          <Text style={styles.score}>{score.away}</Text>
        </View>
        <Text style={styles.teamName} numberOfLines={1}>{awayClubName}</Text>
        <View style={styles.minuteBox}>
          <Text style={styles.minute}>{gameMinute}'</Text>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={PITCH_W}
          height={PITCH_H}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', touchAction: 'none' }}
        />

        {/* Touch controls overlay */}
        <View style={styles.touchLayer} pointerEvents="box-none">
          {/* Floating joystick: the whole left half of the screen */}
          <View ref={joyZoneRef} style={styles.joystickZone}>
            <View ref={joyBaseRef} pointerEvents="none" style={styles.joystickBase}>
              <View ref={joyKnobRef} style={styles.joystickKnob} />
            </View>
            {isTouch ? <Text pointerEvents="none" style={styles.joyHint}>Drag to move</Text> : null}
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <View ref={passBtnRef} style={styles.passBtn}>
              <Text style={styles.btnText}>PASS</Text>
            </View>
            <View ref={shootBtnRef} style={styles.shootBtn}>
              <Text style={styles.btnText}>SHOOT</Text>
            </View>
          </View>

          {/* Switch player button */}
          <View ref={switchBtnRef} style={styles.switchBtn}>
            <Text style={styles.switchBtnText}>⇄ SWITCH</Text>
          </View>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {controlledName ? (
          <View style={styles.controlChip}>
            <Text style={styles.controlChipText}>You: {controlledName}</Text>
          </View>
        ) : null}

        {showControls && !isTouch ? (
          <Text style={styles.controlsHint}>
            WASD/Arrows = Move  ·  Shift = Sprint  ·  Space = Pass  ·  F = Shoot  ·  Tab/E = Switch
          </Text>
        ) : null}

        <TouchableOpacity style={styles.exitBtn} onPress={onBack}>
          <Text style={styles.exitBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    flex: 1,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  hud: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
    position: 'relative',
  },
  teamName: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scorebox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  score: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  scoreDash: {
    color: '#94a3b8',
    fontSize: 18,
    marginHorizontal: 4,
  },
  minuteBox: {
    position: 'absolute',
    bottom: -14,
    left: '50%',
    transform: [{ translateX: -20 }],
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 10,
  },
  minute: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  canvasWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 640,
    flex: 1,
    minHeight: 0,
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  joystickZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '55%',
  },
  joyHint: {
    position: 'absolute',
    left: 16,
    bottom: 12,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  joystickBase: {
    display: 'none',
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  joystickKnob: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  actionButtons: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    alignItems: 'flex-end',
    gap: 14,
  },
  passBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74,144,217,0.8)',
    borderWidth: 2,
    borderColor: '#4a90d9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shootBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232,76,76,0.85)',
    borderWidth: 2,
    borderColor: '#e84c4c',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  switchBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1e3a5f',
    flexWrap: 'wrap',
    gap: 6,
  },
  controlChip: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  controlChipText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  controlsHint: {
    color: '#64748b',
    fontSize: 10,
    flex: 1,
    textAlign: 'center',
  },
  exitBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  exitBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
