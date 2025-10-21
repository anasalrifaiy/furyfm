import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';

const TeamTab = ({ onNavigate }) => {
  const { t } = useLanguage();

  const teamItems = [
    { id: 'squad', icon: '👥', title: t('mySquad'), desc: t('mySquadDesc'), gradient: 'primary' },
    { id: 'formation', icon: '⚽', title: t('formation'), desc: t('formationDesc'), gradient: 'accent' },
    { id: 'training', icon: '🎓', title: t('training'), desc: t('trainingDesc'), gradient: 'primary' },
    { id: 'coaching', icon: '👨‍🏫', title: t('coachingStaff'), desc: t('coachingStaffDesc'), gradient: 'secondary' },
    { id: 'facilities', icon: '🏗️', title: t('clubFacilities'), desc: t('clubFacilitiesDesc'), gradient: 'accent' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Team Management</Text>
        <Text style={styles.headerSubtitle}>Build and improve your squad</Text>
      </View>

      <View style={styles.menuGrid}>
        {teamItems.map((item) => (
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
  primaryCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  secondaryCard: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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

export default TeamTab;
