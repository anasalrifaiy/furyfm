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

        // Sort by date, newest first
        historyData.sort((a, b) => b.date - a.date);
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
          matches.map(match => (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
                <View style={[styles.resultBadge, { backgroundColor: getResultColor(match.result) }]}>
                  <Text style={styles.resultText}>{match.result}</Text>
                </View>
              </View>

              <View style={styles.matchDetails}>
                <View style={styles.teamSection}>
                  <Text style={[styles.teamName, match.result === 'WIN' && styles.winnerText]}>
                    {managerProfile?.managerName || 'You'}
                  </Text>
                  <Text style={styles.teamScore}>{match.myScore}</Text>
                </View>

                <Text style={styles.vs}>VS</Text>

                <View style={styles.teamSection}>
                  <Text style={styles.teamScore}>{match.opponentScore}</Text>
                  <Text style={[styles.teamName, match.result === 'LOSS' && styles.winnerText]}>
                    {match.opponentName}
                  </Text>
                </View>
              </View>

              {match.topScorer && (
                <View style={styles.matchFooter}>
                  <Text style={styles.footerText}>⚽ Top Scorer: {match.topScorer}</Text>
                </View>
              )}
            </View>
          ))
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
  matchFooter: {
    borderTopWidth: 1,
    borderTopColor: '#2d3561',
    paddingTop: 10,
    marginTop: 5,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

export default MatchHistory;
