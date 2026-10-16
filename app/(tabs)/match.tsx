import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import { Play } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { getStartingXI, buildComputerSquad } from '@/lib/manager';
import MatchGame from '@/components/MatchGame';

export default function MatchScreen() {
  const manager = useAuth((s) => s.manager);
  const recordMatch = useAuth((s) => s.recordMatch);
  const [playing, setPlaying] = useState(false);
  if (!manager) return null;

  const xi = getStartingXI(manager);
  const homeSquad = xi.map((p) => ({ name: p.name, position: p.position, overall: p.overall }));
  const avg = homeSquad.length
    ? Math.round(homeSquad.reduce((s, p) => s + p.overall, 0) / homeSquad.length)
    : 70;
  const canPlay = homeSquad.length >= 11;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Play a match</Text>
      <Text style={styles.sub}>
        {canPlay
          ? `Your starting XI is rated ${avg}. Take on the computer with full control.`
          : 'You need at least 11 players in your squad to play.'}
      </Text>

      <TouchableOpacity
        style={[styles.button, !canPlay && styles.disabled]}
        disabled={!canPlay}
        onPress={() => setPlaying(true)}>
        <Play size={22} color="#fff" />
        <Text style={styles.buttonText}>Play vs Computer</Text>
      </TouchableOpacity>

      <Modal visible={playing} animationType="slide" onRequestClose={() => setPlaying(false)}>
        {playing && (
          <MatchGame
            homeSquad={homeSquad}
            awaySquad={buildComputerSquad(avg)}
            homeFormation={manager.formation || '4-3-3'}
            awayFormation="4-4-2"
            homeName={manager.managerName}
            awayName="Computer"
            onExit={(hs, as, finished) => {
              setPlaying(false);
              if (finished) recordMatch('Computer', hs, as).catch(() => {});
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, textAlign: 'center', marginBottom: 8 },
  sub: { fontFamily: 'Inter_400Regular', color: '#555', textAlign: 'center', marginBottom: 28 },
  button: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 17 },
});
