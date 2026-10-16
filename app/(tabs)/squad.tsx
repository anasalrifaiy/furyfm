import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/lib/auth';
import { FORMATIONS, pickStartingXI, getStartingXI } from '@/lib/manager';

export default function SquadScreen() {
  const manager = useAuth((s) => s.manager);
  const updateManager = useAuth((s) => s.updateManager);
  if (!manager) return null;

  const squad = manager.squad || [];
  const formation = manager.formation || '4-3-3';
  const xi = getStartingXI(manager);
  const starters = new Set(xi.map((p) => String(p.id)));

  const setFormation = async (f: string) => {
    const lineup: Record<string, any> = {};
    pickStartingXI(squad, f).forEach((p, i) => (lineup[`P${i}`] = p));
    await updateManager({ formation: f, lineup });
  };

  if (squad.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Your squad is empty.</Text>
        <Text style={styles.muted}>Buy players on the FuryFM web app, then they appear here.</Text>
      </View>
    );
  }

  const sorted = [...squad].sort((a, b) => b.overall - a.overall);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.section}>Formation</Text>
      <View style={styles.chips}>
        {Object.keys(FORMATIONS).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, f === formation && styles.chipActive]}
            onPress={() => setFormation(f).catch(() => Alert.alert('Error', 'Could not save formation'))}>
            <Text style={[styles.chipText, f === formation && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Players ({squad.length})</Text>
      {sorted.map((p) => (
        <View key={String(p.id)} style={[styles.player, starters.has(String(p.id)) && styles.starter]}>
          <Text style={styles.pos}>{p.position}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.ovr}>{p.overall}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontFamily: 'Inter_600SemiBold', fontSize: 18, marginBottom: 8 },
  muted: { fontFamily: 'Inter_400Regular', color: '#888', textAlign: 'center' },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginBottom: 8, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e0e0e0' },
  chipActive: { backgroundColor: '#4CAF50' },
  chipText: { fontFamily: 'Inter_600SemiBold', color: '#333' },
  chipTextActive: { color: '#fff' },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  starter: { borderLeftColor: '#4CAF50' },
  pos: { width: 44, fontFamily: 'Inter_700Bold', color: '#2e7d32' },
  name: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  ovr: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
