import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

const MatchHistory = ({ onBack }) => {
  const { currentUser, managerProfile } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMatchHistory();
  }, [currentUser]);

  const loadMatchHistory = async () => {
    if (!currentUser) return;

    try {
      const matchHistoryRef = ref(database, `managers/${currentUser.uid}/matchHistory`);
      const snapshot = await get(matchHistoryRef);

      if (snapshot.exists()) {
        const historyData = [];
        snapshot.forEach(childSnapshot => {
          historyData.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });

        // Sort by date, newest first (using playedAt timestamp)
        historyData.sort((a, b) => (b.playedAt || b.date || 0) - (a.playedAt || a.date || 0));
        setMatches(historyData);
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error('Error loading match history:', error);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMatchResult = (match) => {
    const isHome = match.homeManager.uid === currentUser.uid;
    const myScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (myScore > opponentScore) return 'WIN';
    if (myScore < opponentScore) return 'LOSS';
    return 'DRAW';
  };

  const getOpponentName = (match) => {
    const isHome = match.homeManager.uid === currentUser.uid;
    return isHome ? match.awayManager.name : match.homeManager.name;
  };

  const getMyScore = (match) => {
    const isHome = match.homeManager.uid === currentUser.uid;
    return isHome ? match.homeScore : match.awayScore;
  };

  const getOpponentScore = (match) => {
    const isHome = match.homeManager.uid === currentUser.uid;
    return isHome ? match.awayScore : match.homeScore;
  };

  const getResultColor = (result) => {
    if (result === 'WIN') return '#43e97b';
    if (result === 'LOSS') return '#f5576c';
    return '#ffa726';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading matches...</Text>
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
        <Text style={styles.title}>Match History</Text>
        <Text style={styles.subtitle}>Total Matches: {matches.length}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⚽</Text>
            <Text style={styles.emptyTitle}>No matches played yet</Text>
            <Text style={styles.emptyDesc}>Challenge your friends to start building your match history!</Text>
          </View>
        ) : (
          matches.map(match => {
            const result = getMatchResult(match);
            const opponentName = getOpponentName(match);
            const myScore = getMyScore(match);
            const opponentScore = getOpponentScore(match);

            return (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchDate}>{formatDate(match.playedAt)}</Text>
                  <View style={[styles.resultBadge, { backgroundColor: getResultColor(result) }]}>
                    <Text style={styles.resultText}>{result}</Text>
                  </View>
                </View>

                <View style={styles.matchDetails}>
                  <View style={styles.teamSection}>
                    <Text style={[styles.teamName, result === 'WIN' && styles.winnerText]}>
                      {managerProfile?.managerName || 'You'}
                    </Text>
                    <Text style={styles.teamScore}>{myScore}</Text>
                  </View>

                  <Text style={styles.vs}>VS</Text>

                  <View style={styles.teamSection}>
                    <Text style={styles.teamScore}>{opponentScore}</Text>
                    <Text style={[styles.teamName, result === 'LOSS' && styles.winnerText]}>
                      {opponentName}
                    </Text>
                  </View>
                </View>

                {/* Match Statistics */}
                {(match.homePossession || match.homeShots || match.topScorers) && (
                  <View style={styles.statsSection}>
                    <Text style={styles.statsTitle}>📊 Match Statistics</Text>

                    {/* Formations & Tactics */}
                    {match.homeManager.formation && (
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Formation</Text>
                        <Text style={styles.statValue}>
                          {match.homeManager.uid === currentUser.uid ? match.homeManager.formation : match.awayManager.formation}
                          {' vs '}
                          {match.homeManager.uid === currentUser.uid ? match.awayManager.formation : match.homeManager.formation}
                        </Text>
                      </View>
                    )}

                    {match.homeManager.tactic && (
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Tactic</Text>
                        <Text style={styles.statValue}>
                          {match.homeManager.uid === currentUser.uid ? match.homeManager.tactic : match.awayManager.tactic}
                          {' vs '}
                          {match.homeManager.uid === currentUser.uid ? match.awayManager.tactic : match.homeManager.tactic}
                        </Text>
                      </View>
                    )}

                    {/* Possession */}
                    {match.homePossession && (
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Possession</Text>
                        <View style={styles.possessionBar}>
                          <View style={[styles.possessionHome, {
                            width: `${match.homeManager.uid === currentUser.uid ? match.homePossession : match.awayPossession}%`
                          }]} />
                          <Text style={styles.possessionText}>
                            {match.homeManager.uid === currentUser.uid ? match.homePossession : match.awayPossession}%
                            {' - '}
                            {match.homeManager.uid === currentUser.uid ? match.awayPossession : match.homePossession}%
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Shots */}
                    {match.homeShots !== undefined && (
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Shots</Text>
                        <Text style={styles.statValue}>
                          {match.homeManager.uid === currentUser.uid ? match.homeShots : match.awayShots}
                          {' - '}
                          {match.homeManager.uid === currentUser.uid ? match.awayShots : match.homeShots}
                        </Text>
                      </View>
                    )}

                    {/* Shots on Target */}
                    {match.homeShotsOnTarget !== undefined && (
                      <View style={styles.statRow}>
                        <Text style={styles.statLabel}>On Target</Text>
                        <Text style={styles.statValue}>
                          {match.homeManager.uid === currentUser.uid ? match.homeShotsOnTarget : match.awayShotsOnTarget}
                          {' - '}
                          {match.homeManager.uid === currentUser.uid ? match.awayShotsOnTarget : match.homeShotsOnTarget}
                        </Text>
                      </View>
                    )}

                    {/* Squad Strength */}
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Squad Strength</Text>
                      <Text style={styles.statValue}>
                        {match.homeManager.uid === currentUser.uid ? match.homeStrength : match.awayStrength}
                        {' - '}
                        {match.homeManager.uid === currentUser.uid ? match.awayStrength : match.homeStrength}
                      </Text>
                    </View>

                    {/* Top Scorers */}
                    {match.topScorers && match.topScorers.length > 0 && (
                      <View style={styles.scorersSection}>
                        <Text style={styles.scorersTitle}>⚽ Goal Scorers</Text>
                        {match.topScorers.map((scorer, idx) => (
                          <Text key={idx} style={styles.scorerText}>
                            {scorer.name} ({scorer.goals})
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {match.matchReport && (
                  <View style={styles.matchReport}>
                    <Text style={styles.reportTitle}>📋 Match Analysis</Text>
                    <Text style={styles.reportText}>{match.matchReport}</Text>
                  </View>
                )}
              </View>
            );
          })
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
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
    paddingTop: 20,
    zIndex: 100,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
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
  },
  matchCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  matchDate: {
    fontSize: 12,
    color: '#888',
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  winnerText: {
    fontWeight: 'bold',
    color: '#43e97b',
  },
  teamScore: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  vs: {
    fontSize: 14,
    color: '#888',
    marginHorizontal: 15,
  },
  matchReport: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  reportText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
  },
  matchFooter: {
    borderTopWidth: 1,
    borderTopColor: '#2d3561',
    paddingTop: 10,
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  statsSection: {
    backgroundColor: '#141829',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  statValue: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  possessionBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#2d3561',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  possessionHome: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
    borderRadius: 10,
  },
  possessionText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
    zIndex: 1,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  scorersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d3561',
  },
  scorersTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  scorerText: {
    fontSize: 11,
    color: '#43e97b',
    marginLeft: 8,
    marginBottom: 4,
  },
});

export default MatchHistory;
