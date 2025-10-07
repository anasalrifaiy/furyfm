import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, remove, push } from 'firebase/database';
import { showAlert } from '../utils/alert';

const Notifications = ({ onBack, onViewProfile, onViewOffer }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!currentUser) return;

    const notificationsRef = ref(database, `managers/${currentUser.uid}/notifications`);
    const snapshot = await get(notificationsRef);

    if (snapshot.exists()) {
      const notifData = [];
      snapshot.forEach(childSnapshot => {
        notifData.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });

      // Sort by timestamp, newest first
      notifData.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(notifData);
    }
  };

  const markAsRead = async (notificationId) => {
    const notifRef = ref(database, `managers/${currentUser.uid}/notifications/${notificationId}`);
    await update(notifRef, { read: true });
    loadNotifications();
  };

  const deleteNotification = async (notificationId) => {
    const notifRef = ref(database, `managers/${currentUser.uid}/notifications/${notificationId}`);
    await remove(notifRef);
    loadNotifications();
  };

  const clearAll = async () => {
    showAlert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const notificationsRef = ref(database, `managers/${currentUser.uid}/notifications`);
            await remove(notificationsRef);
            setNotifications([]);
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return '👥';
      case 'trade_offer':
        return '💰';
      case 'trade_accepted':
        return '✅';
      case 'trade_rejected':
        return '❌';
      case 'trade_counter':
        return '🔄';
      default:
        return '🔔';
    }
  };

  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const acceptFriendRequest = async (notification) => {
    // Add friend to both users
    const currentFriends = managerProfile.friends || [];
    const newFriends = [...currentFriends, notification.from];
    await updateManagerProfile({ friends: newFriends });

    // Add me to their friends list
    const friendRef = ref(database, `managers/${notification.from}`);
    const friendSnapshot = await get(friendRef);
    if (friendSnapshot.exists()) {
      const friendData = friendSnapshot.val();
      const theirFriends = friendData.friends || [];
      await update(friendRef, { friends: [...theirFriends, currentUser.uid] });
    }

    // Send notification to them
    const notificationRef = ref(database, `managers/${notification.from}/notifications`);
    await push(notificationRef, {
      type: 'friend_accepted',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} accepted your friend request!`,
      timestamp: Date.now(),
      read: false
    });

    // Delete the request notification
    await deleteNotification(notification.id);
    showAlert('Success', 'Friend request accepted!');
  };

  const rejectFriendRequest = async (notification) => {
    await deleteNotification(notification.id);
    showAlert('Rejected', 'Friend request rejected.');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {notifications.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyDesc}>
              You'll see notifications here when managers add you as a friend or send trade offers.
            </Text>
          </View>
        ) : (
          notifications.map(notification => (
            <View
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.notificationUnread
              ]}
            >
              <View style={styles.notificationIcon}>
                <Text style={styles.iconText}>{getNotificationIcon(notification.type)}</Text>
              </View>

              <View style={styles.notificationContent}>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>{formatTime(notification.timestamp)}</Text>

                {notification.type === 'friend_request' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => acceptFriendRequest(notification)}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => rejectFriendRequest(notification)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteNotification(notification.id)}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
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
    zIndex: 100,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
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
    flex: 1,
  },
  badge: {
    backgroundColor: '#f5576c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    padding: 15,
    alignItems: 'flex-end',
  },
  clearButton: {
    backgroundColor: '#2d3561',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  notificationCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  notificationUnread: {
    borderColor: '#667eea',
    backgroundColor: '#1e2444',
  },
  notificationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#252b54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  iconText: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 5,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#888',
    fontSize: 20,
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
  actionButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  acceptButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginRight: 10,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: '#2d3561',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default Notifications;
