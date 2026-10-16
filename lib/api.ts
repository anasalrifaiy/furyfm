import { supabase } from './supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

// Types
interface Team {
  id: string;
  name: string;
  rating: number;
  budget: number;
  user_id: string;
  created_at: string;
  formation?: string;
  logo_url?: string;
  profile_picture_url?: string;
}

interface Player {
  id: string;
  name: string;
  position: string | null;
  rating: number;
  age: number;
  value: number;
  team_id: string;
  created_at: string;
  nationality: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: Team;
  receiver?: Team;
}

interface TradeOffer {
  id: string;
  player_id: string;
  from_team_id: string;
  to_team_id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  counter_amount?: number;
  created_at: string;
  updated_at: string;
  player?: Player;
  from_team?: Team;
  to_team?: Team;
}

interface UpdatePlayerPositionParams {
  playerId: string;
  positionId: string | null;
  position: string | null;
}

const api = {
  // Teams
  async getMyTeam() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateTeam(teamId: string, updates: Partial<Team>) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async searchTeams(query: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .neq('user_id', user.id)
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return data;
  },

  // Friend Requests
  async getFriendRequests() {
    const { data: team } = await api.getMyTeam();
    if (!team) throw new Error('Team not found');

    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:sender_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        ),
        receiver:receiver_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        )
      `)
      .or(`sender_id.eq.${team.id},receiver_id.eq.${team.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async sendFriendRequest(receiverId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get sender's team
    const { data: senderTeam, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (teamError || !senderTeam) throw new Error('Team not found');

    // Check for existing requests in either direction
    const { data: existingRequests, error: checkError } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${senderTeam.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderTeam.id})`);

    if (checkError) throw checkError;

    // Check if already friends or request pending
    if (existingRequests && existingRequests.length > 0) {
      const existingRequest = existingRequests[0];
      if (existingRequest.status === 'accepted') {
        throw new Error('You are already friends with this team');
      }
      if (existingRequest.status === 'pending') {
        throw new Error(existingRequest.sender_id === senderTeam.id 
          ? 'You already sent a request to this team' 
          : 'This team already sent you a request');
      }
    }

    // Create new request
    const { data: newRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderTeam.id,
        receiver_id: receiverId,
        status: 'pending'
      })
      .select(`
        *,
        sender:sender_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        ),
        receiver:receiver_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        )
      `)
      .single();

    if (insertError) throw insertError;
    return newRequest;
  },

  async handleFriendRequest(requestId: string, accept: boolean) {
    const { data: updatedRequest, error } = await supabase
      .from('friend_requests')
      .update({ 
        status: accept ? 'accepted' : 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select(`
        *,
        sender:sender_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        ),
        receiver:receiver_id (
          id,
          name,
          rating,
          profile_picture_url,
          user_id
        )
      `)
      .single();

    if (error) throw error;
    return updatedRequest;
  },

  // Players
  async getTeamPlayers(teamId: string) {
    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        team:team_id (
          id,
          name,
          rating,
          formation,
          budget,
          logo_url,
          profile_picture_url,
          user_id
        )
      `)
      .eq('team_id', teamId)
      .order('rating', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getTeamById(teamId: string) {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        players:players (*)
      `)
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  },

  async updatePlayerPosition({ playerId, positionId, position }: UpdatePlayerPositionParams) {
    const { data, error } = await supabase
      .from('players')
      .update({ 
        position_id: positionId,
        position: position 
      })
      .eq('id', playerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateFormation(teamId: string, formation: string) {
    try {
      // Clear all positions when changing formation
      const { error: clearError } = await supabase
        .from('players')
        .update({ position: null })
        .eq('team_id', teamId);

      if (clearError) throw clearError;

      // Update the team's formation
      const { data, error } = await supabase
        .from('teams')
        .update({ formation })
        .eq('id', teamId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating formation:', error);
      throw error;
    }
  },

  async handleTransfer(playerId: string, toTeamId: string, amount: number) {
    const { error } = await supabase.rpc('handle_transfer', {
      p_player_id: playerId,
      p_to_team_id: toTeamId,
      p_amount: amount
    });

    if (error) throw error;
  },

  async sellPlayer(playerId: string) {
    const { data, error } = await supabase.rpc('sell_player', {
      p_player_id: playerId
    });

    if (error) throw error;
    return data; // Returns the amount received from the sale
  },

  async createTradeOffer(playerId: string, toTeamId: string, amount: number) {
    const { data, error } = await supabase.rpc('create_trade_offer', {
      p_player_id: playerId,
      p_to_team_id: toTeamId,
      p_amount: amount
    });

    if (error) throw error;
    return data;
  },

  async handleTradeOffer(offerId: string, accept: boolean, counterAmount?: number) {
    const { error } = await supabase.rpc('handle_trade_offer', {
      p_offer_id: offerId,
      p_accept: accept,
      p_counter_amount: counterAmount
    });

    if (error) throw error;
  },

  async getTradeOffers() {
    const { data, error } = await supabase
      .from('trade_offers')
      .select(`
        *,
        player:player_id (*),
        from_team:from_team_id (*),
        to_team:to_team_id (*)
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

// Hooks
export function useMyTeam() {
  return useQuery({
    queryKey: ['myTeam'],
    queryFn: () => api.getMyTeam(),
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.getTeamById(teamId!),
    enabled: !!teamId,
  });
}

export function useTeamPlayers(teamId: string | undefined) {
  return useQuery({
    queryKey: ['teamPlayers', teamId],
    queryFn: () => api.getTeamPlayers(teamId!),
    enabled: !!teamId,
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ teamId, updates }: { teamId: string, updates: Partial<Team> }) =>
      api.updateTeam(teamId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
    },
  });
}

export function useSearchTeams() {
  return useMutation({
    mutationFn: (query: string) => api.searchTeams(query),
  });
}

export function useFriendRequests() {
  const queryClient = useQueryClient();
  
  return useQuery<FriendRequest[], Error>({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const data = await api.getFriendRequests();
      // Pre-cache team data for each request
      data.forEach((request: FriendRequest) => {
        if (request.sender) {
          queryClient.setQueryData(['team', request.sender.id], request.sender);
        }
        if (request.receiver) {
          queryClient.setQueryData(['team', request.receiver.id], request.receiver);
        }
      });
      return data;
    }
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation<FriendRequest, Error, string>({
    mutationFn: (receiverId: string) => api.sendFriendRequest(receiverId),
    onSuccess: (newRequest) => {
      // Optimistically update the UI
      queryClient.setQueryData<FriendRequest[]>(['friendRequests'], (old) => 
        old ? [newRequest, ...old] : [newRequest]
      );
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    }
  });
}

export function useHandleFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation<FriendRequest, Error, { requestId: string; accept: boolean }>({
    mutationFn: ({ requestId, accept }) => api.handleFriendRequest(requestId, accept),
    onMutate: async ({ requestId, accept }) => {
      await queryClient.cancelQueries({ queryKey: ['friendRequests'] });
      const previousRequests = queryClient.getQueryData<FriendRequest[]>(['friendRequests']);
      
      queryClient.setQueryData<FriendRequest[]>(['friendRequests'], (old) =>
        old?.map(request => 
          request.id === requestId 
            ? { ...request, status: accept ? 'accepted' : 'rejected' }
            : request
        )
      );
      
      return { previousRequests };
    },
    onError: (err, variables, context) => {
      const typedContext = context as { previousRequests?: FriendRequest[] } | undefined;
      if (typedContext?.previousRequests) {
        queryClient.setQueryData(['friendRequests'], typedContext.previousRequests);
      }
      Alert.alert('Error', 'Failed to process friend request');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    }
  });
}

export function useUpdatePlayerPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: UpdatePlayerPositionParams) => api.updatePlayerPosition(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
    },
  });
}

export function useUpdateFormation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ teamId, formation }: { teamId: string; formation: string }) =>
      api.updateFormation(teamId, formation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
    },
  });
}

export function useHandleTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ playerId, toTeamId, amount }: { playerId: string; toTeamId: string; amount: number }) =>
      api.handleTransfer(playerId, toTeamId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
    },
  });
}

export function useSellPlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (playerId: string) => api.sellPlayer(playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
    },
  });
}

export function useTradeOffers() {
  return useQuery({
    queryKey: ['tradeOffers'],
    queryFn: () => api.getTradeOffers(),
    refetchInterval: 5000, // Refetch every 5 seconds to check for new offers
  });
}

export function useCreateTradeOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ playerId, toTeamId, amount }: { playerId: string; toTeamId: string; amount: number }) =>
      api.createTradeOffer(playerId, toTeamId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradeOffers'] });
    },
  });
}

export function useHandleTradeOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ offerId, accept, counterAmount }: { offerId: string; accept: boolean; counterAmount?: number }) =>
      api.handleTradeOffer(offerId, accept, counterAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradeOffers'] });
      queryClient.invalidateQueries({ queryKey: ['teamPlayers'] });
      queryClient.invalidateQueries({ queryKey: ['myTeam'] });
    },
  });
}