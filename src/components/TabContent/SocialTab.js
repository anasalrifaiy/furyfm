import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const SocialTab = ({ onNavigate, onLogout }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const socialItems = [
    { id: 'friends', icon: '👥', title: t('friendsMenu'), desc: t('friendsDesc'), gradient: 'warning' },
    { id: 'leaderboard', icon: '🏆', title: t('leaderboard'), desc: t('leaderboardDesc'), gradient: 'primary' },
    { id: 'profile', icon: '👤', title: t('myProfile'), desc: t('myProfileDesc'), gradient: 'accent' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Social</Text>
        <Text style={styles.headerSubtitle}>Connect with other managers</Text>
      </View>

      <View style={styles.menuGrid}>
        {socialItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, styles[`${item.gradient}Card`]]}
            onPress={() => onNavigate(item.id === 'profile' ? item.id : item.id, item.id === 'profile' ? currentUser.uid : null)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.menuCard, styles.warningCard]}
          onPress={onLogout}
        >
          <Text style={styles.menuIcon}>🚪</Text>
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

export default SocialTab;
