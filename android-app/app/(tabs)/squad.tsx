import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useTeamPlayers, useMyTeam, useTeam, useUpdatePlayerPosition, useUpdateFormation } from '@/lib/api';
import { useLocalSearchParams, router } from 'expo-router';
import { Users, ChevronLeft, X } from 'lucide-react-native';
import PlayerTradeModal from '@/components/PlayerTradeModal';

// First, let's define the valid position types
type ValidPosition = 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST' | 'CF';

const POSITION_COMPATIBILITY: Record<ValidPosition, ValidPosition[]> = {
  'GK': ['GK'],
  'CB': ['CB'],
  'LB': ['LB', 'LWB'],
  'RB': ['RB', 'RWB'],
  'LWB': ['LB', 'LWB', 'LM'],
  'RWB': ['RB', 'RWB', 'RM'],
  'CDM': ['CDM', 'CM'],
  'CM': ['CM', 'CDM', 'CAM'],
  'CAM': ['CAM', 'CM'],
  'LM': ['LM', 'LW', 'LWB'],
  'RM': ['RM', 'RW', 'RWB'],
  'LW': ['LW', 'LM'],
  'RW': ['RW', 'RM'],
  'ST': ['ST', 'CF'],
  'CF': ['CF', 'ST']
};

const getPositionColor = (position: string) => {
  if (position === 'GK') return '#FFD700';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return '#4169E1';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return '#32CD32';
  if (['ST', 'CF', 'LW', 'RW'].includes(position)) return '#FF4444';
  return '#808080';
};

const isCompatiblePosition = (playerPosition: string | null, targetPosition: ValidPosition): boolean => {
  if (!playerPosition) return true;
  return POSITION_COMPATIBILITY[targetPosition]?.includes(playerPosition as ValidPosition) || false;
};

const getBestPlayerForPosition = (players: any[], position: ValidPosition): any | null => {
  const compatiblePlayers = players.filter(p => !p.position_id && isCompatiblePosition(p.original_position, position))
    .sort((a, b) => b.rating - a.rating);
  return compatiblePlayers[0] || null;
};

const FORMATIONS = {
  '4-4-2': {
    name: '4-4-2',
    description: 'Classic balanced formation',
    positions: [
      { id: 'gk', position: 'GK' as ValidPosition, x: '50%', y: '85%' },
      { id: 'lb', position: 'LB' as ValidPosition, x: '15%', y: '65%' },
      { id: 'cb1', position: 'CB' as ValidPosition, x: '35%', y: '65%' },
      { id: 'cb2', position: 'CB' as ValidPosition, x: '65%', y: '65%' },
      { id: 'rb', position: 'RB' as ValidPosition, x: '85%', y: '65%' },
      { id: 'lm', position: 'LM' as ValidPosition, x: '15%', y: '40%' },
      { id: 'cm1', position: 'CM' as ValidPosition, x: '35%', y: '40%' },
      { id: 'cm2', position: 'CM' as ValidPosition, x: '65%', y: '40%' },
      { id: 'rm', position: 'RM' as ValidPosition, x: '85%', y: '40%' },
      { id: 'st1', position: 'ST' as ValidPosition, x: '35%', y: '15%' },
      { id: 'st2', position: 'ST' as ValidPosition, x: '65%', y: '15%' },
    ],
  },
  '4-3-3': {
    name: '4-3-3',
    description: 'Attacking formation',
    positions: [
      { id: 'gk', position: 'GK' as ValidPosition, x: '50%', y: '85%' },
      { id: 'lb', position: 'LB' as ValidPosition, x: '15%', y: '65%' },
      { id: 'cb1', position: 'CB' as ValidPosition, x: '35%', y: '65%' },
      { id: 'cb2', position: 'CB' as ValidPosition, x: '65%', y: '65%' },
      { id: 'rb', position: 'RB' as ValidPosition, x: '85%', y: '65%' },
      { id: 'cdm', position: 'CDM' as ValidPosition, x: '50%', y: '45%' },
      { id: 'cm1', position: 'CM' as ValidPosition, x: '35%', y: '40%' },
      { id: 'cm2', position: 'CM' as ValidPosition, x: '65%', y: '40%' },
      { id: 'lw', position: 'LW' as ValidPosition, x: '15%', y: '15%' },
      { id: 'st', position: 'ST' as ValidPosition, x: '50%', y: '15%' },
      { id: 'rw', position: 'RW' as ValidPosition, x: '85%', y: '15%' },
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    description: 'Midfield control',
    positions: [
      { id: 'gk', position: 'GK' as ValidPosition, x: '50%', y: '85%' },
      { id: 'cb1', position: 'CB' as ValidPosition, x: '30%', y: '65%' },
      { id: 'cb2', position: 'CB' as ValidPosition, x: '50%', y: '65%' },
      { id: 'cb3', position: 'CB' as ValidPosition, x: '70%', y: '65%' },
      { id: 'lm', position: 'LM' as ValidPosition, x: '10%', y: '40%' },
      { id: 'cm1', position: 'CM' as ValidPosition, x: '30%', y: '40%' },
      { id: 'cdm', position: 'CDM' as ValidPosition, x: '50%', y: '40%' },
      { id: 'cm2', position: 'CM' as ValidPosition, x: '70%', y: '40%' },
      { id: 'rm', position: 'RM' as ValidPosition, x: '90%', y: '40%' },
      { id: 'st1', position: 'ST' as ValidPosition, x: '35%', y: '15%' },
      { id: 'st2', position: 'ST' as ValidPosition, x: '65%', y: '15%' },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    description: 'Modern balanced formation',
    positions: [
      { id: 'gk', position: 'GK' as ValidPosition, x: '50%', y: '85%' },
      { id: 'lb', position: 'LB' as ValidPosition, x: '15%', y: '65%' },
      { id: 'cb1', position: 'CB' as ValidPosition, x: '35%', y: '65%' },
      { id: 'cb2', position: 'CB' as ValidPosition, x: '65%', y: '65%' },
      { id: 'rb', position: 'RB' as ValidPosition, x: '85%', y: '65%' },
      { id: 'cdm1', position: 'CDM' as ValidPosition, x: '35%', y: '45%' },
      { id: 'cdm2', position: 'CDM' as ValidPosition, x: '65%', y: '45%' },
      { id: 'cam', position: 'CAM' as ValidPosition, x: '50%', y: '35%' },
      { id: 'lw', position: 'LW' as ValidPosition, x: '20%', y: '25%' },
      { id: 'rw', position: 'RW' as ValidPosition, x: '80%', y: '25%' },
      { id: 'st', position: 'ST' as ValidPosition, x: '50%', y: '15%' },
    ],
  },
};

export default function SquadScreen() {
  const params = useLocalSearchParams();
  const teamId = params.teamId as string | undefined;
  
  const { data: myTeam, isLoading: myTeamLoading } = useMyTeam();
  const { data: viewTeam, isLoading: viewTeamLoading } = useTeam(teamId);
  
  const currentTeamId = teamId || myTeam?.id;
  const isMyTeam = !teamId || teamId === myTeam?.id;
  
  const { data: players = [], isLoading: playersLoading } = useTeamPlayers(currentTeamId);
  const updatePlayerPosition = useUpdatePlayerPosition();
  const updateFormation = useUpdateFormation();
  
  const [selectedFormation, setSelectedFormation] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [showPlayerSelector, setShowPlayerSelector] = useState(false);
  const [showFormationSelector, setShowFormationSelector] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [playerToTrade, setPlayerToTrade] = useState<any | null>(null);
  const [showSquadList, setShowSquadList] = useState(false);

  useEffect(() => {
    if (myTeam && !selectedFormation) {
      setSelectedFormation(myTeam.formation || '4-4-2');
    }
    if (viewTeam && teamId) {
      setSelectedFormation(viewTeam.formation || '4-4-2');
    }
  }, [myTeam, viewTeam, teamId]);

  const handleFormationChange = async (formation: string) => {
    if (!isMyTeam) return;
    
    try {
      await updateFormation.mutateAsync({
        teamId: myTeam!.id,
        formation,
      });
      setSelectedFormation(formation);
      setShowFormationSelector(false);
    } catch (error) {
      console.error('Error updating formation:', error);
      Alert.alert('Error', 'Failed to update formation');
    }
  };

  const handlePositionClick = (positionId: string, position: ValidPosition) => {
    if (!isMyTeam && !teamId) return;
    
    setSelectedPosition(positionId);
    
    // Find player in this position
    const playerInPosition = players.find(p => p.position_id === positionId);
    
    if (playerInPosition) {
      setSelectedPlayer(playerInPosition);
      setShowPlayerSelector(false);
    } else if (isMyTeam) {
      setSelectedPlayer(null);
      setShowPlayerSelector(true);
    }
  };

  const handlePlayerSelect = async (player: any) => {
    if (!selectedPosition || !isMyTeam) return;
    
    try {
      await updatePlayerPosition.mutateAsync({
        playerId: player.id,
        positionId: selectedPosition,
        position: FORMATIONS[selectedFormation as keyof typeof FORMATIONS].positions.find(p => p.id === selectedPosition)?.position || null,
      });
      
      setShowPlayerSelector(false);
      setSelectedPlayer(player);
    } catch (error) {
      console.error('Error updating player position:', error);
      Alert.alert('Error', 'Failed to update player position');
    }
  };

  const handleRemoveFromPosition = async () => {
    if (!selectedPlayer || !selectedPosition || !isMyTeam) return;
    
    try {
      await updatePlayerPosition.mutateAsync({
        playerId: selectedPlayer.id,
        positionId: null,
        position: null,
      });
      
      setSelectedPlayer(null);
    } catch (error) {
      console.error('Error removing player from position:', error);
      Alert.alert('Error', 'Failed to remove player from position');
    }
  };

  const handleTradePlayer = (player: any) => {
    if (!teamId || isMyTeam) return;
    
    setPlayerToTrade(player);
    setShowTradeModal(true);
  };

  const getCompatiblePlayers = (position: ValidPosition) => {
    return players.filter(player => 
      !player.position_id && isCompatiblePosition(player.original_position, position)
    ).sort((a, b) => b.rating - a.rating);
  };

  const handleBackToMySquad = () => {
    router.replace('/squad');
  };

  const toggleSquadList = () => {
    setShowSquadList(!showSquadList);
  };

  if (myTeamLoading || playersLoading || (teamId && viewTeamLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const currentTeam = teamId ? viewTeam : myTeam;
  const formation = selectedFormation || '4-4-2';
  const formationData = FORMATIONS[formation as keyof typeof FORMATIONS];

  // Sort players by rating for the squad list
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

  return (
    <View style={styles.container}>
      {/* Team Info Header */}
      <View style={styles.teamHeader}>
        <View style={styles.headerLeft}>
          {!isMyTeam && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackToMySquad}
            >
              <ChevronLeft size={24} color="#333" />
              <Text style={styles.backButtonText}>My Squad</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.teamInfo}>
          <Image 
            source={{ uri: currentTeam?.logo_url }} 
            style={styles.teamLogo} 
          />
          <View>
            <Text style={styles.teamName}>{currentTeam?.name}</Text>
            <Text style={styles.teamRating}>Rating: {currentTeam?.rating}</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          {isMyTeam ? (
            <TouchableOpacity 
              style={styles.formationButton}
              onPress={() => setShowFormationSelector(true)}
            >
              <Text style={styles.formationButtonText}>{formation}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.viewingBadge}>
                <Text style={styles.viewingText}>Viewing</Text>
              </View>
              <TouchableOpacity 
                style={styles.squadListButton}
                onPress={toggleSquadList}
              >
                <Users size={20} color="#4CAF50" />
                <Text style={styles.squadListButtonText}>
                  {showSquadList ? 'Hide Squad' : 'Show Squad'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Pitch View */}
      <View style={styles.pitchContainer}>
        <View style={styles.pitchBackground} />
        
        {formationData.positions.map((pos) => {
          const playerInPosition = players.find(p => p.position_id === pos.id);
          const isSelected = selectedPosition === pos.id;
          
          return (
            <TouchableOpacity
              key={pos.id}
              style={[
                styles.positionMarker,
                { left: pos.x, top: pos.y },
                isSelected && styles.selectedPosition,
                playerInPosition && { backgroundColor: getPositionColor(pos.position) }
              ]}
              onPress={() => handlePositionClick(pos.id, pos.position)}
              disabled={!isMyTeam && !playerInPosition}
            >
              <Text style={styles.positionText}>{pos.position}</Text>
              {playerInPosition && (
                <View style={styles.playerBadge}>
                  <Text style={styles.playerBadgeText}>{playerInPosition.rating}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Player Info */}
      {selectedPlayer && (
        <View style={styles.selectedPlayerInfo}>
          <View style={styles.playerInfoHeader}>
            <Text style={styles.playerName}>{selectedPlayer.name}</Text>
            <Text style={styles.playerRating}>{selectedPlayer.rating}</Text>
          </View>
          
          <View style={styles.playerAttributes}>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Position</Text>
              <Text style={styles.attributeValue}>{selectedPlayer.position || selectedPlayer.original_position || 'N/A'}</Text>
            </View>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Age</Text>
              <Text style={styles.attributeValue}>{selectedPlayer.age}</Text>
            </View>
            <View style={styles.attributeItem}>
              <Text style={styles.attributeLabel}>Value</Text>
              <Text style={styles.attributeValue}>${(selectedPlayer.value / 1000000).toFixed(1)}M</Text>
            </View>
          </View>
          
          {isMyTeam && (
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={handleRemoveFromPosition}
            >
              <Text style={styles.removeButtonText}>Remove from Position</Text>
            </TouchableOpacity>
          )}
          
          {!isMyTeam && (
            <TouchableOpacity 
              style={styles.tradeButton}
              onPress={() => handleTradePlayer(selectedPlayer)}
            >
              <Text style={styles.tradeButtonText}>Make Trade Offer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Squad List (for viewing other teams) */}
      {!isMyTeam && showSquadList && (
        <View style={styles.squadListContainer}>
          <Text style={styles.squadListTitle}>Squad Players</Text>
          <FlatList
            data={sortedPlayers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.squadListItem}
                onPress={() => handleTradePlayer(item)}
              >
                <View style={[styles.squadPositionBadge, { backgroundColor: getPositionColor(item.original_position) }]}>
                  <Text style={styles.squadPositionText}>{item.original_position}</Text>
                </View>
                <View style={styles.squadPlayerInfo}>
                  <Text style={styles.squadPlayerName}>{item.name}</Text>
                  <Text style={styles.squadPlayerStats}>
                    Rating: {item.rating} • Age: {item.age} • Value: ${(item.value / 1000000).toFixed(1)}M
                  </Text>
                </View>
                <Text style={styles.squadPlayerRating}>{item.rating}</Text>
              </TouchableOpacity>
            )}
            style={styles.squadList}
          />
        </View>
      )}

      {/* Player Selector Modal */}
      <Modal
        visible={showPlayerSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPlayerSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Player for {selectedPosition ? 
                  FORMATIONS[formation as keyof typeof FORMATIONS].positions.find(p => p.id === selectedPosition)?.position : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowPlayerSelector(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.playerList}>
              {selectedPosition && getCompatiblePlayers(
                FORMATIONS[formation as keyof typeof FORMATIONS].positions.find(p => p.id === selectedPosition)?.position as ValidPosition
              ).map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerListItem}
                  onPress={() => handlePlayerSelect(player)}
                >
                  <View style={[styles.playerPositionBadge, { backgroundColor: getPositionColor(player.original_position) }]}>
                    <Text style={styles.playerPositionText}>{player.original_position}</Text>
                  </View>
                  <View style={styles.playerListInfo}>
                    <Text style={styles.playerListName}>{player.name}</Text>
                    <Text style={styles.playerListStats}>Rating: {player.rating} • Age: {player.age}</Text>
                  </View>
                  <Text style={styles.playerListRating}>{player.rating}</Text>
                </TouchableOpacity>
              ))}
              
              {selectedPosition && getCompatiblePlayers(
                FORMATIONS[formation as keyof typeof FORMATIONS].positions.find(p => p.id === selectedPosition)?.position as ValidPosition
              ).length === 0 && (
                <Text style={styles.noPlayersText}>No compatible players available</Text>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPlayerSelector(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Formation Selector Modal */}
      <Modal
        visible={showFormationSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormationSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Formation</Text>
              <TouchableOpacity onPress={() => setShowFormationSelector(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formationList}>
              {Object.entries(FORMATIONS).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.formationItem,
                    formation === key && styles.selectedFormationItem
                  ]}
                  onPress={() => handleFormationChange(key)}
                >
                  <View style={styles.formationHeader}>
                    <Text style={styles.formationName}>{value.name}</Text>
                    {formation === key && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.formationDescription}>{value.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFormationSelector(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Trade Modal */}
      {playerToTrade && (
        <PlayerTradeModal
          visible={showTradeModal}
          onClose={() => {
            setShowTradeModal(false);
            setPlayerToTrade(null);
          }}
          player={playerToTrade}
          toTeamId={currentTeamId!}
          toTeamName={currentTeam?.name || ''}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textAlign: 'left',
  },
  teamRating: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#333',
  },
  formationButton: {
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formationButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#4CAF50',
  },
  viewingBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  viewingText: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    fontSize: 12,
  },
  squadListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  squadListButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#4CAF50',
    fontSize: 12,
    marginLeft: 4,
  },
  pitchContainer: {
    flex: 1,
    position: 'relative',
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pitchBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#2E7D32',
    opacity: 0.9,
  },
  positionMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  selectedPosition: {
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  positionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  playerBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#4CAF50',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  playerBadgeText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  selectedPlayerInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  playerInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  playerRating: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#4CAF50',
  },
  playerAttributes: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  attributeItem: {
    flex: 1,
    alignItems: 'center',
  },
  attributeLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
  },
  attributeValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  removeButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  tradeButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tradeButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  playerList: {
    maxHeight: 400,
  },
  playerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playerPositionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playerPositionText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  playerListInfo: {
    flex: 1,
  },
  playerListName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  playerListStats: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
  },
  playerListRating: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#4CAF50',
  },
  noPlayersText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  modalCloseButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  formationList: {
    maxHeight: 300,
  },
  formationItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedFormationItem: {
    backgroundColor: '#f0f9f0',
  },
  formationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  formationName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  formationDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
  },
  currentBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  currentBadgeText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  squadListContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 15,
    maxHeight: 300,
  },
  squadListTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 10,
  },
  squadList: {
    maxHeight: 250,
  },
  squadListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  squadPositionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  squadPositionText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  squadPlayerInfo: {
    flex: 1,
  },
  squadPlayerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  squadPlayerStats: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#666',
  },
  squadPlayerRating: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 8,
  },
});
