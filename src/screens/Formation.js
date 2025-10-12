import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { showAlert } from '../utils/alert';

const Formation = ({ onBack }) => {
  const { managerProfile, updateManagerProfile, loading } = useAuth();
  const { t } = useLanguage();
  const [selectedFormation, setSelectedFormation] = useState(managerProfile?.formation || '4-3-3');
  const [selectedTactic, setSelectedTactic] = useState(managerProfile?.tactic || 'Balanced');
  const [lineup, setLineup] = useState(managerProfile?.lineup || {
    GK: null,
    LB: null,
    CB1: null,
    CB2: null,
    RB: null,
    CDM: null,
    CM1: null,
    CM2: null,
    LW: null,
    ST: null,
    RW: null
  });
  const [selectingPosition, setSelectingPosition] = useState(null);

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('formationTitle')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  const formations = {
    '4-3-3': { defenders: 4, midfielders: 3, forwards: 3 },
    '4-4-2': { defenders: 4, midfielders: 4, forwards: 2 },
    '3-5-2': { defenders: 3, midfielders: 5, forwards: 2 },
    '4-2-3-1': { defenders: 4, midfielders: 5, forwards: 1 },
    '3-4-3': { defenders: 3, midfielders: 4, forwards: 3 },
  };

  const squad = managerProfile?.squad || [];

  const getPlayersForPosition = (position) => {
    const positionMap = {
      GK: ['GK'],
      LB: ['LB', 'LWB'],
      CB1: ['CB'],
      CB2: ['CB'],
      RB: ['RB', 'RWB'],
      CDM: ['CDM', 'CM'],
      CM1: ['CM', 'CAM', 'CDM'],
      CM2: ['CM', 'CAM', 'CDM'],
      CAM: ['CAM', 'CM'],
      LW: ['LW', 'LM'],
      ST: ['ST'],
      RW: ['RW', 'RM'],
      LM: ['LM', 'LW'],
      RM: ['RM', 'RW'],
    };

    return squad.filter(player =>
      positionMap[position]?.includes(player.position)
    );
  };

  const handleSelectPlayer = (position) => {
    const availablePlayers = getPlayersForPosition(position);
    if (availablePlayers.length === 0) {
      showAlert(t('noPlayers'), t('noPlayersAvailable'));
      return;
    }
    setSelectingPosition(position);
  };

  const assignPlayer = (player) => {
    // Check if player is already assigned to another position
    const currentPosition = Object.keys(lineup).find(pos => lineup[pos]?.id === player.id);

    if (currentPosition && currentPosition !== selectingPosition) {
      // Remove from current position and assign to new position
      setLineup(prev => ({
        ...prev,
        [currentPosition]: null,
        [selectingPosition]: player
      }));
    } else {
      // Just assign to the position
      setLineup(prev => ({
        ...prev,
        [selectingPosition]: player
      }));
    }

    setSelectingPosition(null);
  };

  const removePlayer = (position) => {
    setLineup(prev => ({
      ...prev,
      [position]: null
    }));
  };

  const saveFormation = async () => {
    await updateManagerProfile({
      formation: selectedFormation,
      tactic: selectedTactic,
      lineup: lineup
    });
    showAlert(t('success'), t('formationSaved'));
  };

  const tactics = ['Defensive', 'Balanced', 'Attacking'];

  const getTacticDescription = (tactic) => {
    switch(tactic) {
      case 'Defensive':
        return t('defensiveDesc');
      case 'Balanced':
        return t('balancedDesc');
      case 'Attacking':
        return t('attackingDesc');
      default:
        return '';
    }
  };

  const PositionSlot = ({ position, label, top, left }) => {
    const player = lineup[position];

    return (
      <TouchableOpacity
        style={[styles.positionSlot, {
          top: top,
          left: left,
        }]}
        onPress={() => player ? null : handleSelectPlayer(position)}
        onLongPress={() => player && removePlayer(position)}
      >
        {player ? (
          <View style={styles.playerSlot}>
            <Text style={styles.playerSlotName}>{player.name.split(' ').pop()}</Text>
            <Text style={styles.playerSlotRating}>{player.overall}</Text>
          </View>
        ) : (
          <View style={styles.emptySlot}>
            <Text style={styles.emptySlotText}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFormation = () => {
    const pitchWidth = 350;
    const pitchHeight = 550;

    // Helper to calculate centered positions (25 is half of 50px slot size)
    const pos = (topPercent, leftPercent) => ({
      top: (pitchHeight * topPercent / 100) - 25,
      left: (pitchWidth * leftPercent / 100) - 25
    });

    switch (selectedFormation) {
      case '4-3-3':
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="LB" label="LB" {...pos(70, 15)} />
            <PositionSlot position="CB1" label="CB" {...pos(73, 37)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 63)} />
            <PositionSlot position="RB" label="RB" {...pos(70, 85)} />
            <PositionSlot position="CDM" label="CDM" {...pos(55, 50)} />
            <PositionSlot position="CM1" label="CM" {...pos(45, 28)} />
            <PositionSlot position="CM2" label="CM" {...pos(45, 72)} />
            <PositionSlot position="LW" label="LW" {...pos(22, 18)} />
            <PositionSlot position="ST" label="ST" {...pos(18, 50)} />
            <PositionSlot position="RW" label="RW" {...pos(22, 82)} />
          </>
        );
      case '4-4-2':
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="LB" label="LB" {...pos(70, 15)} />
            <PositionSlot position="CB1" label="CB" {...pos(73, 37)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 63)} />
            <PositionSlot position="RB" label="RB" {...pos(70, 85)} />
            <PositionSlot position="LM" label="LM" {...pos(48, 18)} />
            <PositionSlot position="CM1" label="CM" {...pos(52, 37)} />
            <PositionSlot position="CM2" label="CM" {...pos(52, 63)} />
            <PositionSlot position="RM" label="RM" {...pos(48, 82)} />
            <PositionSlot position="ST" label="ST" {...pos(20, 37)} />
            <PositionSlot position="RW" label="ST" {...pos(20, 63)} />
          </>
        );
      case '3-5-2':
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="CB1" label="CB" {...pos(72, 28)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 50)} />
            <PositionSlot position="RB" label="CB" {...pos(72, 72)} />
            <PositionSlot position="LM" label="LWB" {...pos(52, 12)} />
            <PositionSlot position="CDM" label="CDM" {...pos(55, 50)} />
            <PositionSlot position="CM1" label="CM" {...pos(48, 32)} />
            <PositionSlot position="CM2" label="CM" {...pos(48, 68)} />
            <PositionSlot position="RM" label="RWB" {...pos(52, 88)} />
            <PositionSlot position="LW" label="ST" {...pos(20, 37)} />
            <PositionSlot position="ST" label="ST" {...pos(20, 63)} />
          </>
        );
      case '4-2-3-1':
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="LB" label="LB" {...pos(70, 15)} />
            <PositionSlot position="CB1" label="CB" {...pos(73, 37)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 63)} />
            <PositionSlot position="RB" label="RB" {...pos(70, 85)} />
            <PositionSlot position="CDM" label="CDM" {...pos(56, 37)} />
            <PositionSlot position="CM1" label="CDM" {...pos(56, 63)} />
            <PositionSlot position="LW" label="LW" {...pos(35, 18)} />
            <PositionSlot position="CM2" label="CAM" {...pos(38, 50)} />
            <PositionSlot position="RW" label="RW" {...pos(35, 82)} />
            <PositionSlot position="ST" label="ST" {...pos(18, 50)} />
          </>
        );
      case '3-4-3':
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="CB1" label="CB" {...pos(72, 28)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 50)} />
            <PositionSlot position="RB" label="CB" {...pos(72, 72)} />
            <PositionSlot position="LM" label="LM" {...pos(50, 18)} />
            <PositionSlot position="CM1" label="CM" {...pos(52, 37)} />
            <PositionSlot position="CM2" label="CM" {...pos(52, 63)} />
            <PositionSlot position="RM" label="RM" {...pos(50, 82)} />
            <PositionSlot position="LW" label="LW" {...pos(22, 18)} />
            <PositionSlot position="ST" label="ST" {...pos(18, 50)} />
            <PositionSlot position="CDM" label="RW" {...pos(22, 82)} />
          </>
        );
      default:
        return (
          <>
            <PositionSlot position="GK" label="GK" {...pos(92, 50)} />
            <PositionSlot position="LB" label="LB" {...pos(70, 15)} />
            <PositionSlot position="CB1" label="CB" {...pos(73, 37)} />
            <PositionSlot position="CB2" label="CB" {...pos(73, 63)} />
            <PositionSlot position="RB" label="RB" {...pos(70, 85)} />
            <PositionSlot position="CDM" label="CDM" {...pos(55, 50)} />
            <PositionSlot position="CM1" label="CM" {...pos(45, 28)} />
            <PositionSlot position="CM2" label="CM" {...pos(45, 72)} />
            <PositionSlot position="LW" label="LW" {...pos(22, 18)} />
            <PositionSlot position="ST" label="ST" {...pos(18, 50)} />
            <PositionSlot position="RW" label="RW" {...pos(22, 82)} />
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('formationTitle')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formationSelector}>
          <Text style={styles.selectorLabel}>{t('formationTitle')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.keys(formations).map(formation => (
              <TouchableOpacity
                key={formation}
                style={[
                  styles.formationChip,
                  selectedFormation === formation && styles.formationChipActive
                ]}
                onPress={() => setSelectedFormation(formation)}
              >
                <Text style={[
                  styles.formationText,
                  selectedFormation === formation && styles.formationTextActive
                ]}>
                  {formation}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tacticsSelector}>
          <Text style={styles.selectorLabel}>{t('tacticsTitle')}</Text>
          <View style={styles.tacticsGrid}>
            {tactics.map(tactic => (
              <TouchableOpacity
                key={tactic}
                style={[
                  styles.tacticCard,
                  selectedTactic === tactic && styles.tacticCardActive
                ]}
                onPress={() => setSelectedTactic(tactic)}
              >
                <Text style={[
                  styles.tacticTitle,
                  selectedTactic === tactic && styles.tacticTitleActive
                ]}>
                  {t(tactic.toLowerCase())}
                </Text>
                <Text style={styles.tacticDesc}>{getTacticDescription(tactic)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.pitch}>
          {renderFormation()}
        </View>

        <View style={styles.actions}>
          <Text style={styles.tipText}>{t('tapToSelect')}</Text>
          <TouchableOpacity style={styles.saveButton} onPress={saveFormation}>
            <Text style={styles.saveButtonText}>{t('saveFormation')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {selectingPosition && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('selectPlayerFor')} {selectingPosition}</Text>

            <ScrollView style={styles.playerList}>
              {getPlayersForPosition(selectingPosition).map(player => {
                const assignedPosition = Object.keys(lineup).find(pos => lineup[pos]?.id === player.id);
                const isAssigned = assignedPosition && assignedPosition !== selectingPosition;

                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerOption, isAssigned && styles.playerOptionAssigned]}
                    onPress={() => assignPlayer(player)}
                  >
                    <View>
                      <Text style={styles.playerOptionName}>{player.name}</Text>
                      <Text style={styles.playerOptionDetails}>
                        {player.position} • {t('ovr')} {player.overall}
                        {isAssigned && ` • ${t('currentlyAt')} ${assignedPosition}`}
                      </Text>
                    </View>
                    <Text style={styles.playerOptionRating}>{player.overall}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSelectingPosition(null)}
            >
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    zIndex: 100,
    paddingTop: 20,
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
  },
  content: {
    flex: 1,
  },
  formationSelector: {
    padding: 15,
    paddingBottom: 10,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  tacticsSelector: {
    padding: 15,
    paddingTop: 0,
  },
  tacticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tacticCard: {
    flex: 1,
    backgroundColor: '#1a1f3a',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#2d3561',
    alignItems: 'center',
  },
  tacticCardActive: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    borderColor: '#f5576c',
  },
  tacticTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 4,
  },
  tacticTitleActive: {
    color: '#ffffff',
  },
  tacticDesc: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  formationChip: {
    backgroundColor: '#1a1f3a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  formationChipActive: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    borderColor: '#43e97b',
  },
  formationText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formationTextActive: {
    color: '#ffffff',
  },
  pitch: {
    marginHorizontal: 'auto',
    marginBottom: 15,
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: '#2d5016',
    borderRadius: 15,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#ffffff',
    width: 350,
    height: 550,
    maxWidth: '100%',
    alignSelf: 'center',
    // Add grass-like gradient effect
    backgroundImage: 'repeating-linear-gradient(0deg, #2d5016 0px, #3a6b1f 40px, #2d5016 80px)',
  },
  positionSlot: {
    position: 'absolute',
    width: 50,
    height: 50,
  },
  playerSlot: {
    background: 'linear-gradient(145deg, #667eea 0%, #764ba2 50%, #5a67d8 100%)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    boxShadow: '0 8px 16px rgba(102, 126, 234, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
    transform: 'perspective(100px) rotateX(5deg)',
  },
  playerSlotName: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 10,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  playerSlotRating: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 1,
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(255, 255, 255, 0.3)',
  },
  emptySlot: {
    background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
    backdropFilter: 'blur(5px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
    transform: 'perspective(100px) rotateX(3deg)',
  },
  emptySlotText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
  },
  actions: {
    padding: 15,
    paddingBottom: 20,
    alignItems: 'center',
  },
  tipText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 15,
    textAlign: 'center',
  },
  saveButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1f3a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  playerList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  playerOption: {
    backgroundColor: '#252b54',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerOptionAssigned: {
    backgroundColor: '#3d4468',
    borderWidth: 1,
    borderColor: '#ffa726',
  },
  playerOptionName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerOptionDetails: {
    color: '#888',
    fontSize: 13,
  },
  playerOptionRating: {
    color: '#43e97b',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#2d3561',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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

export default Formation;
