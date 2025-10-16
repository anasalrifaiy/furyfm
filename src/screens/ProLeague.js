import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, push, set, onValue } from 'firebase/database';
import { showAlert } from '../utils/alert';

const ProLeague = ({ onBack, onStartMatch }) => {
  const { currentUser, managerProfile } = useAuth();
  const [allManagers, setAllManagers] = useState([]);
  const [standings, setStandings] = useState([]);
  const [playedToday, setPlayedToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('matches'); // 'matches' or 'standings'

  useEffect(() => {
    if (currentUser) {
      loadAllManagers();
      loadPlayedToday();
    }
  }, [currentUser]);

  const loadAllManagers = async () => {
    try {
      const managersRef = ref(database, 'managers');
      const snapshot = await get(managersRef);

      if (snapshot.exists()) {
        const managersData = [];
        const opponentsData = [];
        snapshot.forEach(childSnapshot => {
          const manager = childSnapshot.val();
          const managerWithUid = {
            uid: childSnapshot.key,
            ...manager
          };

          // Add all managers to standings
          managersData.push(managerWithUid);

          // Only add opponents (exclude self) to available matches
          if (childSnapshot.key !== currentUser.uid) {
            opponentsData.push(managerWithUid);
          }
        });

        // Sort by points for standings
        const sortedStandings = [...managersData].sort((a, b) => {
          const aPoints = a.leaguePoints || 0;
          const bPoints = b.leaguePoints || 0;
          if (aPoints !== bPoints) return bPoints - aPoints;

          // Tiebreaker: goal difference
          const aGD = (a.leagueGoalsFor || 0) - (a.leagueGoalsAgainst || 0);
          const bGD = (b.leagueGoalsFor || 0) - (b.leagueGoalsAgainst || 0);
          return bGD - aGD;
        });

        setAllManagers(opponentsData); // Only opponents for match challenges
        setStandings(sortedStandings); // All managers including self for standings
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading managers:', error);
      setLoading(false);
    }
  };

  const loadPlayedToday = async () => {
    try {
      const today = new Date().toDateString(); // e.g., "Mon Jan 01 2024"
      const myLeagueMatchesRef = ref(database, `managers/${currentUser.uid}/leagueMatches`);
      const snapshot = await get(myLeagueMatchesRef);

      if (snapshot.exists()) {
        const matches = snapshot.val();
        const todayMatches = Object.entries(matches)
          .filter(([opponentId, matchData]) => {
            const matchDate = new Date(matchData.timestamp).toDateString();
            return matchDate === today;
          })
          .map(([opponentId]) => opponentId);

        setPlayedToday(todayMatches);
      }
    } catch (error) {
      console.error('Error loading today matches:', error);
    }
  };

  const canPlayAgainst = (opponentId) => {
    return !playedToday.includes(opponentId);
  };

  const challengeInProLeague = async (opponent) => {
    if (!canPlayAgainst(opponent.uid)) {
      showAlert('Already Played Today', `You've already played against ${opponent.clubName || opponent.managerName} today. Come back tomorrow!`);
      return;
    }

    // Check if opponent is in an active match
    const matchesRef = ref(database, 'matches');
    const matchesSnapshot = await get(matchesRef);

    if (matchesSnapshot.exists()) {
      let opponentActiveMatch = null;
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

      matchesSnapshot.forEach(childSnapshot => {
        const match = childSnapshot.val();
        const matchAge = match.createdAt || 0;

        if (
          matchAge > twoHoursAgo &&
          (match.state === 'waiting' || match.state === 'prematch' || match.state === 'ready' || match.state === 'playing' || match.state === 'halftime' || match.state === 'paused') &&
          (match.homeManager?.uid === opponent.uid || match.awayManager?.uid === opponent.uid)
        ) {
          opponentActiveMatch = match;
        }
      });

      if (opponentActiveMatch) {
        showAlert('Opponent Busy', `${opponent.managerName} is currently in another match. Please try again later.`);
        return;
      }
    }

    // Check if I'm in an active match
    if (matchesSnapshot.exists()) {
      let myActiveMatch = null;
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

      matchesSnapshot.forEach(childSnapshot => {
        const match = childSnapshot.val();
        const matchAge = match.createdAt || 0;

        if (
          matchAge > twoHoursAgo &&
          (match.state === 'waiting' || match.state === 'prematch' || match.state === 'ready' || match.state === 'playing' || match.state === 'halftime' || match.state === 'paused') &&
          (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid)
        ) {
          myActiveMatch = { id: childSnapshot.key, ...match };
        }
      });

      if (myActiveMatch) {
        showAlert('Already in a Match', 'You are already in an active match. Finish or forfeit it first.');
        return;
      }
    }

    // Validate squad
    const myStarting = (managerProfile.squad || []).slice(0, 11);
    if (myStarting.length < 11) {
      showAlert('Not Enough Players', 'You need at least 11 players in your squad to play a Pro League match.');
      return;
    }

    // Create Pro League match
    const matchData = {
      homeManager: {
        uid: currentUser.uid,
        name: managerProfile.managerName,
        clubName: managerProfile.clubName || managerProfile.managerName,
        squad: myStarting,
        formation: managerProfile.formation || '4-3-3',
        ready: false
      },
      awayManager: {
        uid: opponent.uid,
        name: opponent.managerName,
        clubName: opponent.clubName || opponent.managerName,
        squad: (opponent.squad || []).slice(0, 11),
        formation: opponent.formation || '4-3-3',
        ready: false
      },
      state: 'waiting',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      events: [],
      createdAt: Date.now(),
      isProLeague: true // Mark as Pro League match
    };

    const newMatchRef = push(ref(database, 'matches'));
    const matchId = newMatchRef.key;
    await set(newMatchRef, matchData);

    // Send notification to opponent
    const notificationRef = ref(database, `managers/${opponent.uid}/notifications`);
    await push(notificationRef, {
      type: 'proleague_challenge',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      matchId: matchId,
      message: `${managerProfile.managerName} challenges you to a Pro League match!`,
      timestamp: Date.now(),
      read: false
    });

    showAlert('Pro League Challenge Sent!', 'Waiting for opponent to accept...');

    // Navigate to match screen
    if (onStartMatch) {
      onStartMatch(matchId);
    }
  };

  const getCountryFlag = (nationality) => {
    const flags = {
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'Spain': '🇪🇸',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Italy': '🇮🇹',
      'Portugal': '🇵🇹',
      'Brazil': '🇧🇷',
      'Argentina': '🇦🇷',
      'Netherlands': '🇳🇱',
      'Belgium': '🇧🇪',
      'USA': '🇺🇸',
      'Mexico': '🇲🇽',
      'Japan': '🇯🇵',
      'South Korea': '🇰🇷',
      'Saudi Arabia': '🇸🇦',
      'Egypt': '🇪🇬',
      'Morocco': '🇲🇦',
      'Nigeria': '🇳🇬',
      'Ghana': '🇬🇭',
      'Croatia': '🇭🇷',
      'Poland': '🇵🇱',
      'Sweden': '🇸🇪',
      'Denmark': '🇩🇰',
      'Uruguay': '🇺🇾',
      'Colombia': '🇨🇴',
      'Chile': '🇨🇱',
      'Senegal': '🇸🇳',
      'Algeria': '🇩🇿',
      'Turkey': '🇹🇷',
      'Switzerland': '🇨🇭',
      'Austria': '🇦🇹',
    };
    return flags[nationality] || '🌍';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pro League</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Pro League...</Text>
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
        <Text style={styles.title}>Pro League</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'matches' && styles.tabActive]}
          onPress={() => setSelectedTab('matches')}
        >
          <Text style={[styles.tabText, selectedTab === 'matches' && styles.tabTextActive]}>
            🎮 Matches
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'standings' && styles.tabActive]}
          onPress={() => setSelectedTab('standings')}
        >
          <Text style={[styles.tabText, selectedTab === 'standings' && styles.tabTextActive]}>
            🏆 Standings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {selectedTab === 'matches' ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Pro League Rules</Text>
                <Text style={styles.infoText}>
                  • Play against each manager once per day{'\n'}
                  • Win: 3 points • Draw: 1 point • Loss: 0 points{'\n'}
                  • Compete for the top of the standings!
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Available Opponents</Text>
            <Text style={styles.sectionSubtitle}>
              Played today: {playedToday.length}/{allManagers.length}
            </Text>

            {allManagers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>No Opponents Available</Text>
                <Text style={styles.emptyDesc}>
                  More managers need to join the Pro League!
                </Text>
              </View>
            ) : (
              allManagers.map(manager => {
                const canPlay = canPlayAgainst(manager.uid);
                return (
                  <TouchableOpacity
                    key={manager.uid}
                    style={[styles.managerCard, !canPlay && styles.managerCardDisabled]}
                    onPress={() => canPlay && challengeInProLeague(manager)}
                    disabled={!canPlay}
                  >
                    <View style={styles.managerAvatar}>
                      <Text style={styles.managerAvatarText}>
                        {(manager.clubName || manager.managerName).charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.managerDetails}>
                      <Text style={styles.managerClubName}>
                        {manager.clubName || manager.managerName}
                      </Text>
                      <Text style={styles.managerName}>
                        {getCountryFlag(manager.nationality)} {manager.managerName}
                      </Text>
                      <Text style={styles.managerStats}>
                        League: {manager.leagueWins || 0}W-{manager.leagueDraws || 0}D-{manager.leagueLosses || 0}L • {manager.leaguePoints || 0} pts
                      </Text>
                    </View>
                    <View style={[styles.challengeButton, !canPlay && styles.challengeButtonDisabled]}>
                      <Text style={styles.challengeButtonText}>
                        {canPlay ? 'Challenge' : '✓ Played'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : (
          <>
            <View style={styles.standingsHeader}>
              <Text style={styles.standingsTitle}>Pro League Standings</Text>
              <Text style={styles.standingsSubtitle}>Season {new Date().getFullYear()}</Text>
            </View>

            <View style={styles.standingsTable}>
              <View style={styles.standingsTableHeader}>
                <Text style={[styles.standingsTableCell, styles.standingsPos]}>#</Text>
                <Text style={[styles.standingsTableCell, styles.standingsClub]}>Club</Text>
                <Text style={[styles.standingsTableCell, styles.standingsNum]}>P</Text>
                <Text style={[styles.standingsTableCell, styles.standingsNum]}>W</Text>
                <Text style={[styles.standingsTableCell, styles.standingsNum]}>D</Text>
                <Text style={[styles.standingsTableCell, styles.standingsNum]}>L</Text>
                <Text style={[styles.standingsTableCell, styles.standingsNum]}>GD</Text>
                <Text style={[styles.standingsTableCell, styles.standingsPts]}>Pts</Text>
              </View>

              {standings.map((manager, index) => {
                const played = (manager.leagueWins || 0) + (manager.leagueDraws || 0) + (manager.leagueLosses || 0);
                const goalsFor = manager.leagueGoalsFor || 0;
                const goalsAgainst = manager.leagueGoalsAgainst || 0;
                const goalDifference = goalsFor - goalsAgainst;
                const points = manager.leaguePoints || 0;
                const isCurrentUser = manager.uid === currentUser.uid;

                return (
                  <View
                    key={manager.uid}
                    style={[
                      styles.standingsTableRow,
                      isCurrentUser && styles.standingsTableRowHighlight
                    ]}
                  >
                    <Text style={[styles.standingsTableCell, styles.standingsPos, styles.standingsPosition]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.standingsTableCell, styles.standingsClub, styles.standingsClubText]}>
                      {manager.clubName || manager.managerName}
                    </Text>
                    <Text style={[styles.standingsTableCell, styles.standingsNum]}>{played}</Text>
                    <Text style={[styles.standingsTableCell, styles.standingsNum]}>{manager.leagueWins || 0}</Text>
                    <Text style={[styles.standingsTableCell, styles.standingsNum]}>{manager.leagueDraws || 0}</Text>
                    <Text style={[styles.standingsTableCell, styles.standingsNum]}>{manager.leagueLosses || 0}</Text>
                    <Text style={[styles.standingsTableCell, styles.standingsNum, goalDifference > 0 && styles.positiveGD]}>
                      {goalDifference > 0 ? '+' : ''}{goalDifference}
                    </Text>
                    <Text style={[styles.standingsTableCell, styles.standingsPts, styles.standingsPointsText]}>
                      {points}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.legendCard}>
              <Text style={styles.legendTitle}>Legend</Text>
              <Text style={styles.legendText}>
                P: Played • W: Wins • D: Draws • L: Losses • GD: Goal Difference • Pts: Points
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 15,
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
  infoCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  infoIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
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
    lineHeight: 24,
  },
  managerCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  managerCardDisabled: {
    opacity: 0.5,
  },
  managerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  managerAvatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  managerDetails: {
    flex: 1,
  },
  managerClubName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  managerName: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  managerStats: {
    fontSize: 12,
    color: '#888',
  },
  challengeButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  challengeButtonDisabled: {
    background: 'linear-gradient(135deg, #2d3561 0%, #1a1f3a 100%)',
  },
  challengeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  standingsHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  standingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  standingsSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  standingsTable: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d3561',
    marginBottom: 20,
  },
  standingsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#252b54',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#667eea',
  },
  standingsTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  standingsTableRowHighlight: {
    backgroundColor: '#2d3561',
  },
  standingsTableCell: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
  },
  standingsPos: {
    width: 30,
    fontWeight: 'bold',
  },
  standingsPosition: {
    color: '#667eea',
  },
  standingsClub: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 5,
  },
  standingsClubText: {
    fontWeight: 'bold',
  },
  standingsNum: {
    width: 30,
  },
  standingsPts: {
    width: 40,
  },
  standingsPointsText: {
    fontWeight: 'bold',
    color: '#43e97b',
  },
  positiveGD: {
    color: '#43e97b',
  },
  legendCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
});

export default ProLeague;
