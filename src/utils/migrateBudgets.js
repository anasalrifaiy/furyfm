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

// For browser console usage
if (typeof window !== 'undefined') {
  window.migrateBudgetsToTarget = migrateBudgetsToTarget;
}
