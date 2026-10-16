import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import Svg, { Rect, Circle, Line, G, Path, Text as SvgText } from 'react-native-svg';
import { FootballGame, SquadPlayer } from '@/lib/footballGame';

const W = FootballGame.PITCH_W;
const H = FootballGame.PITCH_H;
const GOAL_W = 110;
const STEP_MS = 1000 / 60;
const JOY_R = 55;

interface Props {
  homeSquad: SquadPlayer[];
  awaySquad: SquadPlayer[];
  homeFormation: string;
  awayFormation: string;
  homeName: string;
  awayName: string;
  onExit: (homeScore: number, awayScore: number, finished: boolean) => void;
}

const PitchBackground = memo(function PitchBackground() {
  const gx = (W - GOAL_W) / 2;
  return (
    <G>
      <Rect x={0} y={0} width={W} height={H} fill="#2e7d32" />
      {Array.from({ length: 10 }).map((_, i) => (
        <Rect key={i} x={0} y={(i * H) / 10} width={W} height={H / 10} fill={i % 2 ? '#2b7430' : '#318237'} />
      ))}
      <G stroke="rgba(255,255,255,0.8)" strokeWidth={2} fill="none">
        <Rect x={4} y={4} width={W - 8} height={H - 8} />
        <Line x1={4} y1={H / 2} x2={W - 4} y2={H / 2} />
        <Circle cx={W / 2} cy={H / 2} r={50} />
        <Rect x={W / 2 - 80} y={4} width={160} height={90} />
        <Rect x={W / 2 - 80} y={H - 94} width={160} height={90} />
        <Rect x={W / 2 - 35} y={4} width={70} height={30} />
        <Rect x={W / 2 - 35} y={H - 34} width={70} height={30} />
      </G>
      <Rect x={gx} y={0} width={GOAL_W} height={6} fill="#fff" />
      <Rect x={gx} y={H - 6} width={GOAL_W} height={6} fill="#fff" />
    </G>
  );
});

export default function MatchGame({
  homeSquad, awaySquad, homeFormation, awayFormation, homeName, awayName, onExit,
}: Props) {
  const gameRef = useRef<FootballGame | null>(null);
  const keysRef = useRef<Record<string, any>>({ joystickX: 0, joystickY: 0, Shift: false });
  const [, setTick] = useState(0);
  const [minute, setMinute] = useState(0);
  const [finished, setFinished] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [joy, setJoy] = useState<{ bx: number; by: number; kx: number; ky: number } | null>(null);
  const joyId = useRef<string | null>(null);
  const joyBase = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const game = new FootballGame();
    gameRef.current = game;
    game.onTick = (m: number) => setMinute(m);
    game.start(homeSquad, awaySquad, homeFormation, awayFormation, true, homeName, awayName);

    let raf = 0;
    let last = Date.now();
    let acc = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const now = Date.now();
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= STEP_MS && !game.finished) {
        game.update(keysRef.current, null);
        acc -= STEP_MS;
      }
      setTick(t => (t + 1) % 1000000);
      if (game.finished) {
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const game = gameRef.current;

  // Floating joystick: the left side of the screen is one big touch zone
  const onJoyStart = useCallback((e: GestureResponderEvent) => {
    if (joyId.current !== null) return;
    const t = e.nativeEvent.changedTouches[0];
    joyId.current = String(t.identifier);
    joyBase.current = { x: t.locationX, y: t.locationY };
    setJoy({ bx: t.locationX, by: t.locationY, kx: 0, ky: 0 });
  }, []);

  const onJoyMove = useCallback((e: GestureResponderEvent) => {
    if (joyId.current === null) return;
    const t = Array.from(e.nativeEvent.changedTouches).find(x => String(x.identifier) === joyId.current);
    if (!t) return;
    let dx = t.locationX - joyBase.current.x;
    let dy = t.locationY - joyBase.current.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
    const dead = len < 8;
    keysRef.current.joystickX = dead ? 0 : dx / JOY_R;
    keysRef.current.joystickY = dead ? 0 : dy / JOY_R;
    setJoy({ bx: joyBase.current.x, by: joyBase.current.y, kx: dx, ky: dy });
  }, []);

  const onJoyEnd = useCallback((e: GestureResponderEvent) => {
    if (joyId.current === null) return;
    const ended = Array.from(e.nativeEvent.changedTouches).some(x => String(x.identifier) === joyId.current);
    if (!ended) return;
    joyId.current = null;
    keysRef.current.joystickX = 0;
    keysRef.current.joystickY = 0;
    setJoy(null);
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  };

  // Pitch fills the width; falls back to fitting the height
  const pitchW = size.w ? Math.min(size.w, ((size.h - 150) * W) / H) : 0;
  const pitchH = (pitchW * H) / W;
  const user = game?.userPlayer;

  const renderPlayer = (p: any, color: string, key: string) => {
    const isUser = p.isUser;
    return (
      <G key={key}>
        {isUser && <Circle cx={p.x} cy={p.y} r={17} fill="none" stroke="#ffeb3b" strokeWidth={2.5} />}
        <Circle cx={p.x} cy={p.y} r={11} fill={color} stroke={p.role === 'GK' ? '#ffd600' : '#fff'} strokeWidth={1.5} />
        <Path
          d={`M ${p.x + p.fx * 14} ${p.y + p.fy * 14} L ${p.x + p.fx * 8 - p.fy * 4} ${p.y + p.fy * 8 + p.fx * 4} L ${p.x + p.fx * 8 + p.fy * 4} ${p.y + p.fy * 8 - p.fx * 4} Z`}
          fill="#fff"
        />
      </G>
    );
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.hud}>
        <Text style={styles.club} numberOfLines={1}>{homeName}</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.score}>{game?.homeScore ?? 0} – {game?.awayScore ?? 0}</Text>
          <Text style={styles.minute}>{minute}'</Text>
        </View>
        <Text style={styles.club} numberOfLines={1}>{awayName}</Text>
      </View>

      <View style={styles.pitchWrap}>
        {pitchW > 0 && game && (
          <Svg width={pitchW} height={pitchH} viewBox={`0 0 ${W} ${H}`}>
            <PitchBackground />
            {game.away.map((p, i) => renderPlayer(p, '#d32f2f', `a${i}`))}
            {game.home.map((p, i) => renderPlayer(p, '#1976d2', `h${i}`))}
            <Circle cx={game.ball.x} cy={game.ball.y} r={6} fill="#fff" stroke="#000" strokeWidth={1.5} />
            {game.goalFlash > 0 && (
              <SvgText x={W / 2} y={H / 2} fill="#fff" fontSize={48} fontWeight="bold" textAnchor="middle">
                GOAL!
              </SvgText>
            )}
          </Svg>
        )}
      </View>

      <Text style={styles.chip}>{user ? `You: ${user.name}` : ''}</Text>

      {/* Left side = floating joystick zone */}
      <View
        style={styles.joyZone}
        onTouchStart={onJoyStart}
        onTouchMove={onJoyMove}
        onTouchEnd={onJoyEnd}
        onTouchCancel={onJoyEnd}
      >
        {joy && (
          <View pointerEvents="none" style={[styles.joyBase, { left: joy.bx - JOY_R, top: joy.by - JOY_R }]}>
            <View style={[styles.joyKnob, { left: JOY_R - 24 + joy.kx, top: JOY_R - 24 + joy.ky }]} />
          </View>
        )}
        {!joy && (
          <View pointerEvents="none" style={styles.joyHintWrap}>
            <Text style={styles.joyHint}>Drag to move</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.buttons}>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.btn, styles.switchBtn]} onPressIn={() => game?.triggerSwitch()}>
            <Text style={styles.btnText}>SWITCH</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.sprintBtn]}
            onPressIn={() => { keysRef.current.Shift = true; }}
            onPressOut={() => { keysRef.current.Shift = false; }}
          >
            <Text style={styles.btnText}>SPRINT</Text>
          </Pressable>
        </View>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.btn, styles.passBtn]} onPressIn={() => game?.triggerPass()}>
            <Text style={styles.btnText}>PASS</Text>
            <Text style={styles.btnSub}>/TACKLE</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.shootBtn]} onPressIn={() => game?.triggerShoot()}>
            <Text style={styles.btnText}>SHOOT</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.exit} onPress={() => onExit(game?.homeScore ?? 0, game?.awayScore ?? 0, false)}>
        <Text style={styles.exitText}>Exit</Text>
      </Pressable>

      {finished && (
        <View style={styles.overlay}>
          <Text style={styles.fullTime}>Full Time</Text>
          <Text style={styles.finalScore}>{homeName} {game?.homeScore} – {game?.awayScore} {awayName}</Text>
          <Text style={styles.result}>
            {game && game.homeScore > game.awayScore ? 'You won!' : game && game.homeScore < game.awayScore ? 'You lost' : 'Draw'}
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => onExit(game?.homeScore ?? 0, game?.awayScore ?? 0, true)}>
            <Text style={styles.doneText}>Continue</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e1a' },
  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 36, paddingBottom: 8, backgroundColor: '#111827',
  },
  club: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'center' },
  scoreBox: { alignItems: 'center', backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4 },
  score: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  minute: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold' },
  pitchWrap: { alignItems: 'center', justifyContent: 'flex-start' },
  chip: { color: '#cbd5e1', textAlign: 'center', fontSize: 12, marginTop: 6 },
  joyZone: { position: 'absolute', left: 0, top: 90, bottom: 0, width: '55%' },
  joyBase: {
    position: 'absolute', width: JOY_R * 2, height: JOY_R * 2, borderRadius: JOY_R,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  joyKnob: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.45)' },
  joyHintWrap: { position: 'absolute', left: 16, bottom: 20 },
  joyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  buttons: { position: 'absolute', right: 12, bottom: 24, alignItems: 'flex-end', gap: 12 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  btn: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  switchBtn: { backgroundColor: 'rgba(120,120,140,0.8)', borderColor: 'rgba(255,255,255,0.35)', width: 56, height: 56, borderRadius: 28 },
  sprintBtn: { backgroundColor: 'rgba(245,158,11,0.85)', borderColor: '#f59e0b', width: 56, height: 56, borderRadius: 28 },
  passBtn: { backgroundColor: 'rgba(74,144,217,0.85)', borderColor: '#4a90d9' },
  shootBtn: { backgroundColor: 'rgba(232,76,76,0.9)', borderColor: '#e84c4c', width: 74, height: 74, borderRadius: 37 },
  btnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  btnSub: { color: '#fff', fontSize: 8, opacity: 0.85 },
  exit: { position: 'absolute', top: 38, right: 10, paddingHorizontal: 8, paddingVertical: 4 },
  exitText: { color: '#94a3b8', fontSize: 12 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  fullTime: { color: '#f59e0b', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  finalScore: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 20 },
  result: { color: '#4ade80', fontSize: 18 },
  doneBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, marginTop: 10 },
  doneText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
