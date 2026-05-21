import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FootballGame } from '../game/FootballGame';
import { database } from '../firebase';
import { ref, set, onValue, off } from 'firebase/database';

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

  // ── Init game ────────────────────────────────────────────────────────────

  useEffect(() => {
    const game = new FootballGame();
    gameRef.current = game;

    game.onGoal = (hs, as) => {
      setScore({ home: hs, away: as });
    };
    game.onTick = (min) => setGameMinute(min);
    game.onControlSwitch = (name) => setControlledName(name);

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
      keysRef.current[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        keysRef.current['_spaceDown'] = true;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        keysRef.current['_tabDown'] = true;
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Host: game loop + Firebase write ────────────────────────────────────
    if (isHost || isPractice) {
      let frameNum = 0;
      const loop = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        game.update(keysRef.current, remoteInputRef.current);
        game.render(ctx);

        if (game.finished) {
          onMatchEndRef.current && onMatchEndRef.current(game.homeScore, game.awayScore);
          return;
        }
        rafRef.current = requestAnimationFrame(loop);
        frameNum++;
      };
      rafRef.current = requestAnimationFrame(loop);

      // Write state to Firebase every ~50ms (online only)
      if (!isPractice && matchId) {
        const gameStateRef = ref(database, `liveGame/${matchId}/gameState`);
        dbWriteRef.current = setInterval(() => {
          if (game.finished) return;
          set(gameStateRef, game.getSerializableState()).catch(() => {});
        }, 50);

        // Read away player input
        const awayInputRef = ref(database, `liveGame/${matchId}/awayInput`);
        const unsub = onValue(awayInputRef, (snap) => {
          if (snap.exists()) remoteInputRef.current = snap.val();
        });
        dbUnsubRef.current = () => off(awayInputRef, 'value', unsub);
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
        if (snap.val()?.finished) {
          const v = snap.val();
          onMatchEndRef.current && onMatchEndRef.current(v.homeScore || 0, v.awayScore || 0);
        }
      });

      // Send own input every 50ms
      dbWriteRef.current = setInterval(() => {
        const input = game.getAwayClientInput();
        if (input) set(awayInputRef, input).catch(() => {});
      }, 50);

      dbUnsubRef.current = () => off(gameStateRef, 'value', unsub);
    }

    // Hide controls hint after 6 seconds
    const hintTimer = setTimeout(() => setShowControls(false), 6000);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (dbWriteRef.current) clearInterval(dbWriteRef.current);
      if (dbUnsubRef.current) dbUnsubRef.current();
      clearTimeout(hintTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch controls ───────────────────────────────────────────────────────

  const handleJoystickStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickRef.current = {
      active: true,
      baseX: touch.clientX,
      baseY: touch.clientY,
      touchId: touch.identifier,
    };
  }, []);

  const handleJoystickMove = useCallback((e) => {
    e.preventDefault();
    const j = joystickRef.current;
    if (!j.active) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === j.touchId);
    if (!touch) return;
    const dx = (touch.clientX - j.baseX) / 40;
    const dy = (touch.clientY - j.baseY) / 40;
    keysRef.current.joystickX = Math.max(-1, Math.min(1, dx));
    keysRef.current.joystickY = Math.max(-1, Math.min(1, dy));
  }, []);

  const handleJoystickEnd = useCallback((e) => {
    e.preventDefault();
    joystickRef.current.active = false;
    keysRef.current.joystickX = 0;
    keysRef.current.joystickY = 0;
  }, []);

  const handleShootBtn = useCallback(() => {
    gameRef.current?.triggerShoot();
  }, []);

  const handlePassBtn = useCallback(() => {
    gameRef.current?.triggerPass();
  }, []);

  const handleSwitchBtn = useCallback(() => {
    if (isHost || isPractice) {
      gameRef.current?.switchControl();
    } else {
      gameRef.current?.switchAwayControl();
    }
  }, [isHost, isPractice]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

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
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        {/* Touch controls overlay */}
        <View style={styles.touchLayer} pointerEvents="box-none">
          {/* Virtual joystick */}
          <View
            style={styles.joystickArea}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
          >
            <View style={styles.joystickBase}>
              <View style={styles.joystickKnob} />
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.passBtn} onPress={handlePassBtn} activeOpacity={0.7}>
              <Text style={styles.btnText}>PASS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shootBtn} onPress={handleShootBtn} activeOpacity={0.7}>
              <Text style={styles.btnText}>SHOOT</Text>
            </TouchableOpacity>
          </View>

          {/* Switch player button */}
          <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchBtn} activeOpacity={0.7}>
            <Text style={styles.switchBtnText}>⇄ SWITCH</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {controlledName ? (
          <View style={styles.controlChip}>
            <Text style={styles.controlChipText}>You: {controlledName}</Text>
          </View>
        ) : null}

        {showControls ? (
          <Text style={styles.controlsHint}>
            WASD/Arrows = Move  ·  Space = Shoot/Pass  ·  Tab = Switch
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
    flex: 1,
    backgroundColor: '#0a0e1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hud: {
    width: '100%',
    maxWidth: PITCH_W,
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
    width: PITCH_W,
    maxWidth: '100%',
    aspectRatio: PITCH_W / PITCH_H,
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 16,
  },
  joystickArea: {
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickBase: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickKnob: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  actionButtons: {
    alignItems: 'flex-end',
    gap: 10,
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
    bottom: 14,
    left: '50%',
    transform: [{ translateX: -40 }],
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
    maxWidth: PITCH_W,
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
