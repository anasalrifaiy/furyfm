import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl, ImageErrorEventData, NativeSyntheticEvent } from 'react-native';
import { Trophy, TrendingUp, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useFriendRequests, useSendFriendRequest } from '@/lib/api';
import TeamDetailsModal from '@/components/TeamDetailsModal';

interface TeamStats {
  id: string;
  name: string;
  rating: number;
  logo_url: string | null;
  profile_picture_url: string | null;
  formation: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

const DEFAULT_TEAM_LOGO = 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200';

export default function LeagueScreen() {
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamStats | null>(null);
  const [selectedTeamPlayers, setSelectedTeamPlayers] = useState<any[]>([]);
  const { data: friendRequests = [] } = useFriendRequests();
  const sendFriendRequest = useSendFriendRequest();

  const handleImageError = (e: NativeSyntheticEvent<ImageErrorEventData>, teamId: string) => {
    console.log(`Failed to load image for team ${teamId}`, e.nativeEvent.error);
    // Update the team with default image
    setTeams(prevTeams => prevTeams.map(team => 
      team.id === teamId 
        ? { ...team, logo_url: DEFAULT_TEAM_LOGO, profile_picture_url: DEFAULT_TEAM_LOGO }
        : team
    ));
  };

  const fetchTeams = async () => {
    try {
      // Get all teams with their logos and profile pictures
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          rating,
          logo_url,
          profile_picture_url,
          formation,
          user_id
        `)
        .order('name', { ascending: true });

      if (teamsError) throw teamsError;

      // Ensure all teams have at least default image URLs
      const teamsWithImages = teamsData.map(team => ({
        ...team,
        logo_url: team.logo_url || DEFAULT_TEAM_LOGO,
        profile_picture_url: team.profile_picture_url || DEFAULT_TEAM_LOGO
      }));

      // Get match statistics for each team
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('played_at', { ascending: false });

      if (matchesError) throw matchesError;

      // Calculate team statistics
      const teamStats = teamsWithImages.map(team => {
        const stats = {
          ...team,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0
        };

        matchesData.forEach(match => {
          if (match.home_team_id === team.id || match.away_team_id === team.id) {
            stats.matches_played++;
            
            if (match.home_team_id === team.id) {
              stats.goals_for += match.home_score || 0;
              stats.goals_against += match.away_score || 0;
              
              if (match.home_score > match.away_score) {
                stats.wins++;
                stats.points += 3;
              } else if (match.home_score === match.away_score) {
                stats.draws++;
                stats.points += 1;
              } else {
                stats.losses++;
              }
            } else {
              stats.goals_for += match.away_score || 0;
              stats.goals_against += match.home_score || 0;
              
              if (match.away_score > match.home_score) {
                stats.wins++;
                stats.points += 3;
              } else if (match.away_score === match.home_score) {
                stats.draws++;
                stats.points += 1;
              } else {
                stats.losses++;
              }
            }
          }
        });

        return stats;
      });

      // Sort teams by points, then goal difference, then goals scored
      teamStats.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const aGoalDiff = a.goals_for - a.goals_against;
        const bGoalDiff = b.goals_for - b.goals_against;
        if (bGoalDiff !== aGoalDiff) return bGoalDiff - aGoalDiff;
        return b.goals_for - a.goals_for;
      });

      setTeams(teamStats);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTeamPlayers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('rating', { ascending: false });

      if (error) throw error;
      setSelectedTeamPlayers(data || []);
    } catch (error) {
      console.error('Error fetching team players:', error);
      setSelectedTeamPlayers([]);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  const handleTeamPress = async (team: TeamStats) => {
    setSelectedTeam(team);
    await fetchTeamPlayers(team.id);
  };

  const isFriend = (teamId: string) => {
    return friendRequests.some(request => 
      (request.receiver_id === teamId || request.sender_id === teamId) && 
      request.status === 'accepted'
    );
  };

  const isPendingRequest = (teamId: string) => {
    return friendRequests.some(request => 
      (request.receiver_id === teamId || request.sender_id === teamId) && 
      request.status === 'pending'
    );
  };

  const handleSendFriendRequest = async () => {
    if (!selectedTeam) return;
    try {
      await sendFriendRequest.mutateAsync(selectedTeam.id);
    } catch (error: any) {
      console.error('Error sending friend request:', error);
    }
  };

  if (loading) {
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>AnasZrock League</Text>
        <Text style={styles.subtitle}>2024/25 Season</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Trophy size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{teams.length}</Text>
          <Text style={styles.statLabel}>Teams</Text>
        </View>
        <View style={styles.statCard}>
          <Users size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{teams.reduce((sum, team) => sum + team.matches_played, 0)}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingUp size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>
            {teams.reduce((sum, team) => sum + team.goals_for, 0)}
          </Text>
          <Text style={styles.statLabel}>Goals</Text>
        </View>
      </View>
      
      <View style={styles.standings}>
        <Text style={styles.sectionTitle}>League Table</Text>
        
        <View style={styles.tableHeader}>
          <Text style={styles.rankHeader}>Pos</Text>
          <Text style={styles.teamHeader}>Team</Text>
          <Text style={styles.statHeader}>MP</Text>
          <Text style={styles.statHeader}>GD</Text>
          <Text style={styles.pointsHeader}>Pts</Text>
        </View>

        {teams.map((team, index) => (
          <TouchableOpacity 
            key={team.id} 
            style={styles.tableRow}
            onPress={() => handleTeamPress(team)}
          >
            <Text style={[
              styles.position,
              index < 4 && styles.positionTop,
              index >= teams.length - 3 && styles.positionBottom
            ]}>{index + 1}</Text>
            
            <View style={styles.teamInfo}>
              <Image 
                source={{ uri: team.logo_url || 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' }} 
                style={styles.teamLogo}
              />
              <View>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamRating}>Rating: {team.rating}</Text>
              </View>
            </View>
            
            <Text style={styles.stat}>{team.matches_played}</Text>
            <Text style={[
              styles.stat,
              (team.goals_for - team.goals_against) > 0 && styles.positiveValue,
              (team.goals_for - team.goals_against) < 0 && styles.negativeValue
            ]}>{team.goals_for - team.goals_against}</Text>
            <Text style={styles.points}>{team.points}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.championsLeague]} />
          <Text style={styles.legendText}>Champions League</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.europaLeague]} />
          <Text style={styles.legendText}>Europa League</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.relegation]} />
          <Text style={styles.legendText}>Relegation</Text>
        </View>
      </View>

      {selectedTeam && (
        <TeamDetailsModal
          visible={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
          team={selectedTeam}
          isFriend={isFriend(selectedTeam.id)}
          isPending={isPendingRequest(selectedTeam.id)}
          onSendFriendRequest={handleSendFriendRequest}
        />
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
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#000',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    marginTop: 15,
  },
  statCard: {
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
  standings: {
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
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rankHeader: {
    width: 40,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  teamHeader: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  statHeader: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  pointsHeader: {
    width: 40,
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  position: {
    width: 40,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  positionTop: {
    color: '#4CAF50',
    fontFamily: 'Inter_600SemiBold',
  },
  positionBottom: {
    color: '#f44336',
    fontFamily: 'Inter_600SemiBold',
  },
  teamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  teamRating: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
  },
  stat: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  negativeValue: {
    color: '#f44336',
  },
  points: {
    width: 40,
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
  },
  legend: {
    margin: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  championsLeague: {
    backgroundColor: '#4CAF50',
  },
  europaLeague: {
    backgroundColor: '#2196F3',
  },
  relegation: {
    backgroundColor: '#f44336',
  },
});
