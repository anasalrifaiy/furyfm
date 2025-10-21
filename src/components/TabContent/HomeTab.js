import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const HomeTab = ({ managerProfile, formatCurrency }) => {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>{t('welcomeBack')}, {managerProfile?.managerName}!</Text>
        <Text style={styles.welcomeSubtitle}>{t('budget')}: {formatCurrency(managerProfile?.budget || 0)}</Text>

        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('squadSize')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.squad?.length || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('wins')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.wins || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('friends')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.friends?.length || 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>🎮 Quick Tips</Text>
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
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#667eea',
    marginBottom: 20,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#252b54',
    borderRadius: 12,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 5,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  infoSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default HomeTab;
