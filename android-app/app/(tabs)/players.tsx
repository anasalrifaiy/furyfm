import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTeamPlayers, useSellPlayer } from '@/lib/api';
import { useMyTeam } from '@/lib/api';
import { DollarSign, Star, Calendar, Flag, Trash2 } from 'lucide-react-native';

export default function SquadScreen() {
  const { data: team, isLoading: teamLoading } = useMyTeam();
  const { data: players = [], isLoading: playersLoading } = useTeamPlayers(team?.id ?? '');
  const sellPlayer = useSellPlayer();

  const handleSellPlayer = async (player: any) => {
    try {
      Alert.alert(
        'Sell Player',
        `Are you sure you want to sell ${player.name} for ${((player.value * 0.8) / 1000000).toFixed(1)}M?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sell',
            style: 'destructive',
            onPress: async () => {
              const amount = await sellPlayer.mutateAsync(player.id);
              Alert.alert(
                'Player Sold',
                `${player.name} has been sold for ${(amount / 1000000).toFixed(1)}M`
              );
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sell player');
    }
  };

  if (teamLoading || playersLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const getPositionColor = (position: string | null) => {
    if (!position) return '#808080';
    if (position === 'GK') return '#FFD700';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return '#4169E1';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return '#32CD32';
    if (['ST', 'CF', 'LW', 'RW'].includes(position)) return '#FF4444';
    return '#808080';
  };

  const getPositionDisplay = (position: string | null) => {
    if (!position) return 'No Position';
    return position;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Squad Overview</Text>
        <Text style={styles.subtitle}>
          {players.length} Players • Average Rating: {
            players.length > 0
              ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
              : 0
          }
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Star size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{team?.rating || 0}</Text>
          <Text style={styles.statLabel}>Team Rating</Text>
        </View>
        <View style={styles.statBox}>
          <DollarSign size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>${((team?.budget || 0) / 1000000).toFixed(1)}M</Text>
          <Text style={styles.statLabel}>Budget</Text>
        </View>
      </View>

      <View style={styles.playersContainer}>
        {players.map((player) => (
          <View key={player.id} style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <View style={[styles.positionBadge, { backgroundColor: getPositionColor(player.position) }]}>
                <Text style={styles.positionText}>{getPositionDisplay(player.position)}</Text>
              </View>
              <Text style={styles.rating}>{player.rating}</Text>
            </View>
            
            <Text style={styles.playerName}>{player.name}</Text>
            
            <View style={styles.playerStats}>
              <View style={styles.statItem}>
                <Calendar size={16} color="#666" />
                <Text style={styles.statText}>{player.age} yrs</Text>
              </View>
              <View style={styles.statItem}>
                <Flag size={16} color="#666" />
                <Text style={styles.statText}>{player.nationality}</Text>
              </View>
              <View style={styles.statItem}>
                <DollarSign size={16} color="#666" />
                <Text style={styles.statText}>${(player.value / 1000000).toFixed(1)}M</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.sellButton}
              onPress={() => handleSellPlayer(player)}
            >
              <Trash2 size={16} color="#fff" />
              <Text style={styles.sellButtonText}>
                Sell for ${((player.value * 0.8) / 1000000).toFixed(1)}M
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {players.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No players in squad</Text>
            <Text style={styles.emptyStateSubtext}>Visit the Transfer Market to buy players</Text>
          </View>
        )}
      </View>
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
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    marginTop: 15,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
  },
  statNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginTop: 5,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 5,
  },
  playersContainer: {
    padding: 15,
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  positionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  positionText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  rating: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#4CAF50',
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 10,
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 5,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  sellButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  sellButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});