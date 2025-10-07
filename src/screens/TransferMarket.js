import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { initialPlayers } from '../data/players';
import { showAlert } from '../utils/alert';

const TransferMarket = ({ onBack }) => {
  const { currentUser, managerProfile, updateManagerProfile, loading } = useAuth();
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('All');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => {
    if (managerProfile) {
      loadMarketPlayers();
    }
  }, [managerProfile]);

  const loadMarketPlayers = async () => {
    // Load players from database, if not initialized, use initial data
    const marketRef = ref(database, 'market');
    const snapshot = await get(marketRef);

    if (snapshot.exists()) {
      const marketData = snapshot.val();
      setPlayers(Object.values(marketData).filter(p => p.onMarket));
    } else {
      // Initialize market with all players
      const marketData = {};
      initialPlayers.forEach(player => {
        marketData[player.id] = player;
      });
      await update(ref(database, 'market'), marketData);
      setPlayers(initialPlayers.filter(p => p.onMarket));
    }
  };

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const handleMakeOffer = (player) => {
    setSelectedPlayer(player);
    setOfferAmount((player.price / 1000000).toString());
  };

  const submitOffer = async () => {
    if (!selectedPlayer || !offerAmount) return;

    const offerValue = parseFloat(offerAmount) * 1000000;

    if (offerValue > managerProfile.budget) {
      showAlert('Insufficient Funds', 'You don\'t have enough budget for this offer.');
      return;
    }

    if (offerValue < selectedPlayer.price * 0.7) {
      showAlert('Offer Too Low', 'Your offer is too low. Try offering at least 70% of the asking price.');
      return;
    }

    // Simple negotiation: 80% chance of acceptance if offer >= 90% of price
    const acceptanceThreshold = selectedPlayer.price * 0.9;
    const isAccepted = offerValue >= acceptanceThreshold || Math.random() > 0.5;

    if (isAccepted) {
      // Add player to squad
      const newSquad = [...(managerProfile.squad || []), selectedPlayer];
      const newBudget = managerProfile.budget - offerValue;

      // Remove player from market
      await update(ref(database, `market/${selectedPlayer.id}`), { onMarket: false, ownerId: currentUser.uid });
      await updateManagerProfile({ squad: newSquad, budget: newBudget });

      showAlert('Success!', `${selectedPlayer.name} has joined your squad for ${formatCurrency(offerValue)}!`);
      setSelectedPlayer(null);
      setOfferAmount('');
      loadMarketPlayers();
    } else {
      showAlert('Offer Rejected', 'The club has rejected your offer. Try increasing your bid.');
    }
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.club.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = filterPosition === 'All' || player.position === filterPosition;

    // Don't show players already in user's squad
    const notInSquad = !(managerProfile.squad || []).some(p => p.id === player.id);

    return matchesSearch && matchesPosition && notInSquad;
  });

  const positions = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Transfer Market</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transfer Market</Text>
        <Text style={styles.budget}>Budget: {formatCurrency(managerProfile?.budget || 0)}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search players or clubs..."
            placeholderTextColor="#888"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {positions.map(pos => (
            <TouchableOpacity
              key={pos}
              style={[styles.filterChip, filterPosition === pos && styles.filterChipActive]}
              onPress={() => setFilterPosition(pos)}
            >
              <Text style={[styles.filterText, filterPosition === pos && styles.filterTextActive]}>{pos}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.playersList}>
          {filteredPlayers.map(player => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerDetails}>{player.age} • {player.position} • {player.nationality}</Text>
                <Text style={styles.playerClub}>{player.club} ({player.league})</Text>
                <Text style={styles.playerRating}>Overall: {player.overall}</Text>
              </View>
              <View style={styles.playerActions}>
                <Text style={styles.playerPrice}>{formatCurrency(player.price)}</Text>
                <TouchableOpacity
                  style={styles.offerButton}
                  onPress={() => handleMakeOffer(player)}
                >
                  <Text style={styles.offerButtonText}>Make Offer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {selectedPlayer && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Make Offer for {selectedPlayer.name}</Text>
            <Text style={styles.modalSubtitle}>Asking Price: {formatCurrency(selectedPlayer.price)}</Text>

            <View style={styles.offerInputContainer}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.offerInput}
                placeholder="Amount in millions"
                placeholderTextColor="#888"
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="numeric"
              />
              <Text style={styles.millionText}>M</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedPlayer(null);
                  setOfferAmount('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitOffer}
              >
                <Text style={styles.submitButtonText}>Submit Offer</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: 20,
    zIndex: 100,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  budget: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  searchSection: {
    padding: 15,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: '#1a1f3a',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  filterRow: {
    paddingHorizontal: 15,
    marginBottom: 10,
    maxHeight: 50,
  },
  filterChip: {
    backgroundColor: '#1a1f3a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  filterChipActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderColor: '#667eea',
  },
  filterText: {
    color: '#888',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  playersList: {
    padding: 15,
    paddingTop: 5,
  },
  playerCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  playerDetails: {
    fontSize: 14,
    color: '#888',
    marginBottom: 3,
  },
  playerClub: {
    fontSize: 13,
    color: '#667eea',
    marginBottom: 3,
  },
  playerRating: {
    fontSize: 14,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  playerActions: {
    alignItems: 'flex-end',
  },
  playerPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5576c',
    marginBottom: 10,
  },
  offerButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  offerButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  offerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  dollarSign: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  offerInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    padding: 5,
  },
  millionText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 5,
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
  submitButton: {
    flex: 1,
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
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

export default TransferMarket;
