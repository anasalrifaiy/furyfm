import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Search, UserPlus, Check, X, Clock } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSearchTeams,
  useFriendRequests,
  useSendFriendRequest,
  useHandleFriendRequest,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useMyTeam } from '@/lib/api';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
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

export default function FriendsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { data: myTeam } = useMyTeam();
  const queryClient = useQueryClient();
  const {
    data: friendRequests = [] as FriendRequest[],
    isLoading: friendsLoading,
    refetch,
    isRefetching,
  } = useFriendRequests();
  const sendFriendRequest = useSendFriendRequest();
  const handleFriendRequest = useHandleFriendRequest();
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );

  // Filter incoming pending requests (where the user is the receiver)
  const incomingRequests = friendRequests.filter(
    (r) => r.status === 'pending' && r.receiver_id === myTeam?.id
  );

  // Filter outgoing pending requests (where the user is the sender)
  const outgoingRequests = friendRequests.filter(
    (r) => r.status === 'pending' && r.sender_id === myTeam?.id
  );

  // Filter accepted friend requests
  const friends = friendRequests.filter((r) => r.status === 'accepted');

  // Set up automatic refetching
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Add real-time subscription here
  useEffect(() => {
    if (!myTeam?.id) return;

    const channel = supabase
      .channel('friend_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${myTeam.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${myTeam.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myTeam?.id, queryClient]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .neq('user_id', user.id)
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Error', 'Failed to search for teams');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (teamId: string) => {
    try {
      // Check for existing requests or friendships
      const existingRequest = friendRequests.find(request => 
        (request.receiver_id === teamId && request.sender_id === myTeam?.id) || 
        (request.sender_id === teamId && request.receiver_id === myTeam?.id)
      );
  
      if (existingRequest) {
        if (existingRequest.status === 'accepted') {
          Alert.alert('Error', 'You are already friends with this team');
        } else {
          Alert.alert('Error', 'A friend request is already pending');
        }
        return;
      }
  
      setSendingRequestTo(teamId);
      await sendFriendRequest.mutateAsync(teamId);
      
      // Immediately trigger a refetch instead of manual update
      await refetch();
      
      Alert.alert('Success', 'Friend request sent successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
      console.error('Failed to send friend request:', error);
    } finally {
      setSendingRequestTo(null);
    }
  };

  const handleRequestResponse = async (requestId: string, accept: boolean) => {
    try {
      setProcessingRequestId(requestId);
      await handleFriendRequest.mutateAsync({ requestId, accept });
      Alert.alert(
        'Success',
        accept ? 'Friend request accepted!' : 'Friend request rejected'
      );
      refetch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to handle friend request');
      console.error('Failed to handle friend request:', error);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const isRequestPending = (teamId: string) => {
    return friendRequests.some(
      (request) =>
        request.status === 'pending' &&
        ((request.receiver_id === teamId && request.sender_id === myTeam?.id) ||
          (request.sender_id === teamId && request.receiver_id === myTeam?.id))
    );
  };

  const isOutgoingRequest = (teamId: string) => {
    return friendRequests.some(
      (request) =>
        request.status === 'pending' &&
        request.sender_id === myTeam?.id &&
        request.receiver_id === teamId
    );
  };

  const isFriend = (teamId: string) => {
    return friendRequests.some(
      (request) =>
        request.status === 'accepted' &&
        ((request.receiver_id === teamId && request.sender_id === myTeam?.id) ||
          (request.sender_id === teamId && request.receiver_id === myTeam?.id))
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>
          {friends.length} Friends • {incomingRequests.length} Incoming •{' '}
          {outgoingRequests.length} Outgoing
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for teams..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#666"
          />
        </View>
      </View>

      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}

      {searchResults.length > 0 && searchQuery.length >= 2 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searchResults.map((team) => (
            <View key={team.id} style={styles.teamCard}>
              <Image
                source={{ uri: team.profile_picture_url }}
                style={styles.teamImage}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamRating}>Rating: {team.rating}</Text>
              </View>
              {!isFriend(team.id) && !isRequestPending(team.id) && (
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    sendingRequestTo === team.id && styles.loadingButton,
                  ]}
                  onPress={() => handleSendRequest(team.id)}
                  disabled={
                    sendingRequestTo === team.id || isRequestPending(team.id)
                  }
                >
                  {sendingRequestTo === team.id ? (
                    <ActivityIndicator size="small" color="#4CAF50" />
                  ) : (
                    <>
                      <UserPlus size={16} color="#4CAF50" />
                      <Text style={styles.buttonText}>Add Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {isOutgoingRequest(team.id) && (
                <View style={styles.pendingButton}>
                  <Clock size={16} color="#FFA000" />
                  <Text style={styles.pendingButtonText}>Request Sent</Text>
                </View>
              )}
              {isFriend(team.id) && (
                <View style={styles.friendBadge}>
                  <Check size={16} color="#fff" />
                  <Text style={styles.friendBadgeText}>Friends</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {searchQuery.length >= 2 &&
        searchResults.length === 0 &&
        !isSearching && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            <Text style={styles.emptyText}>
              No teams found matching "{searchQuery}"
            </Text>
          </View>
        )}

      {incomingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          {incomingRequests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <Image
                source={{ uri: request.sender?.profile_picture_url }}
                style={styles.teamImage}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{request.sender?.name}</Text>
                <Text style={styles.teamRating}>
                  Rating: {request.sender?.rating}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleRequestResponse(request.id, true)}
                  disabled={processingRequestId === request.id}
                >
                  {processingRequestId === request.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" />
                      <Text style={styles.actionButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleRequestResponse(request.id, false)}
                  disabled={processingRequestId === request.id}
                >
                  <X size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {outgoingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outgoing Requests</Text>
          {outgoingRequests.map((request) => (
            <View key={request.id} style={styles.outgoingRequestCard}>
              <Image
                source={{ uri: request.receiver?.profile_picture_url }}
                style={styles.teamImage}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{request.receiver?.name}</Text>
                <Text style={styles.teamRating}>
                  Rating: {request.receiver?.rating}
                </Text>
              </View>
              <View style={styles.pendingStatus}>
                <Clock size={16} color="#FFA000" />
                <Text style={styles.pendingStatusText}>Pending</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
        {friends.map((friend) => {
          // Determine which team is the friend (not the user's team)
          const friendTeam =
            friend.sender_id === myTeam?.id ? friend.receiver : friend.sender;

          return (
            <View key={friend.id} style={styles.teamCard}>
              <Image
                source={{ uri: friendTeam?.profile_picture_url }}
                style={styles.teamImage}
              />
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{friendTeam?.name}</Text>
                <Text style={styles.teamRating}>
                  Rating: {friendTeam?.rating}
                </Text>
              </View>
            </View>
          );
        })}
        {friends.length === 0 && (
          <Text style={styles.emptyText}>
            No friends yet. Start adding some!
          </Text>
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
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
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 10,
  },
  outgoingRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    marginBottom: 10,
  },
  teamImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  teamInfo: {
    flex: 1,
    marginLeft: 15,
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  teamRating: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9e6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  pendingButtonText: {
    color: '#FFA000',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  loadingButton: {
    backgroundColor: '#f0f9f0',
    opacity: 0.8,
  },
  buttonText: {
    color: '#4CAF50',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 20,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 4,
  },
  friendBadgeText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingStatusText: {
    color: '#FFA000',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
