import { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { X, DollarSign, Send } from 'lucide-react-native';
import { useCreateTradeOffer } from '@/lib/api';

interface PlayerTradeModalProps {
  visible: boolean;
  onClose: () => void;
  player: any;
  toTeamId: string;
  toTeamName: string;
}

export default function PlayerTradeModal({
  visible,
  onClose,
  player,
  toTeamId,
  toTeamName,
}: PlayerTradeModalProps) {
  const [amount, setAmount] = useState('');
  const createTradeOffer = useCreateTradeOffer();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || isNaN(parseInt(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      await createTradeOffer.mutateAsync({
        playerId: player.id,
        toTeamId,
        amount: parseInt(amount) * 1000000 // Convert M to actual value
      });
      Alert.alert('Success', 'Trade offer sent successfully!');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send trade offer');
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: string | null) => {
    if (!position) return '#808080';
    if (position === 'GK') return '#FFD700';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return '#4169E1';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return '#32CD32';
    if (['ST', 'CF', 'LW', 'RW'].includes(position)) return '#FF4444';
    return '#808080';
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Trade Offer</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.playerCard}>
            <View style={[styles.positionBadge, { backgroundColor: getPositionColor(player?.position) }]}>
              <Text style={styles.positionText}>{player?.position || 'N/A'}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player?.name}</Text>
              <Text style={styles.playerDetails}>
                Rating: {player?.rating} • Age: {player?.age}
              </Text>
              <Text style={styles.playerValue}>
                Market Value: ${(player?.value / 1000000).toFixed(1)}M
              </Text>
            </View>
          </View>

          <View style={styles.teamInfo}>
            <Text style={styles.teamInfoLabel}>Offering to:</Text>
            <View style={styles.teamDetails}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200' }}
                style={styles.teamLogo}
              />
              <Text style={styles.teamName}>{toTeamName}</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your Asking Price (M)</Text>
            <View style={styles.inputWrapper}>
              <DollarSign size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount in millions"
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
            </View>
            <Text style={styles.hint}>
              Suggested value: ${(player?.value / 1000000).toFixed(1)}M
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Send size={20} color="#fff" />
            <Text style={styles.submitButtonText}>
              {loading ? 'Sending...' : 'Send Offer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    color: '#333',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  positionBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  positionText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    marginBottom: 4,
  },
  playerDetails: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    fontSize: 14,
    marginBottom: 2,
  },
  playerValue: {
    fontFamily: 'Inter_600SemiBold',
    color: '#4CAF50',
    fontSize: 14,
  },
  teamInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  teamInfoLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  teamDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  teamName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    fontSize: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});