import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, update } from 'firebase/database';
import { showAlert, showConfirm } from '../utils/alert';
import Portal from '../components/Portal';

const Training = ({ onBack }) => {
  const { managerProfile, updateManagerProfile } = useAuth();
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const getTrainingCost = (player) => {
    const age = player.age;
    let baseCost = 500000 + (player.overall * 100000);

    // Age-based discounts
    if (age <= 21) {
      baseCost = baseCost * 0.3; // 70% cheaper for young talents (21 and under)
    } else if (age <= 24) {
      baseCost = baseCost * 0.5; // 50% cheaper for young players (22-24)
    } else if (age <= 27) {
      baseCost = baseCost * 0.8; // 20% cheaper for prime age (25-27)
    } else if (age >= 32) {
      baseCost = baseCost * 1.5; // 50% more expensive for veterans (32+)
    }

    // Apply training ground discount if available
    const trainingGroundLevel = managerProfile?.facilities?.training_ground || 0;
    if (trainingGroundLevel > 0) {
      const discounts = [0, 10, 20, 30, 40];
      baseCost = baseCost * (1 - discounts[trainingGroundLevel] / 100);
    }

    // Apply youth academy discount for young players
    if (age <= 23) {
      const youthAcademyLevel = managerProfile?.facilities?.youth_academy || 0;
      if (youthAcademyLevel > 0) {
        const discounts = [0, 15, 30, 45, 60];
        baseCost = baseCost * (1 - discounts[youthAcademyLevel] / 100);
      }
    }

    return Math.floor(baseCost);
  };

  const getTrainingSuccessRate = (player) => {
    const age = player.age;
    let successRate = 100;

    // Age affects success rate
    if (age <= 21) {
      successRate = 95; // 95% chance for young talents
    } else if (age <= 24) {
      successRate = 90; // 90% chance for young players
    } else if (age <= 27) {
      successRate = 85; // 85% chance for prime age
    } else if (age <= 30) {
      successRate = 70; // 70% chance for experienced
    } else {
      successRate = 50; // 50% chance for veterans
    }

    // Training ground bonus
    const trainingGroundLevel = managerProfile?.facilities?.training_ground || 0;
    if (trainingGroundLevel > 0) {
      const bonuses = [0, 5, 10, 15, 20];
      successRate = Math.min(100, successRate + bonuses[trainingGroundLevel]);
    }

    return successRate;
  };

  const getXPForNextLevel = (player) => {
    // XP needed increases with each level
    // Reduced: 20 XP per level above 60
    // Example: 70 rated needs 200 XP (4 goals)
    return Math.max(100, (player.overall - 60) * 20);
  };

  const trainWithMoney = (player) => {
    const cost = getTrainingCost(player);
    const successRate = getTrainingSuccessRate(player);

    if (managerProfile.budget < cost) {
      showAlert('Insufficient Funds', `You need ${formatCurrency(cost)} to train ${player.name}.`);
      return;
    }

    const ageBonus = player.age <= 21 ? '\n\n🌟 Young Talent Bonus: 70% cheaper!' :
                     player.age <= 24 ? '\n\n⭐ Youth Bonus: 50% cheaper!' : '';

    showConfirm(
      'Train Player',
      `Train ${player.name} (Age ${player.age}) for ${formatCurrency(cost)}?\n\nSuccess Rate: ${successRate}%${ageBonus}`,
      async () => {
        const newBudget = managerProfile.budget - cost;

        // Check if training succeeds
        const success = Math.random() * 100 < successRate;

        if (success) {
          // Find player in squad and update
          const updatedSquad = managerProfile.squad.map(p => {
            if (p.id === player.id) {
              const newRating = Math.min(99, p.overall + 1);
              const newPrice = Math.floor(p.price * 1.15); // Price increases by 15%
              return {
                ...p,
                overall: newRating,
                price: newPrice
              };
            }
            return p;
          });

          await updateManagerProfile({
            squad: updatedSquad,
            budget: newBudget
          });

          showAlert('Success!', `${player.name} has been trained successfully! New rating: ${Math.min(99, player.overall + 1)}`);
        } else {
          await updateManagerProfile({ budget: newBudget });
          showAlert('Training Failed', `${player.name}'s training was unsuccessful. The cost was still spent, but no improvement gained.`);
        }

        setSelectedPlayer(null);
      },
      () => {}
    );
  };

  const trainWithXP = (player) => {
    const xpNeeded = getXPForNextLevel(player);
    const currentXP = player.xp || 0;

    if (currentXP < xpNeeded) {
      showAlert('Insufficient XP', `${player.name} needs ${xpNeeded - currentXP} more XP to level up. Players gain XP by scoring goals!`);
      return;
    }

    showConfirm(
      'Use XP to Train',
      `Use ${xpNeeded} XP to improve ${player.name}'s rating by 1?`,
      async () => {
        // Find player in squad and update
        const updatedSquad = managerProfile.squad.map(p => {
          if (p.id === player.id) {
            const newRating = Math.min(99, p.overall + 1);
            const newPrice = Math.floor(p.price * 1.15);
            const newXP = (p.xp || 0) - xpNeeded;
            return {
              ...p,
              overall: newRating,
              price: newPrice,
              xp: newXP
            };
          }
          return p;
        });

        await updateManagerProfile({ squad: updatedSquad });

        showAlert('Success!', `${player.name} has leveled up! New rating: ${Math.min(99, player.overall + 1)}`);
        setSelectedPlayer(null);
      },
      () => {}
    );
  };

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Training Center</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const squad = managerProfile.squad || [];

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Training Center</Text>
          <Text style={styles.budget}>Budget: {formatCurrency(managerProfile.budget)}</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🎓 Training System</Text>
            <Text style={styles.infoText}>• Train players to improve their rating</Text>
            <Text style={styles.infoText}>• Pay with money or use XP from scoring goals</Text>
            <Text style={styles.infoText}>• Younger players (≤21) train 70% cheaper!</Text>
            <Text style={styles.infoText}>• Young players (22-24) train 50% cheaper!</Text>
            <Text style={styles.infoText}>• Veterans (32+) train 50% more expensive</Text>
            <Text style={styles.infoText}>• Success rates vary by age (younger = better)</Text>
          </View>

          {squad.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No players to train</Text>
              <Text style={styles.emptyDesc}>Sign players from the Transfer Market to start training!</Text>
            </View>
          ) : (
            squad.map(player => {
              const trainingCost = getTrainingCost(player);
              const successRate = getTrainingSuccessRate(player);
              const xpNeeded = getXPForNextLevel(player);
              const currentXP = player.xp || 0;
              const xpProgress = (currentXP / xpNeeded) * 100;

              const ageLabel = player.age <= 21 ? '🌟' :
                              player.age <= 24 ? '⭐' :
                              player.age >= 32 ? '👴' : '';

              return (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerCard}
                  onPress={() => setSelectedPlayer(player)}
                >
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{ageLabel} {player.name}</Text>
                    <Text style={styles.playerDetails}>
                      {player.position} • {player.age} years • {player.nationality}
                    </Text>
                    <Text style={styles.trainingInfo}>
                      Cost: {formatCurrency(trainingCost)} • Success: {successRate}%
                    </Text>
                  </View>

                  <View style={styles.playerStats}>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingLabel}>OVR</Text>
                      <Text style={styles.ratingValue}>{player.overall}</Text>
                    </View>

                    <View style={styles.xpSection}>
                      <Text style={styles.xpLabel}>XP: {currentXP}/{xpNeeded}</Text>
                      <View style={styles.xpBarContainer}>
                        <View style={[styles.xpBar, { width: `${Math.min(100, xpProgress)}%` }]} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {selectedPlayer && (
        <Portal>
          <View style={styles.modalOverlay} pointerEvents="auto">
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setSelectedPlayer(null)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Train {selectedPlayer.name}</Text>
              <Text style={styles.modalSubtitle}>
                Current Rating: {selectedPlayer.overall} → {Math.min(99, selectedPlayer.overall + 1)}
              </Text>

              <View style={styles.trainingOptions}>
                <View style={styles.optionCard}>
                  <Text style={styles.optionIcon}>💰</Text>
                  <Text style={styles.optionTitle}>Money Training</Text>
                  <Text style={styles.optionCost}>{formatCurrency(getTrainingCost(selectedPlayer))}</Text>
                  <Text style={styles.optionDesc}>Instant improvement</Text>
                  <TouchableOpacity
                    style={styles.trainButton}
                    onPress={() => trainWithMoney(selectedPlayer)}
                  >
                    <Text style={styles.trainButtonText}>Train Now</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.optionCard}>
                  <Text style={styles.optionIcon}>⭐</Text>
                  <Text style={styles.optionTitle}>XP Training</Text>
                  <Text style={styles.optionCost}>
                    {selectedPlayer.xp || 0}/{getXPForNextLevel(selectedPlayer)} XP
                  </Text>
                  <Text style={styles.optionDesc}>Earned from goals</Text>
                  <TouchableOpacity
                    style={[
                      styles.trainButton,
                      (selectedPlayer.xp || 0) < getXPForNextLevel(selectedPlayer) && styles.trainButtonDisabled
                    ]}
                    onPress={() => trainWithXP(selectedPlayer)}
                    disabled={(selectedPlayer.xp || 0) < getXPForNextLevel(selectedPlayer)}
                  >
                    <Text style={styles.trainButtonText}>
                      {(selectedPlayer.xp || 0) >= getXPForNextLevel(selectedPlayer) ? 'Level Up' : 'Need More XP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedPlayer(null)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Portal>
      )}
    </>
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
    fontSize: 14,
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
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 5,
    lineHeight: 20,
  },
  playerCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  playerInfo: {
    marginBottom: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  playerDetails: {
    fontSize: 13,
    color: '#888',
    marginBottom: 3,
  },
  playerClub: {
    fontSize: 12,
    color: '#667eea',
  },
  trainingInfo: {
    fontSize: 11,
    color: '#f093fb',
    fontWeight: 'bold',
    marginTop: 4,
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  ratingBadge: {
    backgroundColor: '#43e97b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 60,
  },
  ratingLabel: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  xpSection: {
    flex: 1,
  },
  xpLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  xpBarContainer: {
    height: 8,
    backgroundColor: '#2d3561',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 1,
  },
  modalContent: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#2d3561',
    zIndex: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#43e97b',
    marginBottom: 25,
    textAlign: 'center',
  },
  trainingOptions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#252b54',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  optionCost: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f5576c',
    marginBottom: 5,
  },
  optionDesc: {
    fontSize: 11,
    color: '#888',
    marginBottom: 15,
  },
  trainButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  trainButtonDisabled: {
    background: 'linear-gradient(135deg, #2d3561 0%, #1a1f3a 100%)',
    opacity: 0.5,
  },
  trainButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  closeButton: {
    backgroundColor: '#2d3561',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Training;
