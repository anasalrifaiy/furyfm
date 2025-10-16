// Recovery utility to restore missing players to manager squads
// This should be run ONCE to recover squads after the bug

import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';

// This function will try to recover squads by looking at match history
export async function recoverAllSquads() {
  console.log('Starting squad recovery process...');

  try {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'No managers found' };
    }

    const managers = snapshot.val();
    let recoveredCount = 0;
    const recoveryDetails = [];

    for (const uid in managers) {
      const manager = managers[uid];
      const currentSquad = manager.squad || [];

      console.log(`\nChecking ${manager.managerName || manager.email}...`);
      console.log(`Current squad size: ${currentSquad.length}`);

      // If squad is less than expected, try to recover from match history
      if (currentSquad.length < 15) {
        // Get all unique players from match history
        const matchHistoryRef = ref(database, `managers/${uid}/matchHistory`);
        const historySnapshot = await get(matchHistoryRef);

        const allPlayerIds = new Set(currentSquad.map(p => p.id));
        const recoveredPlayers = [...currentSquad];

        if (historySnapshot.exists()) {
          const matchHistory = historySnapshot.val();

          // Go through each match in history
          Object.values(matchHistory).forEach(match => {
            // Check if this manager was home or away
            const wasHome = match.homeManager?.uid === uid;
            const squadInMatch = wasHome
              ? (match.homeManager?.squad || [])
              : (match.awayManager?.squad || []);

            // Add any players not in current squad
            squadInMatch.forEach(player => {
              if (!allPlayerIds.has(player.id)) {
                allPlayerIds.add(player.id);
                recoveredPlayers.push(player);
                console.log(`  Recovered: ${player.name} (${player.position}, ${player.overall})`);
              }
            });
          });
        }

        // Update if we found missing players
        if (recoveredPlayers.length > currentSquad.length) {
          await update(ref(database, `managers/${uid}`), {
            squad: recoveredPlayers
          });

          const recovered = recoveredPlayers.length - currentSquad.length;
          console.log(`✓ Recovered ${recovered} players for ${manager.managerName}`);
          console.log(`  Squad size: ${currentSquad.length} → ${recoveredPlayers.length}`);

          recoveredCount++;
          recoveryDetails.push({
            manager: manager.managerName || manager.email,
            before: currentSquad.length,
            after: recoveredPlayers.length,
            recovered: recovered
          });
        } else {
          console.log(`  No recovery needed (${currentSquad.length} players)`);
        }
      } else {
        console.log(`  Squad looks good (${currentSquad.length} players)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Recovery complete!');
    console.log(`Recovered squads for ${recoveredCount} manager(s)`);
    console.log('='.repeat(50));

    return {
      success: true,
      recoveredCount,
      details: recoveryDetails
    };
  } catch (error) {
    console.error('Error during recovery:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// For browser console usage
if (typeof window !== 'undefined') {
  window.recoverAllSquads = recoverAllSquads;
}
