import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, push } from 'firebase/database';

const Friends = ({ onBack, onViewProfile }) => {
  const { currentUser, managerProfile, updateManagerProfile, loading } = useAuth();
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' or 'search'

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

  const searchManagers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (snapshot.exists()) {
      const managers = [];
      snapshot.forEach(childSnapshot => {
        const manager = childSnapshot.val();
        if (
          manager.uid !== currentUser.uid &&
          manager.managerName.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          managers.push({ uid: childSnapshot.key, ...manager });
        }
      });
      setSearchResults(managers);
    }
  };

  useEffect(() => {
    if (activeTab === 'search') {
      searchManagers();
    }
  }, [searchQuery, activeTab]);

  const addFriend = async (friendId) => {
    const currentFriends = managerProfile.friends || [];

    if (currentFriends.includes(friendId)) {
      showAlert('Already Friends', 'This manager is already in your friends list.');
      return;
    }

    const newFriends = [...currentFriends, friendId];
    await updateManagerProfile({ friends: newFriends });

    // Send notification to friend
    const notificationRef = ref(database, `managers/${friendId}/notifications`);
    await push(notificationRef, {
      type: 'friend_request',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} added you as a friend!`,
      timestamp: Date.now(),
      read: false
    });

    showAlert('Success', 'Friend added!');
    loadFriends();
  };

  const removeFriend = async (friendId) => {
    showAlert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const newFriends = managerProfile.friends.filter(id => id !== friendId);
            await updateManagerProfile({ friends: newFriends });
            loadFriends();
          }
        }
      ]
    );
  };

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Friends</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const FriendCard = ({ manager, isSearchResult = false }) => (
    <View style={styles.friendCard}>
      <TouchableOpacity
        style={styles.friendInfo}
        onPress={() => onViewProfile(manager.uid)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{manager.managerName.charAt(0)}</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{manager.managerName}</Text>
          <Text style={styles.friendStats}>
            Squad: {manager.squad?.length || 0} • Points: {manager.points || 0}
          </Text>
        </View>
      </TouchableOpacity>

      {isSearchResult ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => addFriend(manager.uid)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFriend(manager.uid)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            My Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search Managers
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'search' && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by manager name..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <ScrollView style={styles.content}>
        {activeTab === 'friends' ? (
          friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Friends Yet</Text>
              <Text style={styles.emptyDesc}>
                Search for managers and add them as friends to trade players and compete!
              </Text>
            </View>
          ) : (
            friends.map(friend => (
              <FriendCard key={friend.uid} manager={friend} />
            ))
          )
        ) : (
          searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Results' : 'Start Searching'}
              </Text>
              <Text style={styles.emptyDesc}>
                {searchQuery
                  ? 'No managers found with that name.'
                  : 'Enter a manager name to search.'}
              </Text>
            </View>
          ) : (
            searchResults.map(manager => (
              <FriendCard key={manager.uid} manager={manager} isSearchResult />
            ))
          )
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    padding: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  searchSection: {
    padding: 15,
  },
  searchInput: {
    backgroundColor: '#1a1f3a',
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  friendCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  addButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  removeButton: {
    backgroundColor: '#f5576c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  removeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
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
});

export default Friends;
