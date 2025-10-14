import { database } from '../firebase';
import { ref, get, update, remove } from 'firebase/database';
import { additionalPlayers } from '../data/additionalPlayers';

// Add 50 new players at a time
export const add50NewPlayers = async () => {
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

    // Find players that don't exist yet
    const availablePlayers = additionalPlayers.filter(
      player => !existingPlayerIds.includes(player.id)
    );

    if (availablePlayers.length === 0) {
      return {
        success: true,
        addedCount: 0,
        message: 'All players from the pool already exist in the market'
      };
    }

    // Take only 50 players
    const playersToAdd = availablePlayers.slice(0, 50);

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

// Remove duplicate players (keep highest rated)
export const removeDuplicatePlayers = async () => {
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
    const playersByName = {};

    // Group players by name
    Object.entries(marketData).forEach(([id, player]) => {
      const name = player.name;
      if (!playersByName[name]) {
        playersByName[name] = [];
      }
      playersByName[name].push({ id, ...player });
    });

    // Find duplicates and keep highest rated
    const playersToRemove = [];
    Object.entries(playersByName).forEach(([name, players]) => {
      if (players.length > 1) {
        // Sort by overall rating (highest first)
        players.sort((a, b) => b.overall - a.overall);
        // Remove all except the first (highest rated)
        for (let i = 1; i < players.length; i++) {
          playersToRemove.push(players[i].id);
        }
      }
    });

    if (playersToRemove.length === 0) {
      return {
        success: true,
        removedCount: 0,
        message: 'No duplicate players found'
      };
    }

    // Remove duplicates
    for (const playerId of playersToRemove) {
      await remove(ref(database, `market/${playerId}`));
    }

    return {
      success: true,
      removedCount: playersToRemove.length
    };
  } catch (error) {
    console.error('Remove duplicates error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Clear all pending matches for all users
export const clearAllPendingMatches = async () => {
  try {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'No managers found'
      };
    }

    const managers = snapshot.val();
    let clearedCount = 0;

    for (const uid in managers) {
      if (managers[uid].activeMatchId) {
        await update(ref(database, `managers/${uid}`), {
          activeMatchId: null
        });
        clearedCount++;
      }
    }

    return {
      success: true,
      clearedCount
    };
  } catch (error) {
    console.error('Clear matches error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Legacy function kept for compatibility
export const migrateMarketPlayers = async () => {
  return add50NewPlayers();
};
