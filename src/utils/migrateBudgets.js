// Migration utility to update existing users' budgets to 900M
// This can be called from the browser console or a temporary admin page

import { database } from '../firebase';
import { ref, get, update } from 'firebase/database';

const TARGET_BUDGET = 900000000; // 900M

export async function migrateBudgetsToTarget() {
  console.log('Starting budget migration...');
  console.log(`Target budget: $${TARGET_BUDGET / 1000000}M\n`);

  try {
    // Get all managers
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      console.log('No managers found in database.');
      return { success: false, message: 'No managers found' };
    }

    const managers = snapshot.val();
    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    for (const uid in managers) {
      const manager = managers[uid];
      const currentBudget = manager.budget || 0;

      if (currentBudget < TARGET_BUDGET) {
        const additionalBudget = TARGET_BUDGET - currentBudget;
        const newBudget = TARGET_BUDGET;

        updates.push({
          uid,
          name: manager.managerName || manager.email,
          oldBudget: currentBudget,
          additionalBudget,
          newBudget
        });

        // Update the manager's budget
        await update(ref(database, `managers/${uid}`), {
          budget: newBudget
        });

        console.log(`✓ Updated ${manager.managerName || manager.email}`);
        console.log(`  Old budget: $${(currentBudget / 1000000).toFixed(1)}M`);
        console.log(`  Added: $${(additionalBudget / 1000000).toFixed(1)}M`);
        console.log(`  New budget: $${(newBudget / 1000000).toFixed(1)}M\n`);

        updatedCount++;
      } else {
        console.log(`⊘ Skipped ${manager.managerName || manager.email} (already has $${(currentBudget / 1000000).toFixed(1)}M)\n`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Migration complete!');
    console.log(`Updated: ${updatedCount} managers`);
    console.log(`Skipped: ${skippedCount} managers`);
    console.log('='.repeat(50));

    return {
      success: true,
      updatedCount,
      skippedCount,
      updates
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add custom amount to all users' budgets
export async function addBudgetToAllUsers(amount) {
  console.log(`Adding $${amount / 1000000}M to all users' budgets...`);

  try {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'No managers found' };
    }

    const managers = snapshot.val();
    let updatedCount = 0;
    const updates = [];

    for (const uid in managers) {
      const manager = managers[uid];
      const currentBudget = manager.budget || 0;
      const newBudget = currentBudget + amount;

      updates.push({
        uid,
        name: manager.managerName || manager.email,
        oldBudget: currentBudget,
        additionalBudget: amount,
        newBudget
      });

      await update(ref(database, `managers/${uid}`), {
        budget: newBudget
      });

      console.log(`✓ Updated ${manager.managerName || manager.email}`);
      console.log(`  Old budget: $${(currentBudget / 1000000).toFixed(1)}M`);
      console.log(`  Added: $${(amount / 1000000).toFixed(1)}M`);
      console.log(`  New budget: $${(newBudget / 1000000).toFixed(1)}M\n`);

      updatedCount++;
    }

    console.log(`\nAdded $${amount / 1000000}M to ${updatedCount} users`);

    return {
      success: true,
      updatedCount,
      updates
    };
  } catch (error) {
    console.error('Error adding budget:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Reset all users' points to 0
export async function resetAllPointsToZero() {
  console.log('Resetting all users\' points to 0...');

  try {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'No managers found' };
    }

    const managers = snapshot.val();
    let resetCount = 0;

    for (const uid in managers) {
      const manager = managers[uid];

      await update(ref(database, `managers/${uid}`), {
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0
      });

      console.log(`✓ Reset points for ${manager.managerName || manager.email}`);
      resetCount++;
    }

    console.log(`\nReset points for ${resetCount} users`);

    return {
      success: true,
      resetCount
    };
  } catch (error) {
    console.error('Error resetting points:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add budget to specific user by email or manager name
export async function addBudgetToSpecificUser(identifier, amount) {
  console.log(`Adding $${amount / 1000000}M to user: ${identifier}...`);

  try {
    const managersRef = ref(database, 'managers');
    const snapshot = await get(managersRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'No managers found' };
    }

    const managers = snapshot.val();
    let foundUser = null;
    let foundUid = null;

    // Search for user by email or manager name
    for (const uid in managers) {
      const manager = managers[uid];
      const emailMatch = manager.email?.toLowerCase() === identifier.toLowerCase();
      const nameMatch = manager.managerName?.toLowerCase() === identifier.toLowerCase();

      if (emailMatch || nameMatch) {
        foundUser = manager;
        foundUid = uid;
        break;
      }
    }

    if (!foundUser) {
      return {
        success: false,
        message: `User not found with identifier: ${identifier}`
      };
    }

    const currentBudget = foundUser.budget || 0;
    const newBudget = currentBudget + amount;

    await update(ref(database, `managers/${foundUid}`), {
      budget: newBudget
    });

    console.log(`✓ Updated ${foundUser.managerName || foundUser.email}`);
    console.log(`  Old budget: $${(currentBudget / 1000000).toFixed(1)}M`);
    console.log(`  Added: $${(amount / 1000000).toFixed(1)}M`);
    console.log(`  New budget: $${(newBudget / 1000000).toFixed(1)}M`);

    return {
      success: true,
      user: {
        name: foundUser.managerName || foundUser.email,
        email: foundUser.email,
        oldBudget: currentBudget,
        additionalBudget: amount,
        newBudget
      }
    };
  } catch (error) {
    console.error('Error adding budget to specific user:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// For browser console usage
if (typeof window !== 'undefined') {
  window.migrateBudgetsToTarget = migrateBudgetsToTarget;
  window.addBudgetToAllUsers = addBudgetToAllUsers;
  window.resetAllPointsToZero = resetAllPointsToZero;
  window.addBudgetToSpecificUser = addBudgetToSpecificUser;
}
