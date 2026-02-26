import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { FiTarget, FiAward, FiClock } from 'react-icons/fi';
import { GiSoccerBall } from 'react-icons/gi';

const MATCH_ITEMS = [
  {
    id: 'match',
    Icon: FiTarget,
    title: 'Friendly Match',
    desc: 'Challenge friends for fun!',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    glow: '#fa709a',
  },
  {
    id: 'proleague',
    Icon: FiAward,
    title: 'Pro League',
    desc: 'Compete for points and glory!',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    glow: '#43e97b',
  },
  {
    id: 'matchHistory',
    Icon: FiClock,
    title: 'Match History',
    desc: 'View your past matches',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glow: '#4facfe',
  },
];

const MenuCard = ({ id, Icon, title, desc, gradient, glow, onPress }) => (
  <TouchableOpacity
    style={[styles.menuCard, { background: gradient, shadowColor: glow }]}
    onPress={() => onPress(id)}
    activeOpacity={0.82}
  >
    <View style={styles.iconCircle}>
      <Icon size={28} color="#ffffff" />
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
    <Text style={styles.menuDesc}>{desc}</Text>
  </TouchableOpacity>
);

const MatchTab = ({ onNavigate }) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconBadge}>
          <GiSoccerBall size={20} color="#43e97b" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Matches</Text>
          <Text style={styles.headerSubtitle}>Play and compete against others</Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        {MATCH_ITEMS.map((item) => (
          <MenuCard key={item.id} {...item} onPress={onNavigate} />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  headerIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(67, 233, 123, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(67, 233, 123, 0.2)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 80,
  },
  menuCard: {
    width: '48%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  menuDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 17,
  },
});

export default MatchTab;
