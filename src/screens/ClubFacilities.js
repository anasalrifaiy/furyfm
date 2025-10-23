import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert, showConfirm } from '../utils/alert';

const ClubFacilities = ({ onBack }) => {
  const { managerProfile, updateManagerProfile } = useAuth();
  const { t } = useLanguage();

  const facilities = [
    {
      id: 'stadium',
      nameKey: 'stadium',
      icon: '🏟️',
      descriptionKey: 'stadiumDesc',
      levels: [
        { level: 1, cost: 20000000, revenue: 2000000, capacity: 20000, description: 'Small Stadium' },
        { level: 2, cost: 50000000, revenue: 5000000, capacity: 40000, description: 'Medium Stadium' },
        { level: 3, cost: 100000000, revenue: 10000000, capacity: 60000, description: 'Large Stadium' },
        { level: 4, cost: 200000000, revenue: 20000000, capacity: 80000, description: 'Elite Stadium' },
      ]
    },
    {
      id: 'training_ground',
      nameKey: 'trainingGround',
      icon: '🎓',
      descriptionKey: 'trainingGroundDesc',
      levels: [
        { level: 1, cost: 15000000, discount: 10, bonus: 5, description: 'Basic Training Ground' },
        { level: 2, cost: 35000000, discount: 20, bonus: 10, description: 'Modern Training Ground' },
        { level: 3, cost: 70000000, discount: 30, bonus: 15, description: 'Advanced Training Ground' },
        { level: 4, cost: 150000000, discount: 40, bonus: 20, description: 'World-Class Training Ground' },
      ]
    },
    {
      id: 'youth_academy',
      nameKey: 'youthAcademy',
      icon: '👦',
      descriptionKey: 'youthAcademyDesc',
      levels: [
        { level: 1, cost: 10000000, discount: 15, description: 'Basic Youth Academy' },
        { level: 2, cost: 25000000, discount: 30, description: 'Professional Youth Academy' },
        { level: 3, cost: 50000000, discount: 45, description: 'Elite Youth Academy' },
        { level: 4, cost: 100000000, discount: 60, description: 'World-Class Youth Academy' },
      ]
    },
    {
      id: 'medical_center',
      nameKey: 'medicalCenter',
      icon: '🏥',
      descriptionKey: 'medicalCenterDesc',
      levels: [
        { level: 1, cost: 12000000, reduction: 10, description: 'Basic Medical Center' },
        { level: 2, cost: 30000000, reduction: 20, description: 'Advanced Medical Center' },
        { level: 3, cost: 60000000, reduction: 35, description: 'State-of-the-art Medical Center' },
      ]
    },
  ];

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const formatXP = (amount) => {
    return `${(amount / 1000).toFixed(0)}k XP`;
  };

  const getCurrentLevel = (facilityId) => {
    return managerProfile?.facilities?.[facilityId] || 0;
  };

  const getTotalSquadXP = () => {
    if (!managerProfile?.squad) return 0;
    return managerProfile.squad.reduce((total, player) => total + (player.xp || 0), 0);
  };

  const handleUpgrade = (facility, level, paymentMethod) => {
    const currentLevel = getCurrentLevel(facility.id);
    const facilityName = t(facility.nameKey);

    if (currentLevel >= level) {
      showAlert(t('alreadyOwned'), `${t('alreadyHaveFacility')} ${facilityName} ${t('at')} ${t('level')} ${currentLevel}.`);
      return;
    }

    if (currentLevel !== level - 1) {
      showAlert(t('locked'), `${t('mustUpgradeFirst')} ${facilityName} ${t('to')} ${t('level')} ${level - 1} ${t('first')}`);
      return;
    }

    const levelData = facility.levels[level - 1];
    const xpCost = levelData.cost / 100; // XP cost is 1/100th of money cost (e.g., $20M = 200k XP)

    // Check payment method availability
    if (paymentMethod === 'money') {
      if (managerProfile.budget < levelData.cost) {
        showAlert(t('insufficientFunds'), `${t('needBudgetUpgrade')} ${formatCurrency(levelData.cost)} ${t('toUpgrade')}`);
        return;
      }
    } else if (paymentMethod === 'xp') {
      const totalXP = getTotalSquadXP();
      if (totalXP < xpCost) {
        showAlert(t('insufficientFunds'), `Need ${formatXP(xpCost)} to upgrade. Train your players to earn more XP!`);
        return;
      }
    }

    const benefitText = facility.id === 'stadium'
      ? `\n\n+${formatCurrency(levelData.revenue)} ${t('perWin')}\n${t('capacity')}: ${levelData.capacity.toLocaleString()}`
      : facility.id === 'training_ground'
      ? `\n\n-${levelData.discount}% ${t('discountCost')}\n+${levelData.bonus}% ${t('effectiveness')}`
      : facility.id === 'youth_academy'
      ? `\n\n-${levelData.discount}% ${t('youthTrainingCost')}`
      : `\n\n-${levelData.reduction}% ${t('injuryRisk')}`;

    const costText = paymentMethod === 'money'
      ? formatCurrency(levelData.cost)
      : formatXP(xpCost);

    showConfirm(
      t('upgradeFacility'),
      `${t('upgradeTo')} ${facilityName} ${t('to')} ${t('level')} ${level}?\n\n${t('cost')}: ${costText}${benefitText}`,
      async () => {
        const newFacilities = {
          ...(managerProfile.facilities || {}),
          [facility.id]: level
        };

        if (paymentMethod === 'money') {
          await updateManagerProfile({
            facilities: newFacilities,
            budget: managerProfile.budget - levelData.cost
          });
        } else {
          // Deduct XP from squad proportionally
          const totalXP = getTotalSquadXP();
          const updatedSquad = managerProfile.squad.map(player => {
            const playerXP = player.xp || 0;
            const xpToDeduct = Math.floor((playerXP / totalXP) * xpCost);
            return {
              ...player,
              xp: Math.max(0, playerXP - xpToDeduct)
            };
          });

          await updateManagerProfile({
            facilities: newFacilities,
            squad: updatedSquad
          });
        }

        showAlert(t('success'), `${facilityName} ${t('facilityUpgraded')} ${t('level')} ${level}!`);
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
          <Text style={styles.title}>{t('clubFacilitiesTitle')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  const totalSquadXP = getTotalSquadXP();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('clubFacilitiesTitle')}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.budget}>💰 {formatCurrency(managerProfile.budget)}</Text>
          <Text style={styles.xpBudget}>⭐ {formatXP(totalSquadXP)}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {t('investInClub')}
          </Text>
        </View>

        {facilities.map(facility => {
          const currentLevel = getCurrentLevel(facility.id);

          return (
            <View key={facility.id} style={styles.facilityCard}>
              <View style={styles.facilityHeader}>
                <Text style={styles.facilityIcon}>{facility.icon}</Text>
                <View style={styles.facilityInfo}>
                  <Text style={styles.facilityName}>{t(facility.nameKey)}</Text>
                  <Text style={styles.facilityDesc}>{t(facility.descriptionKey)}</Text>
                </View>
                {currentLevel > 0 && (
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>Lv.{currentLevel}</Text>
                  </View>
                )}
              </View>

              <View style={styles.levelsContainer}>
                {facility.levels.map((levelData) => {
                  const isOwned = currentLevel >= levelData.level;
                  const isNext = currentLevel === levelData.level - 1;
                  const isLocked = currentLevel < levelData.level - 1;

                  let benefitText = '';
                  if (facility.id === 'stadium') {
                    benefitText = `+${formatCurrency(levelData.revenue)}${t('perWin')} • ${(levelData.capacity / 1000).toFixed(0)}k ${t('capacity')}`;
                  } else if (facility.id === 'training_ground') {
                    benefitText = `-${levelData.discount}% ${t('discountCost')}, +${levelData.bonus}% ${t('effectiveness')}`;
                  } else if (facility.id === 'youth_academy') {
                    benefitText = `-${levelData.discount}% ${t('youthTrainingCost')}`;
                  } else {
                    benefitText = `-${levelData.reduction}% ${t('injuryRisk')}`;
                  }

                  const xpCost = levelData.cost / 100;

                  return (
                    <View
                      key={levelData.level}
                      style={[
                        styles.levelCard,
                        isOwned && styles.levelCardOwned,
                        isNext && styles.levelCardNext,
                        isLocked && styles.levelCardLocked
                      ]}
                    >
                      <View style={styles.levelHeader}>
                        <Text style={[styles.levelTitle, isOwned && styles.levelTitleOwned]}>
                          {t('level')} {levelData.level}
                        </Text>
                        {isOwned && <Text style={styles.ownedBadge}>✓</Text>}
                        {isLocked && <Text style={styles.lockedBadge}>🔒</Text>}
                      </View>
                      <Text style={styles.levelDesc}>{levelData.description}</Text>
                      <Text style={styles.levelBonus}>{benefitText}</Text>
                      {!isOwned && !isLocked && (
                        <View style={styles.paymentOptions}>
                          <TouchableOpacity
                            style={styles.paymentButton}
                            onPress={() => handleUpgrade(facility, levelData.level, 'money')}
                          >
                            <Text style={styles.paymentButtonText}>💰 {formatCurrency(levelData.cost)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.paymentButtonXP}
                            onPress={() => handleUpgrade(facility, levelData.level, 'xp')}
                          >
                            <Text style={styles.paymentButtonText}>⭐ {formatXP(xpCost)}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {!isOwned && isLocked && (
                        <View style={styles.levelCost}>
                          <Text style={styles.levelCostText}>🔒 Locked</Text>
                        </View>
                      )}
                    </View>
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
  headerRow: {
    flexDirection: 'row',
    gap: 15,
  },
  xpBudget: {
    fontSize: 16,
    color: '#f093fb',
    fontWeight: 'bold',
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
  facilityCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  facilityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  facilityIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  facilityInfo: {
    flex: 1,
  },
  facilityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  facilityDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  levelBadge: {
    backgroundColor: '#43e97b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  levelsContainer: {
    gap: 8,
  },
  levelCard: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: '#2d3561',
    marginBottom: 8,
  },
  levelCardOwned: {
    backgroundColor: '#1a3a2d',
    borderColor: '#43e97b',
  },
  levelCardNext: {
    borderColor: '#f5576c',
  },
  levelCardLocked: {
    opacity: 0.5,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  levelTitleOwned: {
    color: '#43e97b',
  },
  ownedBadge: {
    fontSize: 14,
    color: '#43e97b',
  },
  lockedBadge: {
    fontSize: 12,
  },
  levelDesc: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 4,
  },
  levelBonus: {
    fontSize: 12,
    color: '#f093fb',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  levelCost: {
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  levelCostText: {
    fontSize: 13,
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
  paymentOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  paymentButton: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonXP: {
    flex: 1,
    backgroundColor: '#f093fb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default ClubFacilities;
