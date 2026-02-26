import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { FiUsers, FiAward, FiHeart, FiInfo } from 'react-icons/fi';

const StatCard = ({ Icon, iconColor, label, value }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: iconColor + '22' }]}>
      <Icon size={18} color={iconColor} />
    </View>
    <Text style={styles.statCardValue}>{value}</Text>
    <Text style={styles.statCardLabel}>{label}</Text>
  </View>
);

const HomeTab = ({ managerProfile, formatCurrency }) => {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>{t('welcomeBack')}, {managerProfile?.managerName}!</Text>
        <Text style={styles.welcomeSubtitle}>{t('budget')}: {formatCurrency(managerProfile?.budget || 0)}</Text>

        <View style={styles.quickStats}>
          <StatCard
            Icon={FiUsers}
            iconColor="#4facfe"
            label={t('squadSize')}
            value={managerProfile?.squad?.length || 0}
          />
          <StatCard
            Icon={FiAward}
            iconColor="#fee140"
            label={t('wins')}
            value={managerProfile?.wins || 0}
          />
          <StatCard
            Icon={FiHeart}
            iconColor="#f5576c"
            label={t('friends')}
            value={managerProfile?.friends?.length || 0}
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconBadge}>
            <FiInfo size={16} color="#7c6ff7" />
          </View>
          <Text style={styles.sectionTitle}>Quick Tips</Text>
        </View>
        <Text style={styles.infoText}>• Build your squad in the Team section</Text>
        <Text style={styles.infoText}>• Challenge friends or compete in Pro League</Text>
        <Text style={styles.infoText}>• Buy/sell players in the Market</Text>
        <Text style={styles.infoText}>• Connect with other managers in Social</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
    shadowColor: '#7c6ff7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#7c6ff7',
    marginBottom: 22,
    fontWeight: '600',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    backgroundColor: '#0f1330',
    borderRadius: 14,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(124, 111, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.72)',
    marginBottom: 8,
    lineHeight: 22,
  },
});

export default HomeTab;
