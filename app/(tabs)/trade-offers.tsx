import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { DollarSign, Check, X, ArrowRight, RefreshCw } from 'lucide-react-native';
import { useTradeOffers, useHandleTradeOffer, useMyTeam } from '@/lib/api';

export default function TradeOffersScreen() {
  const { data: tradeOffers = [], isLoading, refetch, isRefetching } = useTradeOffers();
  const { data: myTeam } = useMyTeam();
  const handleTradeOffer = useHandleTradeOffer();
  const [counterAmount, setCounterAmount] = useState<string>('');
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);

  const incomingOffers = tradeOffers.filter(offer => 
    offer.to_team_id === myTeam?.id && offer.status === 'pending'
  );

  const outgoingOffers = tradeOffers.filter(offer => 
    offer.from_team_id === myTeam?.id && offer.status === 'pending'
  );

  const completedOffers = tradeOffers.filter(offer => 
    (offer.to_team_id === myTeam?.id || offer.from_team_id === myTeam?.id) && 
    offer.status !== 'pending'
  );

  const handleAccept = async (offerId: string) => {
    try {
      await handleTradeOffer.mutateAsync({
        offerId,
        accept: true
      });
      Alert.alert('Success', 'Trade offer accepted successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept trade offer');
    }
  };

  const handleReject = async (offerId: string) => {
    try {
      await handleTradeOffer.mutateAsync({
        offerId,
        accept: false
      });
      Alert.alert('Success', 'Trade offer rejected');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject trade offer');
    }
  };

  const handleCounter = async (offerId: string) => {
    if (!counterAmount || isNaN(parseInt(counterAmount))) {
      Alert.alert('Error', 'Please enter a valid counter amount');
      return;
    }

    try {
      await handleTradeOffer.mutateAsync({
        offerId,
        accept: false,
        counterAmount: parseInt(counterAmount) * 1000000 // Convert M to actual value
      });
      setCounterOfferId(null);
      setCounterAmount('');
      Alert.alert('Success', 'Counter offer sent successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send counter offer');
    }
  };

  const getPositionColor = (position: string | null) => {
    if (!position) return '#808080';
    if (position === 'GK') return '#FFD700';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return '#4169E1';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return '#32CD32';
    if (['ST', 'CF', 'LW', 'RW'].includes(position)) return '#FF4444';
    return '#808080';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Trade Offers</Text>
          <Text style={styles.subtitle}>
            {incomingOffers.length} Incoming • {outgoingOffers.length} Outgoing
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()}>
          <RefreshCw size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <View style={styles.budgetContainer}>
        <Text style={styles.budgetLabel}>Your Budget:</Text>
        <Text style={styles.budgetValue}>${(myTeam?.budget || 0) / 1000000}M</Text>
      </View>

      {incomingOffers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming Offers</Text>
          {incomingOffers.map((offer) => (
            <View key={offer.id} style={styles.offerCard}>
              <View style={styles.offerHeader}>
                <View style={styles.teamInfoContainer}>
                  <Image 
                    source={{ uri: offer.from_team?.logo_url || 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' }} 
                    style={styles.teamLogo} 
                  />
                  <Text style={styles.offerTitle}>
                    Offer from {offer.from_team?.name}
                  </Text>
                </View>
                <Text style={styles.offerAmount}>${(offer.amount / 1000000).toFixed(1)}M</Text>
              </View>

              <View style={styles.playerInfo}>
                <View style={[styles.positionBadge, { backgroundColor: getPositionColor(offer.player?.position) }]}>
                  <Text style={styles.positionText}>{offer.player?.position || 'N/A'}</Text>
                </View>
                <View style={styles.playerDetails}>
                  <Text style={styles.playerName}>{offer.player?.name}</Text>
                  <Text style={styles.playerStats}>
                    Rating: {offer.player?.rating} • Age: {offer.player?.age} • Value: ${(offer.player?.value / 1000000).toFixed(1)}M
                  </Text>
                </View>
              </View>

              {counterOfferId === offer.id ? (
                <View style={styles.counterContainer}>
                  <TextInput
                    style={styles.counterInput}
                    value={counterAmount}
                    onChangeText={setCounterAmount}
                    placeholder="Counter amount (M)"
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                  <View style={styles.counterButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.counterButton]}
                      onPress={() => handleCounter(offer.id)}
                      disabled={handleTradeOffer.isPending}
                    >
                      {handleTradeOffer.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.actionButtonText}>Send Counter</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => {
                        setCounterOfferId(null);
                        setCounterAmount('');
                      }}
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(offer.id)}
                    disabled={handleTradeOffer.isPending}
                  >
                    {handleTradeOffer.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" />
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.counterButton]}
                    onPress={() => setCounterOfferId(offer.id)}
                    disabled={handleTradeOffer.isPending}
                  >
                    <DollarSign size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Counter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(offer.id)}
                    disabled={handleTradeOffer.isPending}
                  >
                    <X size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {outgoingOffers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outgoing Offers</Text>
          {outgoingOffers.map((offer) => (
            <View key={offer.id} style={[styles.offerCard, styles.outgoingOfferCard]}>
              <View style={styles.offerHeader}>
                <View style={styles.teamInfoContainer}>
                  <Image 
                    source={{ uri: offer.to_team?.logo_url || 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' }} 
                    style={styles.teamLogo} 
                  />
                  <Text style={styles.offerTitle}>
                    Offer to {offer.to_team?.name}
                  </Text>
                </View>
                <Text style={styles.offerAmount}>${(offer.amount / 1000000).toFixed(1)}M</Text>
              </View>

              <View style={styles.playerInfo}>
                <View style={[styles.positionBadge, { backgroundColor: getPositionColor(offer.player?.position) }]}>
                  <Text style={styles.positionText}>{offer.player?.position || 'N/A'}</Text>
                </View>
                <View style={styles.playerDetails}>
                  <Text style={styles.playerName}>{offer.player?.name}</Text>
                  <Text style={styles.playerStats}>
                    Rating: {offer.player?.rating} • Age: {offer.player?.age} • Value: ${(offer.player?.value / 1000000).toFixed(1)}M
                  </Text>
                </View>
              </View>

              <View style={styles.pendingStatus}>
                <Text style={styles.pendingText}>Waiting for response...</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {completedOffers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Offers</Text>
          {completedOffers.map((offer) => (
            <View key={offer.id} style={[styles.offerCard, styles.completedOfferCard]}>
              <View style={styles.offerHeader}>
                <View style={styles.teamInfoContainer}>
                  <Image 
                    source={{ uri: offer.from_team_id === myTeam?.id 
                      ? offer.to_team?.logo_url 
                      : offer.from_team?.logo_url || 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' 
                    }} 
                    style={styles.teamLogo} 
                  />
                  <Text style={styles.offerTitle}>
                    {offer.from_team_id === myTeam?.id ? 'To' : 'From'} {offer.from_team_id === myTeam?.id ? offer.to_team?.name : offer.from_team?.name}
                  </Text>
                </View>
                <Text style={styles.offerAmount}>${(offer.amount / 1000000).toFixed(1)}M</Text>
              </View>

              <View style={styles.playerInfo}>
                <View style={[styles.positionBadge, { backgroundColor: getPositionColor(offer.player?.position) }]}>
                  <Text style={styles.positionText}>{offer.player?.position || 'N/A'}</Text>
                </View>
                <View style={styles.playerDetails}>
                  <Text style={styles.playerName}>{offer.player?.name}</Text>
                  <Text style={styles.playerStats}>
                    Rating: {offer.player?.rating} • Age: {offer.player?.age}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.statusContainer,
                offer.status === 'accepted' ? styles.acceptedStatusContainer :
                offer.status === 'rejected' ? styles.rejectedStatusContainer :
                styles.counteredStatusContainer
              ]}>
                <Text style={[
                  styles.statusText,
                  offer.status === 'accepted' ? styles.acceptedText : 
                  offer.status === 'rejected' ? styles.rejectedText : 
                  styles.counteredText
                ]}>
                  {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                </Text>
                {offer.status === 'countered' && offer.counter_amount && (
                  <Text style={styles.counterAmountText}>
                    Counter: ${(offer.counter_amount / 1000000).toFixed(1)}M
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {incomingOffers.length === 0 && outgoingOffers.length === 0 && completedOffers.length === 0 && (
        <View style={styles.emptyState}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1434648957308-5e6a859697e8?w=300' }}
            style={styles.emptyStateImage}
          />
          <Text style={styles.emptyStateText}>No trade offers yet</Text>
          <Text style={styles.emptyStateSubtext}>Visit other teams' squads to make offers for their players</Text>
        </View>
      )}
    </ScrollView>
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
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#666',
  },
  budgetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  budgetLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#333',
  },
  budgetValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#4CAF50',
  },
  section: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  offerCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  outgoingOfferCard: {
    borderLeftColor: '#2196F3',
  },
  completedOfferCard: {
    borderLeftColor: '#9e9e9e',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  offerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  offerAmount: {
    fontFamily: 'Inter_700Bold',
    color: '#4CAF50',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  positionText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  playerStats: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  counterButton: {
    backgroundColor: '#2196F3',
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
  },
  actionButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginLeft: 5,
  },
  pendingStatus: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF9C4',
    borderRadius: 8,
  },
  pendingText: {
    fontFamily: 'Inter_400Regular',
    color: '#FFA000',
  },
  statusContainer: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  acceptedStatusContainer: {
    backgroundColor: '#E8F5E9',
  },
  rejectedStatusContainer: {
    backgroundColor: '#FFEBEE',
  },
  counteredStatusContainer: {
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  acceptedText: {
    color: '#4CAF50',
  },
  rejectedText: {
    color: '#f44336',
  },
  counteredText: {
    color: '#2196F3',
  },
  counterAmountText: {
    fontFamily: 'Inter_400Regular',
    color: '#2196F3',
    marginTop: 5,
  },
  counterContainer: {
    marginTop: 10,
  },
  counterInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  counterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyState: {
    margin: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    opacity: 0.8,
  },
  emptyStateText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 10,
    color: '#666',
  },
  emptyStateSubtext: {
    fontFamily: 'Inter_400Regular',
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});