import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, remove, push, set, onValue } from 'firebase/database';
import { showAlert } from '../utils/alert';

const Notifications = ({ onBack, onViewProfile, onViewOffer, onAcceptMatchChallenge }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    const notificationsRef = ref(database, `managers/${currentUser.uid}/notifications`);

    // Set up real-time listener
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
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
      } else {
        setNotifications([]);
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [currentUser]);

  // Mark all notifications as read when screen opens
  useEffect(() => {
    if (!currentUser || notifications.length === 0) return;

    const markAllAsRead = async () => {
      const updates = {};
      notifications.forEach(notification => {
        if (!notification.read) {
          updates[`managers/${currentUser.uid}/notifications/${notification.id}/read`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    };

    // Mark all as read after a short delay to allow the user to see the screen
    const timer = setTimeout(markAllAsRead, 500);
    return () => clearTimeout(timer);
  }, [currentUser, notifications.length]);

  const markAsRead = async (notificationId) => {
    const notifRef = ref(database, `managers/${currentUser.uid}/notifications/${notificationId}`);
    await update(notifRef, { read: true });
  };

  const deleteNotification = async (notificationId) => {
    const notifRef = ref(database, `managers/${currentUser.uid}/notifications/${notificationId}`);
    await remove(notifRef);
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
      case 'match_challenge':
        return '⚽';
      case 'match_finished':
        return '🏆';
      case 'loan_request':
        return '🏦';
      default:
        return '🔔';
    }
  };

  const acceptMatchChallenge = async (notification) => {
    const matchRef = ref(database, `matches/${notification.matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
      showAlert('Error', 'Match not found.');
      await deleteNotification(notification.id);
      return;
    }

    // Delete notification first
    await deleteNotification(notification.id);

    // Trigger callback to open match screen - the Match component will handle accepting
    if (onAcceptMatchChallenge) {
      onAcceptMatchChallenge(notification.matchId);
    }
  };

  const rejectMatchChallenge = async (notification) => {
    // Delete the match from database
    await remove(ref(database, `matches/${notification.matchId}`));

    // Notify challenger
    await push(ref(database, `managers/${notification.from}/notifications`), {
      type: 'match_rejected',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} declined your match challenge.`,
      timestamp: Date.now(),
      read: false
    });

    await deleteNotification(notification.id);
    showAlert('Declined', 'Match challenge declined.');
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

    // Delete the request notification and reload
    await deleteNotification(notification.id);
    showAlert('Success', 'Friend request accepted!');
  };

  const rejectFriendRequest = async (notification) => {
    await deleteNotification(notification.id);
    showAlert('Rejected', 'Friend request rejected.');
  };

  const acceptTradeOffer = async (notification) => {
    // Load the trade offer
    const offerRef = ref(database, `tradeOffers/${notification.offerId}`);
    const offerSnapshot = await get(offerRef);

    if (!offerSnapshot.exists()) {
      showAlert('Error', 'This trade offer no longer exists.');
      await deleteNotification(notification.id);
      return;
    }

    const offer = offerSnapshot.val();

    // Transfer player from my squad to buyer
    const mySquad = managerProfile.squad || [];
    const playerToSell = mySquad.find(p => p.id === offer.player.id);

    if (!playerToSell) {
      showAlert('Error', 'You no longer own this player.');
      await deleteNotification(notification.id);
      return;
    }

    // Remove player from my squad
    const newMySquad = mySquad.filter(p => p.id !== offer.player.id);
    const newMyBudget = (managerProfile.budget || 0) + offer.offerAmount;

    await updateManagerProfile({
      squad: newMySquad,
      budget: newMyBudget
    });

    // Add player to buyer's squad
    const buyerRef = ref(database, `managers/${offer.from}`);
    const buyerSnapshot = await get(buyerRef);

    if (buyerSnapshot.exists()) {
      const buyerData = buyerSnapshot.val();
      const buyerSquad = buyerData.squad || [];
      const newBuyerSquad = [...buyerSquad, playerToSell];
      const newBuyerBudget = (buyerData.budget || 0) - offer.offerAmount;

      await update(buyerRef, {
        squad: newBuyerSquad,
        budget: newBuyerBudget
      });

      // Send notification to buyer
      const buyerNotifRef = ref(database, `managers/${offer.from}/notifications`);
      await push(buyerNotifRef, {
        type: 'trade_accepted',
        from: currentUser.uid,
        fromName: managerProfile.managerName,
        message: `${managerProfile.managerName} accepted your offer for ${playerToSell.name}!`,
        timestamp: Date.now(),
        read: false
      });
    }

    // Update offer status
    await update(offerRef, { status: 'accepted' });

    // Delete notification
    await deleteNotification(notification.id);
    showAlert('Success', `Trade completed! You sold ${playerToSell.name} for $${(offer.offerAmount / 1000000).toFixed(1)}M`);
  };

  const rejectTradeOffer = async (notification) => {
    // Update offer status
    const offerRef = ref(database, `tradeOffers/${notification.offerId}`);
    const offerSnapshot = await get(offerRef);

    if (offerSnapshot.exists()) {
      const offer = offerSnapshot.val();
      await update(offerRef, { status: 'rejected' });

      // Send notification to buyer
      const buyerNotifRef = ref(database, `managers/${offer.from}/notifications`);
      await push(buyerNotifRef, {
        type: 'trade_rejected',
        from: currentUser.uid,
        fromName: managerProfile.managerName,
        message: `${managerProfile.managerName} rejected your offer for ${offer.player.name}`,
        timestamp: Date.now(),
        read: false
      });
    }

    await deleteNotification(notification.id);
    showAlert('Rejected', 'Trade offer rejected.');
  };

  const acceptLoanRequest = async (notification) => {
    // Load the loan from database
    const loanRef = ref(database, `loans/${notification.loanId}`);
    const loanSnapshot = await get(loanRef);

    if (!loanSnapshot.exists()) {
      showAlert('Error', 'Loan request not found.');
      await deleteNotification(notification.id);
      return;
    }

    const loan = loanSnapshot.val();

    // Check if I still have enough budget
    if (managerProfile.budget < loan.amount) {
      showAlert('Insufficient Funds', 'You no longer have enough budget to lend this amount.');
      await deleteNotification(notification.id);
      return;
    }

    // Deduct from my budget
    await updateManagerProfile({
      budget: managerProfile.budget - loan.amount
    });

    // Add to borrower's budget
    const borrowerRef = ref(database, `managers/${notification.fromId}`);
    const borrowerSnapshot = await get(borrowerRef);
    if (borrowerSnapshot.exists()) {
      const borrower = borrowerSnapshot.val();
      await update(borrowerRef, {
        budget: borrower.budget + loan.amount
      });
    }

    // Update loan status to active
    await update(loanRef, { status: 'active' });

    // Send notification to borrower
    await push(ref(database, `managers/${notification.fromId}/notifications`), {
      type: 'loan_approved',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} approved your loan request for $${(loan.amount / 1000000).toFixed(1)}M!`,
      timestamp: Date.now(),
      read: false
    });

    await deleteNotification(notification.id);
    showAlert('Success', `Loan approved! $${(loan.amount / 1000000).toFixed(1)}M sent to ${notification.from}`);
  };

  const rejectLoanRequest = async (notification) => {
    // Delete the loan from database
    await remove(ref(database, `loans/${notification.loanId}`));

    // Send notification to borrower
    await push(ref(database, `managers/${notification.fromId}/notifications`), {
      type: 'loan_rejected',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      message: `${managerProfile.managerName} declined your loan request.`,
      timestamp: Date.now(),
      read: false
    });

    await deleteNotification(notification.id);
    showAlert('Rejected', 'Loan request rejected.');
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

                {notification.type === 'trade_offer' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => acceptTradeOffer(notification)}
                    >
                      <Text style={styles.acceptButtonText}>Accept Offer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => rejectTradeOffer(notification)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {notification.type === 'match_challenge' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => acceptMatchChallenge(notification)}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => rejectMatchChallenge(notification)}
                    >
                      <Text style={styles.rejectButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {notification.type === 'match_finished' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => deleteNotification(notification.id)}
                    >
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {notification.type === 'loan_request' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => acceptLoanRequest(notification)}
                    >
                      <Text style={styles.acceptButtonText}>Approve Loan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => rejectLoanRequest(notification)}
                    >
                      <Text style={styles.rejectButtonText}>Decline</Text>
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
  dismissButton: {
    flex: 1,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default Notifications;
