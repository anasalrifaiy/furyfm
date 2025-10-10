import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, push, update } from 'firebase/database';
import { showAlert } from '../utils/alert';
import Portal from '../components/Portal';
import { countries, getCountryFlag } from '../data/countries';

const ManagerProfile = ({ managerId, onBack }) => {
  const { currentUser, managerProfile: currentManagerProfile, updateManagerProfile, loading } = useAuth();
  const [manager, setManager] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [activeTab, setActiveTab] = useState('squad'); // 'squad' or 'stats'
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClub, setEditClub] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  useEffect(() => {
    if (currentManagerProfile) {
      loadManager();
    }
  }, [managerId, currentManagerProfile]);

  const loadManager = async () => {
    const managerRef = ref(database, `managers/${managerId}`);
    const snapshot = await get(managerRef);

    if (snapshot.exists()) {
      const data = { uid: managerId, ...snapshot.val() };
      setManager(data);
      setEditName(data.managerName || '');
      setEditClub(data.clubName || '');
      setEditCountry(data.country || '');
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      showAlert('Error', 'Manager name cannot be empty');
      return;
    }

    await updateManagerProfile({
      managerName: editName.trim(),
      clubName: editClub.trim() || 'No Club',
      country: editCountry.trim() || 'Unknown'
    });

    setIsEditing(false);
    loadManager();
    showAlert('Success', 'Profile updated successfully!');
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

    if (offerValue > currentManagerProfile.budget) {
      showAlert('Insufficient Funds', 'You don\'t have enough budget for this offer.');
      return;
    }

    // Create trade offer in database
    const offersRef = ref(database, `tradeOffers`);
    const newOffer = {
      from: currentUser.uid,
      fromName: currentManagerProfile.managerName,
      to: managerId,
      toName: manager.managerName,
      player: selectedPlayer,
      offerAmount: offerValue,
      status: 'pending',
      timestamp: Date.now()
    };

    const offerRef = await push(offersRef, newOffer);

    // Send notification to the manager
    const notificationsRef = ref(database, `managers/${managerId}/notifications`);
    await push(notificationsRef, {
      type: 'trade_offer',
      from: currentUser.uid,
      fromName: currentManagerProfile.managerName,
      offerId: offerRef.key,
      message: `${currentManagerProfile.managerName} offered ${formatCurrency(offerValue)} for ${selectedPlayer.name}`,
      timestamp: Date.now(),
      read: false
    });

    showAlert('Offer Sent!', `Your offer of ${formatCurrency(offerValue)} for ${selectedPlayer.name} has been sent to ${manager.managerName}.`);
    setSelectedPlayer(null);
    setOfferAmount('');
  };

  if (!manager || !currentManagerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Manager Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const squadValue = (manager.squad || []).reduce((sum, player) => sum + player.price, 0);
  const isOwnProfile = managerId === currentUser?.uid;

  return (
    <>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{manager.managerName.charAt(0)}</Text>
        </View>
        <Text style={styles.managerName}>{manager.managerName}</Text>
        {manager.clubName && <Text style={styles.clubName}>{manager.clubName}</Text>}
        {manager.country && (
          <View style={styles.countryContainer}>
            <Text style={styles.countryFlag}>{getCountryFlag(manager.country)}</Text>
            <Text style={styles.countryText}>{manager.country}</Text>
          </View>
        )}
        {isOwnProfile && (
          <>
            <Text style={styles.youBadge}>(Your Profile)</Text>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{manager.points || 0}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{manager.wins || 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{manager.squad?.length || 0}</Text>
            <Text style={styles.statLabel}>Squad</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatCurrency(squadValue)}</Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'squad' && styles.tabActive]}
          onPress={() => setActiveTab('squad')}
        >
          <Text style={[styles.tabText, activeTab === 'squad' && styles.tabTextActive]}>
            Squad ({manager.squad?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Statistics
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'squad' ? (
          (manager.squad || []).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Players</Text>
              <Text style={styles.emptyDesc}>This manager hasn't signed any players yet.</Text>
            </View>
          ) : (
            (manager.squad || []).map(player => (
              <View key={player.id} style={styles.playerCard}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerDetails}>
                    {player.age} • {player.position} • {player.nationality}
                  </Text>
                  <Text style={styles.playerClub}>{player.club}</Text>
                  <Text style={styles.playerRating}>OVR: {player.overall}</Text>
                </View>
                <View style={styles.playerActions}>
                  <Text style={styles.playerPrice}>{formatCurrency(player.price)}</Text>
                  {!isOwnProfile && (
                    <TouchableOpacity
                      style={styles.offerButton}
                      onPress={() => handleMakeOffer(player)}
                    >
                      <Text style={styles.offerButtonText}>Make Offer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )
        ) : (
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>Match Record</Text>
              <View style={styles.recordRow}>
                <View style={styles.recordItem}>
                  <Text style={styles.recordValue}>{manager.wins || 0}</Text>
                  <Text style={styles.recordLabel}>Wins</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={styles.recordValue}>{manager.draws || 0}</Text>
                  <Text style={styles.recordLabel}>Draws</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={styles.recordValue}>{manager.losses || 0}</Text>
                  <Text style={styles.recordLabel}>Losses</Text>
                </View>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>Financial Info</Text>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Current Budget:</Text>
                <Text style={styles.financeValue}>{formatCurrency(manager.budget || 0)}</Text>
              </View>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Squad Value:</Text>
                <Text style={styles.financeValue}>{formatCurrency(squadValue)}</Text>
              </View>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Total Worth:</Text>
                <Text style={styles.financeValue}>
                  {formatCurrency((manager.budget || 0) + squadValue)}
                </Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>Manager Info</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since:</Text>
                <Text style={styles.infoValue}>
                  {new Date(manager.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Friends:</Text>
                <Text style={styles.infoValue}>{manager.friends?.length || 0}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>

    {isEditing && (
      <Portal>
        <View style={styles.modalOverlay} pointerEvents="auto">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsEditing(false)}
          />
          <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Profile</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Manager Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter manager name"
              placeholderTextColor="#888"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Club Name</Text>
            <TextInput
              style={styles.textInput}
              value={editClub}
              onChangeText={setEditClub}
              placeholder="Enter club name"
              placeholderTextColor="#888"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country</Text>
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(true)}
            >
              {editCountry ? (
                <View style={styles.selectedCountry}>
                  <Text style={styles.selectedCountryFlag}>{getCountryFlag(editCountry)}</Text>
                  <Text style={styles.selectedCountryText}>{editCountry}</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Select country</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={saveProfile}
            >
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </Portal>
    )}

    {showCountryPicker && (
      <Portal>
        <View style={styles.modalOverlay} pointerEvents="auto">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowCountryPicker(false);
              setCountrySearch('');
            }}
          />
          <View style={styles.countryPickerModal}>
            <Text style={styles.modalTitle}>Select Country</Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              placeholderTextColor="#888"
              value={countrySearch}
              onChangeText={setCountrySearch}
            />

            <ScrollView style={styles.countryList}>
              {countries
                .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                .map(country => (
                  <TouchableOpacity
                    key={country.name}
                    style={styles.countryOption}
                    onPress={() => {
                      setEditCountry(country.name);
                      setShowCountryPicker(false);
                      setCountrySearch('');
                    }}
                  >
                    <Text style={styles.countryOptionFlag}>{country.flag}</Text>
                    <Text style={styles.countryOptionName}>{country.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowCountryPicker(false);
                setCountrySearch('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Portal>
    )}

    {selectedPlayer && (
      <Portal>
        <View style={styles.modalOverlay} pointerEvents="auto">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setSelectedPlayer(null);
              setOfferAmount('');
            }}
          />
          <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Make Offer for {selectedPlayer.name}</Text>
          <Text style={styles.modalSubtitle}>Market Value: {formatCurrency(selectedPlayer.price)}</Text>

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

          <Text style={styles.modalNote}>
            Your offer will be sent to {manager.managerName}. They can accept, reject, or counter your offer.
          </Text>

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
              <Text style={styles.submitButtonText}>Send Offer</Text>
            </TouchableOpacity>
          </View>
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
    zIndex: 100,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1a1f3a',
    marginHorizontal: 15,
    marginTop: -30,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 4,
    borderColor: '#0a0e27',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  managerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  youBadge: {
    color: '#43e97b',
    fontSize: 14,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    padding: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 15,
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
  playerActions: {
    alignItems: 'flex-end',
  },
  playerPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f5576c',
    marginBottom: 8,
  },
  offerButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  offerButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  statsSection: {
    padding: 5,
  },
  statCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  statCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recordItem: {
    alignItems: 'center',
  },
  recordValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  recordLabel: {
    fontSize: 14,
    color: '#888',
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  financeLabel: {
    fontSize: 16,
    color: '#888',
  },
  financeValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  infoLabel: {
    fontSize: 16,
    color: '#888',
  },
  infoValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
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
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  dollarSign: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 8,
  },
  offerInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    padding: 0,
    minWidth: 0,
  },
  millionText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 8,
    flexShrink: 0,
  },
  modalNote: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
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
  clubName: {
    fontSize: 16,
    color: '#667eea',
    marginTop: 5,
  },
  countryText: {
    fontSize: 14,
    color: '#888',
    marginTop: 3,
  },
  editButton: {
    marginTop: 15,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 8,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  },
  countrySelector: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d3561',
    minHeight: 48,
    justifyContent: 'center',
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedCountryFlag: {
    fontSize: 20,
    marginRight: 10,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  },
  selectedCountryText: {
    color: '#ffffff',
    fontSize: 16,
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
  },
  countryPickerModal: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
  },
  searchInput: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d3561',
    marginBottom: 15,
  },
  countryList: {
    maxHeight: 400,
    marginBottom: 15,
    overflow: 'auto',
    flex: 1,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#252b54',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d3561',
    cursor: 'pointer',
  },
  countryOptionFlag: {
    fontSize: 24,
    marginRight: 12,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
  },
  countryOptionName: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default ManagerProfile;
