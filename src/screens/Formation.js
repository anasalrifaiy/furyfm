import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

const Formation = ({ onBack }) => {
  const { managerProfile, updateManagerProfile, loading } = useAuth();
  const [selectedFormation, setSelectedFormation] = useState(managerProfile?.formation || '4-3-3');
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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Formation</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
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
      showAlert('No Players', `You don't have any players available for this position. Sign players from the Transfer Market.`);
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
      lineup: lineup
    });
    showAlert('Success', 'Your formation has been saved!');
  };

  const PositionSlot = ({ position, label, top, left }) => {
    const player = lineup[position];

    return (
      <TouchableOpacity
        style={[styles.positionSlot, {
          top: `${top}%`,
          left: `${left}%`,
          transform: [{ translateX: -35 }, { translateY: -35 }]
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
    switch (selectedFormation) {
      case '4-3-3':
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="LB" label="LB" top={65} left={10} />
            <PositionSlot position="CB1" label="CB" top={65} left={35} />
            <PositionSlot position="CB2" label="CB" top={65} left={55} />
            <PositionSlot position="RB" label="RB" top={65} left={80} />
            <PositionSlot position="CDM" label="CDM" top={45} left={45} />
            <PositionSlot position="CM1" label="CM" top={40} left={25} />
            <PositionSlot position="CM2" label="CM" top={40} left={65} />
            <PositionSlot position="LW" label="LW" top={15} left={15} />
            <PositionSlot position="ST" label="ST" top={10} left={45} />
            <PositionSlot position="RW" label="RW" top={15} left={75} />
          </>
        );
      case '4-4-2':
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="LB" label="LB" top={65} left={10} />
            <PositionSlot position="CB1" label="CB" top={65} left={35} />
            <PositionSlot position="CB2" label="CB" top={65} left={55} />
            <PositionSlot position="RB" label="RB" top={65} left={80} />
            <PositionSlot position="LM" label="LM" top={40} left={15} />
            <PositionSlot position="CM1" label="CM" top={45} left={35} />
            <PositionSlot position="CM2" label="CM" top={45} left={55} />
            <PositionSlot position="RM" label="RM" top={40} left={75} />
            <PositionSlot position="ST" label="ST" top={12} left={35} />
            <PositionSlot position="RW" label="ST" top={12} left={55} />
          </>
        );
      case '3-5-2':
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="CB1" label="CB" top={65} left={25} />
            <PositionSlot position="CB2" label="CB" top={65} left={45} />
            <PositionSlot position="RB" label="CB" top={65} left={65} />
            <PositionSlot position="LM" label="LWB" top={45} left={10} />
            <PositionSlot position="CDM" label="CDM" top={48} left={45} />
            <PositionSlot position="CM1" label="CM" top={42} left={30} />
            <PositionSlot position="CM2" label="CM" top={42} left={60} />
            <PositionSlot position="RM" label="RWB" top={45} left={80} />
            <PositionSlot position="LW" label="ST" top={12} left={35} />
            <PositionSlot position="ST" label="ST" top={12} left={55} />
          </>
        );
      case '4-2-3-1':
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="LB" label="LB" top={65} left={10} />
            <PositionSlot position="CB1" label="CB" top={65} left={35} />
            <PositionSlot position="CB2" label="CB" top={65} left={55} />
            <PositionSlot position="RB" label="RB" top={65} left={80} />
            <PositionSlot position="CDM" label="CDM" top={48} left={35} />
            <PositionSlot position="CM1" label="CDM" top={48} left={55} />
            <PositionSlot position="LW" label="LW" top={28} left={15} />
            <PositionSlot position="CM2" label="CAM" top={30} left={45} />
            <PositionSlot position="RW" label="RW" top={28} left={75} />
            <PositionSlot position="ST" label="ST" top={10} left={45} />
          </>
        );
      case '3-4-3':
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="CB1" label="CB" top={65} left={25} />
            <PositionSlot position="CB2" label="CB" top={65} left={45} />
            <PositionSlot position="RB" label="CB" top={65} left={65} />
            <PositionSlot position="LM" label="LM" top={45} left={15} />
            <PositionSlot position="CM1" label="CM" top={45} left={35} />
            <PositionSlot position="CM2" label="CM" top={45} left={55} />
            <PositionSlot position="RM" label="RM" top={45} left={75} />
            <PositionSlot position="LW" label="LW" top={15} left={15} />
            <PositionSlot position="ST" label="ST" top={10} left={45} />
            <PositionSlot position="CDM" label="RW" top={15} left={75} />
          </>
        );
      default:
        return (
          <>
            <PositionSlot position="GK" label="GK" top={85} left={45} />
            <PositionSlot position="LB" label="LB" top={65} left={10} />
            <PositionSlot position="CB1" label="CB" top={65} left={35} />
            <PositionSlot position="CB2" label="CB" top={65} left={55} />
            <PositionSlot position="RB" label="RB" top={65} left={80} />
            <PositionSlot position="CDM" label="CDM" top={45} left={45} />
            <PositionSlot position="CM1" label="CM" top={40} left={25} />
            <PositionSlot position="CM2" label="CM" top={40} left={65} />
            <PositionSlot position="LW" label="LW" top={15} left={15} />
            <PositionSlot position="ST" label="ST" top={10} left={45} />
            <PositionSlot position="RW" label="RW" top={15} left={75} />
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Formation</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formationSelector}>
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

        <View style={styles.pitch}>
          {renderFormation()}
        </View>

        <View style={styles.actions}>
          <Text style={styles.tipText}>Tap to select player • Long press to remove</Text>
          <TouchableOpacity style={styles.saveButton} onPress={saveFormation}>
            <Text style={styles.saveButtonText}>Save Formation</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {selectingPosition && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Player for {selectingPosition}</Text>

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
                        {player.position} • OVR {player.overall}
                        {isAssigned && ` • Currently at ${assignedPosition}`}
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
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#2d5016',
    borderRadius: 15,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#ffffff',
    height: 450,
    // Add grass-like gradient effect
    backgroundImage: 'repeating-linear-gradient(0deg, #2d5016 0px, #3a6b1f 40px, #2d5016 80px)',
  },
  positionSlot: {
    position: 'absolute',
    width: 70,
    height: 70,
  },
  playerSlot: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  playerSlotName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playerSlotRating: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  emptySlot: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderStyle: 'dashed',
    backdropFilter: 'blur(5px)',
  },
  emptySlotText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
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
