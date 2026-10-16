import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator, Modal, Alert, ScrollView } from 'react-native';
import { Play, Users, Search, X } from 'lucide-react-native';
import { useMyTeam, useFriendRequests, useTeamPlayers } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import MatchRoom from '@/components/MatchRoom';
import MatchGame from '@/components/MatchGame';

const AI_POSITIONS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'];

// Opponent squad for practice matches, rated close to the player's team
const buildComputerSquad = (rating: number) =>
  AI_POSITIONS.map((position, i) => ({
    name: `CPU ${i + 1}`,
    position,
    overall: Math.max(45, Math.min(95, Math.round(rating + (((i * 7) % 9) - 4)))),
  }));

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  sender?: {
    id: string;
    name: string;
    rating: number;
    profile_picture_url?: string;
  };
  receiver?: {
    id: string;
    name: string;
    rating: number;
    profile_picture_url?: string;
  };
}

export default function MatchScreen() {
  const [isSimulating, setIsSimulating] = useState(false);
  const { data: myTeam, isLoading: teamLoading } = useMyTeam();
  const { data: friendRequests = [] } = useFriendRequests();
  const { data: teamPlayers = [] } = useTeamPlayers(myTeam?.id);
  const [practiceActive, setPracticeActive] = useState(false);
  const [showMatchRoom, setShowMatchRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);

  // Check for active match room
  useEffect(() => {
    if (!myTeam?.id) return;

    const checkActiveRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('match_rooms')
          .select('id, host_team_id')
          .or(`host_team_id.eq.${myTeam.id},guest_team_id.eq.${myTeam.id}`)
          .in('status', ['pending', 'ready', 'in_progress'])
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setActiveRoom(data.id);
          setIsHost(data.host_team_id === myTeam.id);
          setShowMatchRoom(true);
        }
      } catch (error) {
        console.error('Error checking active room:', error);
      }
    };

    checkActiveRoom();

    // Set up real-time subscription for match room changes
    const subscription = supabase
      .channel('match_room_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_rooms',
          filter: `host_team_id=eq.${myTeam.id},guest_team_id=eq.${myTeam.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setShowMatchRoom(false);
            setActiveRoom(null);
          } else {
            checkActiveRoom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [myTeam?.id]);

  const createMatchRoom = async (guestTeamId?: string) => {
    try {
      setIsSimulating(true);
      
      const { data, error } = await supabase.rpc('create_match_room', {
        p_guest_team_id: guestTeamId
      });

      if (error) throw error;

      setActiveRoom(data);
      setIsHost(true);
      setShowMatchRoom(true);
      setShowFriendsList(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create match room');
      console.error('Create match room error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const friends = friendRequests.filter((r: FriendRequest) => r.status === 'accepted');

  // Starting XI: players placed in the lineup, topped up with the best remaining players
  const homeSquad = (() => {
    const mapPlayer = (p: any) => ({
      name: p.name,
      position: p.original_position || p.position,
      overall: p.rating,
    });
    const starters = teamPlayers.filter((p: any) => p.position_id);
    const rest = teamPlayers.filter((p: any) => !p.position_id);
    return [...starters, ...rest].slice(0, 11).map(mapPlayer);
  })();

  if (teamLoading || !myTeam) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const getFriendDetails = (friend: FriendRequest) => {
    const isReceiver = friend.receiver?.id === myTeam.id;
    return {
      id: isReceiver ? friend.sender?.id : friend.receiver?.id,
      name: isReceiver ? friend.sender?.name : friend.receiver?.name,
      rating: isReceiver ? friend.sender?.rating : friend.receiver?.rating,
      profile_picture_url: isReceiver 
        ? friend.sender?.profile_picture_url 
        : friend.receiver?.profile_picture_url
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.matchCard}>
        <Text style={styles.matchTitle}>Play a Match</Text>
        <View style={styles.teams}>
          <View style={styles.team}>
            <Image
              source={{ uri: myTeam.logo_url || 'https://via.placeholder.com/80' }}
              style={styles.teamLogo}
            />
            <Text style={styles.teamName}>{myTeam.name}</Text>
          </View>
          <View style={styles.versus}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.team}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' }}
              style={styles.teamLogo}
            />
            <Text style={styles.teamName}>Computer</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.playButton, isSimulating && styles.playButtonDisabled]}
            onPress={() => setPracticeActive(true)}
            disabled={isSimulating || homeSquad.length < 11}>
            <Play size={24} color="#fff" />
            <Text style={styles.playButtonText}>
              {homeSquad.length < 11 ? 'Need 11 players' : 'Play vs Computer'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.playButton, styles.friendButton]}
            onPress={() => setShowFriendsList(true)}
            disabled={isSimulating || friends.length === 0}>
            <Users size={24} color="#fff" />
            <Text style={styles.playButtonText}>Play vs Friend</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Match Statistics</Text>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Team Rating</Text>
          <View style={styles.statBar}>
            <View style={[styles.statFill, { width: `${Math.min(myTeam.rating, 100)}%` }]} />
          </View>
          <Text style={styles.statValue}>{myTeam.rating}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Budget Available</Text>
          <Text style={styles.statValue}>${(myTeam.budget / 1000000).toFixed(1)}M</Text>
        </View>
      </View>

      {/* Friends List Modal */}
      <Modal
        visible={showFriendsList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendsList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Opponent</Text>
              <TouchableOpacity 
                onPress={() => setShowFriendsList(false)}
                style={styles.closeIcon}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.friendsList}>
              {friends.map((friend: FriendRequest) => {
                const friendDetails = getFriendDetails(friend);
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendItem}
                    onPress={() => createMatchRoom(friendDetails.id)}
                  >
                    <Image
                      source={{ uri: friendDetails.profile_picture_url || 'https://via.placeholder.com/50' }}
                      style={styles.friendImage}
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friendDetails.name}</Text>
                      <Text style={styles.friendRating}>
                        Rating: {friendDetails.rating}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {friends.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No friends yet. Add friends to play against them!
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFriendsList(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Playable match vs the computer */}
      <Modal visible={practiceActive} animationType="slide" onRequestClose={() => setPracticeActive(false)}>
        {practiceActive && (
          <MatchGame
            homeSquad={homeSquad}
            awaySquad={buildComputerSquad(myTeam.rating || 70)}
            homeFormation={myTeam.formation || '4-3-3'}
            awayFormation="4-4-2"
            homeName={myTeam.name}
            awayName="Computer"
            onExit={() => setPracticeActive(false)}
          />
        )}
      </Modal>

      {/* Match Room Modal */}
      <Modal
        visible={showMatchRoom}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMatchRoom(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {activeRoom && (
              <MatchRoom
                roomId={activeRoom}
                onClose={() => setShowMatchRoom(false)}
                isHost={isHost}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  team: {
    alignItems: 'center',
    flex: 1,
  },
  teamLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#eee',
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  versus: {
    paddingHorizontal: 10,
  },
  vsText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#666',
  },
  buttonRow: {
    gap: 10,
    marginTop: 10,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 8,
  },
  friendButton: {
    backgroundColor: '#2196F3',
  },
  playButtonDisabled: {
    opacity: 0.7,
  },
  playButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginBottom: 15,
    color: '#333',
  },
  stat: {
    marginBottom: 15,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    marginBottom: 5,
    color: '#666',
  },
  statBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginTop: 5,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#333',
  },
  closeIcon: {
    padding: 5,
  },
  friendsList: {
    maxHeight: 400,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  friendInfo: {
    marginLeft: 15,
    flex: 1,
  },
  friendName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#333',
  },
  friendRating: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: '#666',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    alignItems: 'center',
    margin: 20,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});