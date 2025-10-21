import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const MatchTab = ({ onNavigate }) => {
  const matchItems = [
    { id: 'match', icon: '🤝', title: 'Friendly Match', desc: 'Challenge friends for fun!', gradient: 'success' },
    { id: 'proleague', icon: '🏆', title: 'Pro League', desc: 'Compete for points and glory!', gradient: 'warning' },
    { id: 'matchHistory', icon: '📊', title: 'Match History', desc: 'View your past matches', gradient: 'accent' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚽ Matches</Text>
        <Text style={styles.headerSubtitle}>Play and compete against others</Text>
      </View>

      <View style={styles.menuGrid}>
        {matchItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, styles[`${item.gradient}Card`]]}
            onPress={() => onNavigate(item.id)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </TouchableOpacity>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  successCard: {
    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
  warningCard: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  accentCard: {
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  menuIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  menuDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});

export default MatchTab;
