import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Search, Filter, Import as SortAsc, Dessert as SortDesc } from 'lucide-react-native';
import { useMyTeam, useHandleTransfer } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const POSITIONS = ['All', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'];

const getPositionColor = (position: string) => {
  if (position === 'GK') return '#FFD700';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return '#4169E1';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return '#32CD32';
  if (['ST', 'CF', 'LW', 'RW'].includes(position)) return '#FF4444';
  return '#808080';
};

export default function TransferScreen() {
  const { data: team, isLoading: teamLoading } = useMyTeam();
  const handleTransferMutation = useHandleTransfer();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('All');
  const [sortBy, setSortBy] = useState<'rating' | 'value' | 'age'>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('available_players')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      if (selectedPosition !== 'All') {
        query = query.eq('position', selectedPosition);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [searchQuery, selectedPosition, sortBy, sortOrder]);

  const toggleSort = (field: 'rating' | 'value' | 'age') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleTransfer = async (player: any) => {
    if (!team) return;
    
    try {
      setLoading(true);
      
      await handleTransferMutation.mutateAsync({
        playerId: player.id,
        toTeamId: team.id,
        amount: player.value
      });

      // Refresh the players list
      fetchPlayers();

      Alert.alert(
        'Transfer Complete',
        `${player.name} has joined your team!`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert(
        'Transfer Failed',
        error.message || 'Failed to complete transfer',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (teamLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transfer Market</Text>
        <Text style={styles.budget}>Budget: ${((team?.budget || 0) / 1000000).toFixed(1)}M</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        {POSITIONS.map((position) => (
          <TouchableOpacity
            key={position}
            style={[
              styles.filterChip,
              selectedPosition === position && styles.filterChipSelected
            ]}
            onPress={() => setSelectedPosition(position)}
          >
            <Text style={[
              styles.filterChipText,
              selectedPosition === position && styles.filterChipTextSelected
            ]}>
              {position}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sortContainer}>
        <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('rating')}>
          <Text style={styles.sortButtonText}>Rating</Text>
          {sortBy === 'rating' && (
            sortOrder === 'desc' ? <SortDesc size={16} color="#666" /> : <SortAsc size={16} color="#666" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('value')}>
          <Text style={styles.sortButtonText}>Value</Text>
          {sortBy === 'value' && (
            sortOrder === 'desc' ? <SortDesc size={16} color="#666" /> : <SortAsc size={16} color="#666" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortButton} onPress={() => toggleSort('age')}>
          <Text style={styles.sortButtonText}>Age</Text>
          {sortBy === 'age' && (
            sortOrder === 'desc' ? <SortDesc size={16} color="#666" /> : <SortAsc size={16} color="#666" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Players ({players.length})</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : players.length > 0 ? (
          players.map((player: any) => (
            <TouchableOpacity key={player.id} style={styles.playerCard}>
              <View style={[styles.positionCircle, { backgroundColor: getPositionColor(player.position) }]}>
                <Text style={styles.positionText}>{player.position}</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerStats}>
                  Age: {player.age} • Rating: {player.rating}
                </Text>
                <Text style={styles.playerClub}>Nationality: {player.nationality}</Text>
              </View>
              <View style={styles.price}>
                <Text style={styles.priceText}>${(player.value / 1000000).toFixed(1)}M</Text>
                <TouchableOpacity 
                  style={[
                    styles.bidButton,
                    (team?.budget || 0) < player.value && styles.bidButtonDisabled
                  ]}
                  disabled={(team?.budget || 0) < player.value || loading}
                  onPress={() => handleTransfer(player)}
                >
                  <Text style={styles.bidButtonText}>
                    {loading ? 'Processing...' : (team?.budget || 0) < player.value ? 'Too Expensive' : 'Buy Player'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noResults}>No players found</Text>
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
    backgroundColor: '#f5f5f5',
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
    color: '#000',
  },
  budget: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 5,
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  filterChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  filterChipSelected: {
    backgroundColor: '#4CAF50',
  },
  filterChipText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  sortButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
    marginRight: 5,
  },
  section: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 15,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  positionCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  positionText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  playerStats: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 2,
  },
  playerClub: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 2,
    fontSize: 12,
  },
  price: {
    alignItems: 'center',
  },
  priceText: {
    fontFamily: 'Inter_700Bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  bidButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  bidButtonDisabled: {
    backgroundColor: '#999',
  },
  bidButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  loader: {
    marginTop: 20,
  },
  noResults: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 20,
  },
});