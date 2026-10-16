import { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Image, Alert } from 'react-native';
import { X, UserPlus, Check, Link } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCreateTradeOffer } from '@/lib/api';

interface TeamDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  team: any;
  isFriend: boolean;
  isPending: boolean;
  onSendFriendRequest: () => Promise<void>;
}

export default function TeamDetailsModal({
  visible,
  onClose,
  team,
  isFriend,
  isPending,
  onSendFriendRequest
}: TeamDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const createTradeOffer = useCreateTradeOffer();

  const handleFriendRequest = async () => {
    if (loading || isPending || isFriend) return;
    
    try {
      setLoading(true);
      await onSendFriendRequest();
      Alert.alert('Success', 'Friend request sent successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSquad = () => {
    // Navigate to the squad screen with the team ID
    router.push(`/squad?teamId=${team?.id}`);
    // Don't close the modal - let the user use the back button to return
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{team?.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.teamStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statValue}>{team?.rating}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Formation</Text>
              <Text style={styles.statValue}>{team?.formation}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isPending && styles.actionButtonPending,
                isFriend && styles.actionButtonActive
              ]}
              onPress={handleFriendRequest}
              disabled={loading || isPending || isFriend}
            >
              {isFriend ? (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Friends</Text>
                </>
              ) : isPending ? (
                <>
                  <UserPlus size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Request Pending</Text>
                </>
              ) : (
                <>
                  <UserPlus size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Add Friend</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleViewSquad}
            >
              <Link size={20} color="#fff" />
              <Text style={styles.actionButtonText}>View Squad</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  teamStats: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    fontSize: 14,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: 4,
  },
  actions: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonPending: {
    backgroundColor: '#FFA726',
  },
  actionButtonActive: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});