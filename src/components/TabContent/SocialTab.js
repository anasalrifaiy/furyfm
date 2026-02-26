import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { FiUser, FiBarChart2, FiUsers, FiLogOut, FiGlobe } from 'react-icons/fi';

const SOCIAL_ITEMS = [
  {
    id: 'profile',
    Icon: FiUser,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    glow: '#4facfe',
  },
  {
    id: 'leaderboard',
    Icon: FiBarChart2,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    glow: '#667eea',
  },
  {
    id: 'friends',
    Icon: FiUsers,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    glow: '#43e97b',
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

const SocialTab = ({ onNavigate, onLogout }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const items = [
    { ...SOCIAL_ITEMS[0], title: t('myProfile'),    desc: t('myProfileDesc') },
    { ...SOCIAL_ITEMS[1], title: t('leaderboard'),  desc: t('leaderboardDesc') },
    { ...SOCIAL_ITEMS[2], title: t('friendsMenu'),  desc: t('friendsDesc') },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconBadge}>
          <FiGlobe size={20} color="#4facfe" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Social</Text>
          <Text style={styles.headerSubtitle}>Connect with other managers</Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        {items.map((item) => (
          <MenuCard
            key={item.id}
            {...item}
            onPress={(id) =>
              onNavigate(id, id === 'profile' ? currentUser.uid : null)
            }
          />
        ))}

        {/* Logout card */}
        <TouchableOpacity
          style={[
            styles.menuCard,
            {
              background: 'linear-gradient(135deg, #f5576c 0%, #c62a47 100%)',
              shadowColor: '#f5576c',
            },
          ]}
          onPress={onLogout}
          activeOpacity={0.82}
        >
          <View style={styles.iconCircle}>
            <FiLogOut size={28} color="#ffffff" />
          </View>
          <Text style={styles.menuTitle}>{t('logout')}</Text>
          <Text style={styles.menuDesc}>{t('logoutDesc')}</Text>
        </TouchableOpacity>
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
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.2)',
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

export default SocialTab;
