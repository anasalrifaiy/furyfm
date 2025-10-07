import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

const Leaderboard = ({ onBack, onViewProfile }) => {
  const { currentUser } = useAuth();
  const [managers, setManagers] = useState([]);
  const [sortBy, setSortBy] = useState('points'); // 'points', 'squadValue', 'wins'

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy]);

  const loadLeaderboard = async () => {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (snapshot.exists()) {
      const managersData = [];
      snapshot.forEach(childSnapshot => {
        const manager = childSnapshot.val();
        const squadValue = (manager.squad || []).reduce((sum, player) => sum + player.price, 0);
        managersData.push({
          uid: childSnapshot.key,
          ...manager,
          squadValue
        });
      });

      // Sort based on selected criteria
      const sorted = managersData.sort((a, b) => {
        switch (sortBy) {
          case 'points':
            return (b.points || 0) - (a.points || 0);
          case 'squadValue':
            return (b.squadValue || 0) - (a.squadValue || 0);
          case 'wins':
            return (b.wins || 0) - (a.wins || 0);
          default:
            return 0;
        }
      });

      setManagers(sorted);
    }
  };

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const getRankColor = (index) => {
    if (index === 0) return '#FFD700'; // Gold
    if (index === 1) return '#C0C0C0'; // Silver
    if (index === 2) return '#CD7F32'; // Bronze
    return '#667eea';
  };

  const getRankIcon = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortOptions}>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'points' && styles.sortChipActive]}
            onPress={() => setSortBy('points')}
          >
            <Text style={[styles.sortText, sortBy === 'points' && styles.sortTextActive]}>
              Points
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'squadValue' && styles.sortChipActive]}
            onPress={() => setSortBy('squadValue')}
          >
            <Text style={[styles.sortText, sortBy === 'squadValue' && styles.sortTextActive]}>
              Squad Value
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'wins' && styles.sortChipActive]}
            onPress={() => setSortBy('wins')}
          >
            <Text style={[styles.sortText, sortBy === 'wins' && styles.sortTextActive]}>
              Wins
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        {managers.map((manager, index) => {
          const isCurrentUser = manager.uid === currentUser?.uid;

          return (
            <TouchableOpacity
              key={manager.uid}
              style={[
                styles.managerCard,
                isCurrentUser && styles.managerCardHighlight
              ]}
              onPress={() => onViewProfile(manager.uid)}
            >
              <View style={styles.rank}>
                <Text style={[styles.rankText, { color: getRankColor(index) }]}>
                  {getRankIcon(index)}
                </Text>
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{manager.managerName.charAt(0)}</Text>
              </View>

              <View style={styles.managerInfo}>
                <Text style={styles.managerName}>
                  {manager.managerName}
                  {isCurrentUser && <Text style={styles.youBadge}> (You)</Text>}
                </Text>
                <Text style={styles.managerStats}>
                  {sortBy === 'points' && `${manager.points || 0} points`}
                  {sortBy === 'squadValue' && formatCurrency(manager.squadValue || 0)}
                  {sortBy === 'wins' && `${manager.wins || 0} wins`}
                </Text>
                <Text style={styles.managerDetails}>
                  Squad: {manager.squad?.length || 0} • W:{manager.wins || 0} D:{manager.draws || 0} L:{manager.losses || 0}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => onViewProfile(manager.uid)}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
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
    zIndex: 100,
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
  sortSection: {
    padding: 15,
  },
  sortLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },
  sortOptions: {
    flexDirection: 'row',
  },
  sortChip: {
    backgroundColor: '#1a1f3a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  sortChipActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderColor: '#667eea',
  },
  sortText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sortTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 15,
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
  managerCardHighlight: {
    borderColor: '#43e97b',
    borderWidth: 2,
    backgroundColor: '#1e2444',
  },
  rank: {
    width: 40,
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 20,
    fontWeight: 'bold',
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
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  youBadge: {
    color: '#43e97b',
    fontSize: 14,
  },
  managerStats: {
    fontSize: 15,
    color: '#667eea',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  managerDetails: {
    fontSize: 12,
    color: '#888',
  },
  viewButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default Leaderboard;
