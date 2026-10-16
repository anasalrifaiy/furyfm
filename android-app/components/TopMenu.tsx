import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Image, ActivityIndicator, Alert } from 'react-native';
import { Bell, Check, X } from 'lucide-react-native';
import { useFriendRequests } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useMyTeam } from '@/lib/api';

export default function TopMenu() {
  const [showNotifications, setShowNotifications] = useState(false);
  const { data: friendRequests = [], isLoading, refetch } = useFriendRequests();
  const { data: myTeam } = useMyTeam();
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Only show pending requests where the user is the receiver
  const pendingRequests = friendRequests.filter(r => 
    r.status === 'pending' && r.receiver_id === myTeam?.id
  );

  // Set up periodic refetching
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000); // Refetch every 5 seconds
    
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRequest = async (requestId: string, accept: boolean) => {
    try {
      setProcessingRequestId(requestId);
      
      // Direct database call to ensure it works
      const { error } = await supabase
        .from('friend_requests')
        .update({ 
          status: accept ? 'accepted' : 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      await refetch();
      
      if (pendingRequests.length <= 1) {
        setShowNotifications(false);
      }
      
      Alert.alert('Success', accept ? 'Friend request accepted!' : 'Friend request rejected');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to handle friend request');
      console.error('Error handling friend request:', error);
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={() => setShowNotifications(true)}
      >
        <Bell size={24} color="#333" />
        {pendingRequests.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingRequests.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showNotifications}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notifications</Text>

            {isLoading ? (
              <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
            ) : pendingRequests.length === 0 ? (
              <Text style={styles.noNotifications}>No new notifications</Text>
            ) : (
              pendingRequests.map(request => (
                <View key={request.id} style={styles.requestItem}>
                  <Image 
                    source={{ uri: request.sender?.profile_picture_url }}
                    style={styles.requestImage}
                  />
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestText}>
                      {request.sender?.name} wants to be your friend
                    </Text>
                    <View style={styles.requestButtons}>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.acceptButton]}
                        onPress={() => handleRequest(request.id, true)}
                        disabled={processingRequestId === request.id}
                      >
                        {processingRequestId === request.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Check size={16} color="#fff" />
                            <Text style={styles.buttonText}>Accept</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.rejectButton]}
                        onPress={() => handleRequest(request.id, false)}
                        disabled={processingRequestId === request.id}
                      >
                        <X size={16} color="#fff" />
                        <Text style={styles.buttonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowNotifications(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 15,
    zIndex: 1000,
  },
  notificationButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginTop: 60,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  noNotifications: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginVertical: 20,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  requestImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 10,
  },
  requestText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 8,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 4,
  },
  closeButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
});
