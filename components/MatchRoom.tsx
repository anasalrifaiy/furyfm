import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Check, X, Play } from 'lucide-react-native';

interface MatchRoomProps {
  roomId: string;
  onClose: () => void;
  isHost: boolean;
}

export default function MatchRoom({ roomId, onClose, isHost }: MatchRoomProps) {
  const [room, setRoom] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setRoom(payload.new);
          if (payload.new.status === 'in_progress') {
            fetchMatch(payload.new.host_team_id, payload.new.guest_team_id);
          }
        }
      )
      .subscribe();

    // Initial room fetch
    fetchRoom();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    if (!match) return;

    // Subscribe to match events
    const eventsChannel = supabase
      .channel(`match:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          setEvents(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    // Subscribe to match updates
    const matchChannel = supabase
      .channel(`match_update:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          setMatch(payload.new);
        }
      )
      .subscribe();

    return () => {
      eventsChannel.unsubscribe();
      matchChannel.unsubscribe();
    };
  }, [match?.id]);

  const fetchRoom = async () => {
    try {
      const { data, error } = await supabase
        .from('match_rooms')
        .select(`
          *,
          host_team:host_team_id(id, name, rating, formation),
          guest_team:guest_team_id(id, name, rating, formation)
        `)
        .eq('id', roomId)
        .single();

      if (error) throw error;
      setRoom(data);

      if (data.status === 'in_progress') {
        fetchMatch(data.host_team_id, data.guest_team_id);
      }
    } catch (error) {
      console.error('Error fetching room:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatch = async (hostTeamId: string, guestTeamId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('home_team_id', hostTeamId)
        .eq('away_team_id', guestTeamId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setMatch(data);

      // Fetch existing events
      const { data: events, error: eventsError } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', data.id)
        .order('minute', { ascending: true });

      if (eventsError) throw eventsError;
      setEvents(events || []);
    } catch (error) {
      console.error('Error fetching match:', error);
    }
  };

  const handleReady = async () => {
    try {
      await supabase.rpc('set_match_ready', {
        p_room_id: roomId,
        p_ready: !ready
      });
      setReady(!ready);
    } catch (error) {
      console.error('Error setting ready status:', error);
    }
  };

  const handleStart = async () => {
    try {
      await supabase.rpc('start_match', {
        p_room_id: roomId
      });
    } catch (error) {
      console.error('Error starting match:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const isMatchInProgress = room?.status === 'in_progress';
  const isMatchComplete = room?.status === 'completed';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Match Room</Text>
        <TouchableOpacity onPress={onClose}>
          <X size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamName}>{room.host_team.name}</Text>
          <Text style={styles.teamRating}>Rating: {room.host_team.rating}</Text>
          <Text style={styles.teamFormation}>{room.host_team.formation}</Text>
          {!isMatchInProgress && room.host_ready && (
            <View style={styles.readyBadge}>
              <Check size={16} color="#fff" />
              <Text style={styles.readyText}>Ready</Text>
            </View>
          )}
          {match && (
            <Text style={styles.score}>{match.home_score || 0}</Text>
          )}
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={styles.team}>
          <Text style={styles.teamName}>{room.guest_team.name}</Text>
          <Text style={styles.teamRating}>Rating: {room.guest_team.rating}</Text>
          <Text style={styles.teamFormation}>{room.guest_team.formation}</Text>
          {!isMatchInProgress && room.guest_ready && (
            <View style={styles.readyBadge}>
              <Check size={16} color="#fff" />
              <Text style={styles.readyText}>Ready</Text>
            </View>
          )}
          {match && (
            <Text style={styles.score}>{match.away_score || 0}</Text>
          )}
        </View>
      </View>

      {(isMatchInProgress || isMatchComplete) && (
        <View style={styles.matchEvents}>
          <Text style={styles.eventsTitle}>Match Events</Text>
          <ScrollView style={styles.eventsList}>
            {events.map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <Text style={styles.eventMinute}>{event.minute}'</Text>
                <Text style={styles.eventDescription}>{event.description}</Text>
              </View>
            ))}
            {events.length === 0 && (
              <Text style={styles.noEvents}>Waiting for match events...</Text>
            )}
          </ScrollView>
        </View>
      )}

      {!isMatchInProgress && !isMatchComplete && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, ready && styles.buttonActive]}
            onPress={handleReady}
          >
            <Text style={styles.buttonText}>
              {ready ? 'Not Ready' : 'Ready'}
            </Text>
          </TouchableOpacity>

          {isHost && room.status === 'ready' && (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={handleStart}
            >
              <Play size={20} color="#fff" />
              <Text style={styles.buttonText}>Start Match</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isMatchComplete && (
        <TouchableOpacity
          style={[styles.button, styles.closeButton]}
          onPress={onClose}
        >
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  team: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 5,
  },
  teamRating: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginBottom: 5,
  },
  teamFormation: {
    fontFamily: 'Inter_600SemiBold',
    color: '#4CAF50',
  },
  score: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#2196F3',
    marginTop: 10,
  },
  vs: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginHorizontal: 20,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginTop: 10,
  },
  readyText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 5,
  },
  matchEvents: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  eventsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 10,
  },
  eventsList: {
    flex: 1,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  eventMinute: {
    fontFamily: 'Inter_600SemiBold',
    width: 40,
    color: '#666',
  },
  eventDescription: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
  noEvents: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 20,
  },
  actions: {
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
  },
  buttonActive: {
    backgroundColor: '#4CAF50',
  },
  startButton: {
    backgroundColor: '#2196F3',
  },
  closeButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginLeft: 5,
  },
});