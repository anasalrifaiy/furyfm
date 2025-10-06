import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

const Formation = ({ onBack }) => {
  const { managerProfile, updateManagerProfile } = useAuth();
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
    setLineup(prev => ({
      ...prev,
      [selectingPosition]: player
    }));
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
        style={[styles.positionSlot, { top: `${top}%`, left: `${left}%` }]}
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
      default:
        return renderFormation433();
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

      {selectingPosition && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Player for {selectingPosition}</Text>

            <ScrollView style={styles.playerList}>
              {getPlayersForPosition(selectingPosition).map(player => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerOption}
                  onPress={() => assignPlayer(player)}
                >
                  <View>
                    <Text style={styles.playerOptionName}>{player.name}</Text>
                    <Text style={styles.playerOptionDetails}>
                      {player.position} • OVR {player.overall}
                    </Text>
                  </View>
                  <Text style={styles.playerOptionRating}>{player.overall}</Text>
                </TouchableOpacity>
              ))}
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  formationSelector: {
    padding: 15,
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
    flex: 1,
    margin: 15,
    backgroundColor: '#1a5c3a',
    borderRadius: 20,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  positionSlot: {
    position: 'absolute',
    width: 70,
    height: 70,
    marginLeft: -35,
    marginTop: -35,
  },
  playerSlot: {
    backgroundColor: '#667eea',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
  },
  emptySlotText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actions: {
    padding: 20,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
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
});

export default Formation;
