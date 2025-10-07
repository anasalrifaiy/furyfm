import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, push } from 'firebase/database';
import { showAlert } from '../utils/alert';

const Match = ({ onBack }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [matchState, setMatchState] = useState('select'); // 'select', 'playing', 'halftime', 'finished'
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState([]);
  const [myFormation, setMyFormation] = useState([]);
  const [opponentFormation, setOpponentFormation] = useState([]);

  useEffect(() => {
    if (managerProfile) {
      loadFriends();
    }
  }, [managerProfile]);

  const loadFriends = async () => {
    if (!managerProfile?.friends || managerProfile.friends.length === 0) {
      setFriends([]);
      return;
    }

    const friendsData = [];
    for (const friendId of managerProfile.friends) {
      const friendRef = ref(database, `managers/${friendId}`);
      const snapshot = await get(friendRef);
      if (snapshot.exists()) {
        friendsData.push({ uid: friendId, ...snapshot.val() });
      }
    }
    setFriends(friendsData);
  };

  const selectOpponent = (opponent) => {
    setSelectedOpponent(opponent);
    // Get starting XI from both teams
    const myStarting = (managerProfile.squad || []).slice(0, 11);
    const opponentStarting = (opponent.squad || []).slice(0, 11);

    if (myStarting.length < 11) {
      showAlert('Not Enough Players', 'You need at least 11 players in your squad to play a match.');
      return;
    }

    if (opponentStarting.length < 11) {
      showAlert('Opponent Not Ready', 'Your opponent doesn\'t have enough players yet.');
      return;
    }

    setMyFormation(myStarting);
    setOpponentFormation(opponentStarting);
  };

  const startMatch = () => {
    if (!selectedOpponent) return;

    setMatchState('playing');
    setHomeScore(0);
    setAwayScore(0);
    setMinute(0);
    setEvents([]);

    // Start match simulation
    simulateMatch();
  };

  const simulateMatch = () => {
    let currentMinute = 0;
    const matchEvents = [];

    const interval = setInterval(() => {
      currentMinute++;
      setMinute(currentMinute);

      // Random chance of goal (5% per minute)
      if (Math.random() < 0.05) {
        const isHomeGoal = Math.random() < 0.5;
        const scorer = isHomeGoal
          ? myFormation[Math.floor(Math.random() * myFormation.length)]
          : opponentFormation[Math.floor(Math.random() * opponentFormation.length)];

        if (isHomeGoal) {
          setHomeScore(prev => prev + 1);
          matchEvents.unshift(`${currentMinute}' ⚽ GOAL! ${scorer.name} scores for ${managerProfile.managerName}!`);
        } else {
          setAwayScore(prev => prev + 1);
          matchEvents.unshift(`${currentMinute}' ⚽ GOAL! ${scorer.name} scores for ${selectedOpponent.managerName}!`);
        }
        setEvents([...matchEvents]);
      }

      // Half time at 60 seconds (1 minute)
      if (currentMinute === 60) {
        clearInterval(interval);
        setMatchState('halftime');
      }

      // Full time at 120 seconds (2 minutes)
      if (currentMinute === 120) {
        clearInterval(interval);
        finishMatch(homeScore, awayScore);
      }
    }, 1000); // 1 second = 1 minute in game
  };

  const resumeFromHalftime = () => {
    setMatchState('playing');
    simulateMatch();
  };

  const finishMatch = async (finalHome, finalAway) => {
    setMatchState('finished');

    let result = '';
    let pointsGained = 0;
    let wins = managerProfile.wins || 0;
    let draws = managerProfile.draws || 0;
    let losses = managerProfile.losses || 0;

    if (finalHome > finalAway) {
      result = 'WIN';
      pointsGained = 3;
      wins++;
    } else if (finalHome < finalAway) {
      result = 'LOSS';
      pointsGained = 0;
      losses++;
    } else {
      result = 'DRAW';
      pointsGained = 1;
      draws++;
    }

    const newPoints = (managerProfile.points || 0) + pointsGained;

    await updateManagerProfile({
      wins,
      draws,
      losses,
      points: newPoints
    });

    // Send notification to opponent
    const notificationRef = ref(database, `managers/${selectedOpponent.uid}/notifications`);
    await push(notificationRef, {
      type: 'match_result',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} challenged you to a match! Result: ${finalHome}-${finalAway}`,
      timestamp: Date.now(),
      read: false
    });
  };

  const makeSubstitution = (outPlayerIndex) => {
    // Get bench players (squad members not in starting XI)
    const bench = (managerProfile.squad || []).filter(p =>
      !myFormation.some(fp => fp.id === p.id)
    );

    if (bench.length === 0) {
      showAlert('No Substitutes', 'You don\'t have any players on the bench.');
      return;
    }

    // For simplicity, substitute with first bench player
    const newFormation = [...myFormation];
    newFormation[outPlayerIndex] = bench[0];
    setMyFormation(newFormation);

    const newEvent = `${minute}' 🔄 Substitution: ${bench[0].name} replaces ${myFormation[outPlayerIndex].name}`;
    setEvents([newEvent, ...events]);

    showAlert('Substitution Made', `${bench[0].name} is now on the pitch.`);
  };

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Select Opponent Screen
  if (matchState === 'select' && !selectedOpponent) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match - Select Opponent</Text>
        </View>

        <ScrollView style={styles.content}>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚽</Text>
              <Text style={styles.emptyTitle}>No Friends Available</Text>
              <Text style={styles.emptyDesc}>
                Add friends first to challenge them to a match!
              </Text>
            </View>
          ) : (
            friends.map(friend => (
              <TouchableOpacity
                key={friend.uid}
                style={styles.friendCard}
                onPress={() => selectOpponent(friend)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{friend.managerName.charAt(0)}</Text>
                </View>
                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>{friend.managerName}</Text>
                  <Text style={styles.friendStats}>
                    W:{friend.wins || 0} D:{friend.draws || 0} L:{friend.losses || 0} • Points: {friend.points || 0}
                  </Text>
                  <Text style={styles.friendSquad}>Squad: {friend.squad?.length || 0} players</Text>
                </View>
                <View style={styles.challengeButton}>
                  <Text style={styles.challengeButtonText}>Challenge</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Pre-match screen (after selecting opponent)
  if (matchState === 'select' && selectedOpponent) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedOpponent(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match Preview</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.matchupCard}>
            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{managerProfile.managerName}</Text>
              <Text style={styles.teamRecord}>
                {managerProfile.wins || 0}W - {managerProfile.draws || 0}D - {managerProfile.losses || 0}L
              </Text>
              <Text style={styles.teamPoints}>{managerProfile.points || 0} pts</Text>
            </View>

            <Text style={styles.vs}>VS</Text>

            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{selectedOpponent.managerName}</Text>
              <Text style={styles.teamRecord}>
                {selectedOpponent.wins || 0}W - {selectedOpponent.draws || 0}D - {selectedOpponent.losses || 0}L
              </Text>
              <Text style={styles.teamPoints}>{selectedOpponent.points || 0} pts</Text>
            </View>
          </View>

          <View style={styles.formationPreview}>
            <Text style={styles.sectionTitle}>Your Starting XI</Text>
            {myFormation.map((player, index) => (
              <View key={player.id} style={styles.playerRow}>
                <Text style={styles.playerPosition}>{player.position}</Text>
                <Text style={styles.playerRowName}>{player.name}</Text>
                <Text style={styles.playerRowRating}>{player.overall}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.startMatchButton} onPress={startMatch}>
            <Text style={styles.startMatchButtonText}>⚽ Start Match</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Half-time screen
  if (matchState === 'halftime') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Half Time</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.scoreBoard}>
            <Text style={styles.scoreBoardTitle}>Half Time Score</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreTeam}>{managerProfile.managerName}</Text>
              <Text style={styles.score}>{homeScore} - {awayScore}</Text>
              <Text style={styles.scoreTeam}>{selectedOpponent.managerName}</Text>
            </View>
          </View>

          <View style={styles.substitutionSection}>
            <Text style={styles.sectionTitle}>Make Substitutions</Text>
            <Text style={styles.sectionDesc}>Tap a player to substitute them</Text>
            {myFormation.map((player, index) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerRow}
                onPress={() => makeSubstitution(index)}
              >
                <Text style={styles.playerPosition}>{player.position}</Text>
                <Text style={styles.playerRowName}>{player.name}</Text>
                <Text style={styles.playerRowRating}>{player.overall}</Text>
                <Text style={styles.subIcon}>🔄</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.continueButton} onPress={resumeFromHalftime}>
            <Text style={styles.continueButtonText}>Continue to 2nd Half</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Playing screen
  if (matchState === 'playing') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Match in Progress</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.liveScoreBoard}>
            <View style={styles.minuteDisplay}>
              <Text style={styles.minuteText}>{minute}'</Text>
              <Text style={styles.liveIndicator}>● LIVE</Text>
            </View>
            <View style={styles.liveScoreRow}>
              <View style={styles.liveTeam}>
                <Text style={styles.liveTeamName}>{managerProfile.managerName}</Text>
                <Text style={styles.liveScore}>{homeScore}</Text>
              </View>
              <Text style={styles.liveDash}>-</Text>
              <View style={styles.liveTeam}>
                <Text style={styles.liveScore}>{awayScore}</Text>
                <Text style={styles.liveTeamName}>{selectedOpponent.managerName}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.eventsContainer}>
            <Text style={styles.eventsTitle}>Match Events</Text>
            {events.length === 0 ? (
              <Text style={styles.noEvents}>No goals yet...</Text>
            ) : (
              events.map((event, index) => (
                <View key={index} style={styles.eventRow}>
                  <Text style={styles.eventText}>{event}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Finished screen
  if (matchState === 'finished') {
    const result = homeScore > awayScore ? 'WIN' : homeScore < awayScore ? 'LOSS' : 'DRAW';
    const resultColor = result === 'WIN' ? '#43e97b' : result === 'LOSS' ? '#f5576c' : '#ffa726';

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to Menu</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Full Time</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.resultCard}>
            <Text style={[styles.resultText, { color: resultColor }]}>{result}</Text>
            <View style={styles.finalScoreRow}>
              <Text style={styles.finalTeam}>{managerProfile.managerName}</Text>
              <Text style={styles.finalScore}>{homeScore} - {awayScore}</Text>
              <Text style={styles.finalTeam}>{selectedOpponent.managerName}</Text>
            </View>
            <Text style={styles.pointsEarned}>
              Points earned: {result === 'WIN' ? '+3' : result === 'DRAW' ? '+1' : '0'}
            </Text>
          </View>

          <View style={styles.matchSummary}>
            <Text style={styles.summaryTitle}>Match Events</Text>
            {events.length === 0 ? (
              <Text style={styles.noEvents}>0-0 Goalless draw</Text>
            ) : (
              events.reverse().map((event, index) => (
                <View key={index} style={styles.summaryEvent}>
                  <Text style={styles.summaryEventText}>{event}</Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.newMatchButton} onPress={() => {
            setMatchState('select');
            setSelectedOpponent(null);
            setHomeScore(0);
            setAwayScore(0);
            setMinute(0);
            setEvents([]);
          }}>
            <Text style={styles.newMatchButtonText}>Play Another Match</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
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
    fontSize: 28,
    fontWeight: 'bold',
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
    lineHeight: 24,
  },
  friendCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  friendStats: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  friendSquad: {
    fontSize: 12,
    color: '#aaa',
  },
  challengeButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  challengeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  matchupCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  teamRecord: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  teamPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#43e97b',
  },
  vs: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffa726',
    marginHorizontal: 20,
  },
  formationPreview: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  playerPosition: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffa726',
    width: 50,
  },
  playerRowName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  playerRowRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#43e97b',
    marginRight: 10,
  },
  subIcon: {
    fontSize: 16,
  },
  startMatchButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  startMatchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scoreBoard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  scoreBoardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTeam: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  score: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffa726',
    marginHorizontal: 20,
  },
  substitutionSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  continueButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveScoreBoard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  minuteDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  minuteText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 10,
  },
  liveIndicator: {
    fontSize: 14,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  liveScoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTeam: {
    alignItems: 'center',
  },
  liveTeamName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  liveScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveDash: {
    fontSize: 36,
    color: '#888',
    marginHorizontal: 20,
  },
  eventsContainer: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  noEvents: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  eventRow: {
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  eventText: {
    fontSize: 14,
    color: '#ffffff',
  },
  resultCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  resultText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  finalTeam: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  finalScore: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginHorizontal: 20,
  },
  pointsEarned: {
    fontSize: 18,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  matchSummary: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  summaryEvent: {
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  summaryEventText: {
    fontSize: 14,
    color: '#ffffff',
  },
  newMatchButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  newMatchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default Match;
