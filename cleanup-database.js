// Database cleanup script
// Run this script to clear old loans, matches, and reset manager points

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update, remove } = require('firebase/database');

// Your Firebase config (same as in firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyCl34JKI1H1VtoRGQ3Cy5oLNNWxr1tSSI4",
  authDomain: "fury-fm.firebaseapp.com",
  databaseURL: "https://fury-fm-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fury-fm",
  storageBucket: "fury-fm.firebasestorage.app",
  messagingSenderId: "1085397835857",
  appId: "1:1085397835857:web:44cf5f06f9f6e9ec41d1e2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // 1. Clear all loans
    console.log('📋 Clearing all loans...');
    const loansRef = ref(database, 'loans');
    await remove(loansRef);
    console.log('✅ All loans cleared\n');

    // 2. Clear all matches
    console.log('⚽ Clearing all matches...');
    const matchesRef = ref(database, 'matches');
    await remove(matchesRef);
    console.log('✅ All matches cleared\n');

    // 3. Reset manager points to 0 (keep budget intact)
    console.log('🏆 Resetting all manager points to 0...');
    const managersRef = ref(database, 'managers');
    const managersSnapshot = await get(managersRef);

    if (managersSnapshot.exists()) {
      const managers = managersSnapshot.val();
      const managerIds = Object.keys(managers);

      console.log(`Found ${managerIds.length} managers to update`);

      for (const managerId of managerIds) {
        const managerData = managers[managerId];

        // Only update points, keep budget
        await update(ref(database, `managers/${managerId}`), {
          points: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          matchesPlayed: 0,
          // Budget remains unchanged
        });

        console.log(`  ✓ Reset points for ${managerData.managerName} (Budget: $${(managerData.budget / 1000000).toFixed(1)}M preserved)`);
      }

      console.log(`\n✅ All ${managerIds.length} managers\' points reset to 0\n`);
    } else {
      console.log('⚠️  No managers found in database\n');
    }

    console.log('🎉 Database cleanup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  • All loans removed');
    console.log('  • All matches removed');
    console.log('  • All manager points reset to 0');
    console.log('  • All manager budgets preserved');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }

  process.exit(0);
}

// Run cleanup
cleanupDatabase();
