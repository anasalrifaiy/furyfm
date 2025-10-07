import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, update } from 'firebase/database';

const Squad = ({ onBack }) => {
  const { managerProfile, updateManagerProfile, loading } = useAuth();
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Squad</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const handleSellPlayer = async (player) => {
    showAlert(
      'Sell Player',
      `Are you sure you want to list ${player.name} on the transfer market?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'List for Sale',
          onPress: async () => {
            // Remove from squad
            const newSquad = managerProfile.squad.filter(p => p.id !== player.id);

            // Add back to market
            await update(ref(database, `market/${player.id}`), { onMarket: true, ownerId: null });
            await updateManagerProfile({ squad: newSquad });

            showAlert('Success', `${player.name} has been listed on the transfer market.`);
          }
        }
      ]
    );
  };

  const squad = managerProfile?.squad || [];
  const squadValue = squad.reduce((sum, player) => sum + player.price, 0);

  // Group players by position
  const goalkeepers = squad.filter(p => p.position === 'GK');
  const defenders = squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));
  const midfielders = squad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position));
  const forwards = squad.filter(p => ['LW', 'RW', 'ST'].includes(p.position));

  const PositionSection = ({ title, players, color }) => (
    <View style={styles.positionSection}>
      <Text style={[styles.sectionTitle, { color }]}>{title} ({players.length})</Text>
      {players.length === 0 ? (
        <Text style={styles.emptyText}>No players in this position</Text>
      ) : (
        players.map(player => (
          <TouchableOpacity
            key={player.id}
            style={styles.playerCard}
            onPress={() => setSelectedPlayer(player)}
          >
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerDetails}>{player.age} • {player.position} • {player.nationality}</Text>
              <Text style={styles.playerClub}>{player.club}</Text>
              <Text style={styles.playerRating}>OVR: {player.overall}</Text>
            </View>
            <View style={styles.playerValue}>
              <Text style={styles.playerPrice}>{formatCurrency(player.price)}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Squad</Text>
        <View style={styles.squadStats}>
          <Text style={styles.statText}>Squad Size: {squad.length}</Text>
          <Text style={styles.statText}>Total Value: {formatCurrency(squadValue)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <PositionSection title="Goalkeepers" players={goalkeepers} color="#4facfe" />
          <PositionSection title="Defenders" players={defenders} color="#43e97b" />
          <PositionSection title="Midfielders" players={midfielders} color="#f093fb" />
          <PositionSection title="Forwards" players={forwards} color="#f5576c" />

          {squad.length === 0 && (
            <View style={styles.emptySquad}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Your squad is empty</Text>
              <Text style={styles.emptyDesc}>Head to the Transfer Market to sign your first players!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>

    {selectedPlayer && (
      <View style={styles.modalOverlay} pointerEvents="auto">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedPlayer(null)}
        />
        <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedPlayer.name}</Text>
            <Text style={styles.modalSubtitle}>{selectedPlayer.position} • {selectedPlayer.club}</Text>

            <View style={styles.playerStats}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Age:</Text>
                <Text style={styles.statValue}>{selectedPlayer.age}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Nationality:</Text>
                <Text style={styles.statValue}>{selectedPlayer.nationality}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>League:</Text>
                <Text style={styles.statValue}>{selectedPlayer.league}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Overall:</Text>
                <Text style={styles.statValue}>{selectedPlayer.overall}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Value:</Text>
                <Text style={styles.statValue}>{formatCurrency(selectedPlayer.price)}</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectedPlayer(null)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sellButton}
                onPress={() => {
                  setSelectedPlayer(null);
                  handleSellPlayer(selectedPlayer);
                }}
              >
                <Text style={styles.sellButtonText}>Sell Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    marginBottom: 12,
  },
  squadStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
  },
  statText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  positionSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    marginLeft: 10,
  },
  playerCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  playerDetails: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  playerClub: {
    fontSize: 12,
    color: '#667eea',
    marginBottom: 2,
  },
  playerRating: {
    fontSize: 13,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  playerValue: {
    alignItems: 'flex-end',
  },
  playerPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f5576c',
  },
  emptySquad: {
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
    maxWidth: 400,
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
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  playerStats: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  statLabel: {
    fontSize: 16,
    color: '#888',
  },
  statValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2d3561',
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sellButton: {
    flex: 1,
    background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  sellButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
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

export default Squad;
