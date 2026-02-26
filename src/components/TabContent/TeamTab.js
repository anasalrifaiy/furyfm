import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { FiUsers, FiGrid, FiActivity, FiBriefcase, FiHome } from 'react-icons/fi';

const TEAM_ITEMS = [
  {
    id: 'squad',
    Icon: FiUsers,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    glow: '#667eea',
    gradientKey: 'primary',
  },
  {
    id: 'formation',
    Icon: FiGrid,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glow: '#4facfe',
    gradientKey: 'accent',
  },
  {
    id: 'training',
    Icon: FiActivity,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    glow: '#667eea',
    gradientKey: 'primary',
  },
  {
    id: 'coaching',
    Icon: FiBriefcase,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    glow: '#f093fb',
    gradientKey: 'secondary',
  },
  {
    id: 'facilities',
    Icon: FiHome,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glow: '#4facfe',
    gradientKey: 'accent',
  },
];

const MenuCard = ({ id, Icon, gradient, glow, onPress, title, desc }) => (
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

const TeamTab = ({ onNavigate }) => {
  const { t } = useLanguage();

  const items = [
    { ...TEAM_ITEMS[0], title: t('mySquad'),        desc: t('mySquadDesc') },
    { ...TEAM_ITEMS[1], title: t('formation'),       desc: t('formationDesc') },
    { ...TEAM_ITEMS[2], title: t('training'),        desc: t('trainingDesc') },
    { ...TEAM_ITEMS[3], title: t('coachingStaff'),   desc: t('coachingStaffDesc') },
    { ...TEAM_ITEMS[4], title: t('clubFacilities'),  desc: t('clubFacilitiesDesc') },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconBadge}>
          <FiUsers size={20} color="#7c6ff7" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Team Management</Text>
          <Text style={styles.headerSubtitle}>Build and improve your squad</Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        {items.map((item) => (
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
    backgroundColor: 'rgba(124, 111, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 111, 247, 0.25)',
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

export default TeamTab;
