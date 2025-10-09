// Migration script to update existing users' budgets to 900M
// Run this script once to backfill existing users

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fury-fm-default-rtdb.firebaseio.com"
});

const database = admin.database();
const TARGET_BUDGET = 900000000; // 900M

async function migrateBudgets() {
  console.log('Starting budget migration...');
  console.log(`Target budget: $${TARGET_BUDGET / 1000000}M\n`);

  try {
    // Get all managers
    const managersRef = database.ref('managers');
    const snapshot = await managersRef.once('value');

    if (!snapshot.exists()) {
      console.log('No managers found in database.');
      return;
    }

    const managers = snapshot.val();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const uid in managers) {
      const manager = managers[uid];
      const currentBudget = manager.budget || 0;

      if (currentBudget < TARGET_BUDGET) {
        const additionalBudget = TARGET_BUDGET - currentBudget;
        const newBudget = TARGET_BUDGET;

        // Update the manager's budget
        await database.ref(`managers/${uid}`).update({
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

    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateBudgets();
