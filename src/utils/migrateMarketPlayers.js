import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { additionalPlayers } from '../data/additionalPlayers';

export const migrateMarketPlayers = async () => {
  try {
    const marketRef = ref(database, 'market');
    const snapshot = await get(marketRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'Market data not found'
      };
    }

    const marketData = snapshot.val();
    const existingPlayerIds = Object.keys(marketData).map(id => parseInt(id));

    // Find players that need to be added (IDs 201-400 that don't exist yet)
    const playersToAdd = additionalPlayers.filter(
      player => !existingPlayerIds.includes(player.id)
    );

    if (playersToAdd.length === 0) {
      return {
        success: true,
        addedCount: 0,
        message: 'All players already exist in the market'
      };
    }

    // Add the new players to the market
    const updates = {};
    playersToAdd.forEach(player => {
      updates[`market/${player.id}`] = player;
    });

    await update(ref(database), updates);

    return {
      success: true,
      addedCount: playersToAdd.length,
      playerIds: playersToAdd.map(p => p.id)
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
