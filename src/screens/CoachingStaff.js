import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert, showConfirm } from '../utils/alert';

const CoachingStaff = ({ onBack }) => {
  const { managerProfile, updateManagerProfile } = useAuth();
  const { t } = useLanguage();

  const coaches = [
    {
      id: 'gk_coach',
      nameKey: 'goalkeeperCoach',
      position: 'GK',
      icon: '🥅',
      levels: [
        { level: 1, cost: 5000000, bonus: 5, descriptionKey: 'amateurGKCoach' },
        { level: 2, cost: 15000000, bonus: 10, descriptionKey: 'professionalGKCoach' },
        { level: 3, cost: 30000000, bonus: 15, descriptionKey: 'eliteGKCoach' },
      ]
    },
    {
      id: 'defense_coach',
      nameKey: 'defenseCoach',
      position: 'DEF',
      icon: '🛡️',
      levels: [
        { level: 1, cost: 8000000, bonus: 5, descriptionKey: 'amateurDefenseCoach' },
        { level: 2, cost: 20000000, bonus: 10, descriptionKey: 'professionalDefenseCoach' },
        { level: 3, cost: 40000000, bonus: 15, descriptionKey: 'eliteDefenseCoach' },
      ]
    },
    {
      id: 'midfield_coach',
      nameKey: 'midfieldCoach',
      position: 'MID',
      icon: '⚙️',
      levels: [
        { level: 1, cost: 10000000, bonus: 5, descriptionKey: 'amateurMidfieldCoach' },
        { level: 2, cost: 25000000, bonus: 10, descriptionKey: 'professionalMidfieldCoach' },
        { level: 3, cost: 50000000, bonus: 15, descriptionKey: 'eliteMidfieldCoach' },
      ]
    },
    {
      id: 'attack_coach',
      nameKey: 'attackCoach',
      position: 'ATT',
      icon: '⚡',
      levels: [
        { level: 1, cost: 12000000, bonus: 5, descriptionKey: 'amateurAttackCoach' },
        { level: 2, cost: 30000000, bonus: 10, descriptionKey: 'professionalAttackCoach' },
        { level: 3, cost: 60000000, bonus: 15, descriptionKey: 'eliteAttackCoach' },
      ]
    },
  ];

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const getCurrentLevel = (coachId) => {
    return managerProfile?.coaches?.[coachId] || 0;
  };

  const handleHireCoach = (coach, level) => {
    const currentLevel = getCurrentLevel(coach.id);

    if (currentLevel >= level) {
      showAlert(t('alreadyHired'), `${t('alreadyHaveCoach')} ${currentLevel}.`);
      return;
    }

    const levelData = coach.levels[level - 1];

    if (managerProfile.budget < levelData.cost) {
      showAlert(t('insufficientFunds'), `${t('needBudgetHire')} ${formatCurrency(levelData.cost)} ${t('toHireCoach')}`);
      return;
    }

    showConfirm(
      t('hireCoach'),
      `${t('hireCoachFor')} ${t(levelData.descriptionKey)} ${t('for')} ${formatCurrency(levelData.cost)}?\n\n${t('bonus')}: +${levelData.bonus} ${t('inMatches')} ${coach.position} ${t('playersInMatches')}`,
      async () => {
        const newCoaches = {
          ...(managerProfile.coaches || {}),
          [coach.id]: level
        };

        await updateManagerProfile({
          coaches: newCoaches,
          budget: managerProfile.budget - levelData.cost
        });

        showAlert(t('success'), `${t(levelData.descriptionKey)} ${t('coachHired')}`);
      }
    );
  };

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('coachingStaffTitle')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('coachingStaffTitle')}</Text>
        <Text style={styles.budget}>{t('budget')}: {formatCurrency(managerProfile.budget)}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {t('hireCoachesDesc')}
          </Text>
        </View>

        {coaches.map(coach => {
          const currentLevel = getCurrentLevel(coach.id);
          const specialistKey = coach.position === 'GK' ? 'gkSpecialist' :
                               coach.position === 'DEF' ? 'defSpecialist' :
                               coach.position === 'MID' ? 'midSpecialist' : 'attSpecialist';

          return (
            <View key={coach.id} style={styles.coachCard}>
              <View style={styles.coachHeader}>
                <Text style={styles.coachIcon}>{coach.icon}</Text>
                <View style={styles.coachInfo}>
                  <Text style={styles.coachName}>{t(coach.nameKey)}</Text>
                  <Text style={styles.coachPosition}>{t(specialistKey)}</Text>
                </View>
                {currentLevel > 0 && (
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{t('level')} {currentLevel}</Text>
                  </View>
                )}
              </View>

              <View style={styles.levelsContainer}>
                {coach.levels.map((levelData, index) => {
                  const isOwned = currentLevel >= levelData.level;
                  const isNext = currentLevel === levelData.level - 1;

                  return (
                    <TouchableOpacity
                      key={levelData.level}
                      style={[
                        styles.levelCard,
                        isOwned && styles.levelCardOwned,
                        isNext && styles.levelCardNext
                      ]}
                      onPress={() => !isOwned && handleHireCoach(coach, levelData.level)}
                      disabled={isOwned}
                    >
                      <View style={styles.levelHeader}>
                        <Text style={[styles.levelTitle, isOwned && styles.levelTitleOwned]}>
                          {t('level')} {levelData.level}
                        </Text>
                        {isOwned && <Text style={styles.ownedBadge}>{t('owned')}</Text>}
                      </View>
                      <Text style={styles.levelDesc}>{t(levelData.descriptionKey)}</Text>
                      <Text style={styles.levelBonus}>+{levelData.bonus} {t('bonusTo')} {coach.position}</Text>
                      {!isOwned && (
                        <View style={styles.levelCost}>
                          <Text style={styles.levelCostText}>{formatCurrency(levelData.cost)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
    paddingTop: 20,
    zIndex: 100,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  budget: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  infoCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  infoText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 20,
  },
  coachCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  coachIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  coachPosition: {
    fontSize: 14,
    color: '#888',
  },
  levelBadge: {
    backgroundColor: '#43e97b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  levelsContainer: {
    gap: 10,
  },
  levelCard: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: '#2d3561',
    marginBottom: 10,
  },
  levelCardOwned: {
    backgroundColor: '#1a3a2d',
    borderColor: '#43e97b',
  },
  levelCardNext: {
    borderColor: '#f5576c',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  levelTitleOwned: {
    color: '#43e97b',
  },
  ownedBadge: {
    fontSize: 12,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  levelDesc: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  levelBonus: {
    fontSize: 13,
    color: '#f093fb',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  levelCost: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  levelCostText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default CoachingStaff;
