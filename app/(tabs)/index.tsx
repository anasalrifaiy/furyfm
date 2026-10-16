import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useAuth } from '@/lib/auth';

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export default function HomeScreen() {
  const manager = useAuth((s) => s.manager);
  if (!manager) return null;

  const squad = manager.squad || [];
  const history = Object.values(manager.matchHistory || {})
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.hello}>Welcome, {manager.managerName}</Text>

      <View style={styles.row}>
        <Stat label="Budget" value={money(manager.budget || 0)} />
        <Stat label="Players" value={String(squad.length)} />
        <Stat label="Points" value={String(manager.points || 0)} />
      </View>
      <View style={styles.row}>
        <Stat label="Wins" value={String(manager.wins || 0)} />
        <Stat label="Draws" value={String(manager.draws || 0)} />
        <Stat label="Losses" value={String(manager.losses || 0)} />
      </View>

      <Text style={styles.section}>Recent matches</Text>
      {history.length === 0 && <Text style={styles.muted}>No matches played yet.</Text>}
      {history.map((m, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{m.opponent}</Text>
          <Text style={styles.score}>
            {m.homeScore} - {m.awayScore}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  hello: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#2e7d32' },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#666', marginTop: 2 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 14, marginBottom: 8 },
  muted: { fontFamily: 'Inter_400Regular', color: '#888' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { fontFamily: 'Inter_400Regular', fontSize: 15 },
  score: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
