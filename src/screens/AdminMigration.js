import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { migrateBudgetsToTarget, addBudgetToAllUsers, resetAllPointsToZero } from '../utils/migrateBudgets';
import { add50NewPlayers, removeDuplicatePlayers, clearAllPendingMatches } from '../utils/migrateMarketPlayers';

const AdminMigration = ({ onBack }) => {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [migratingPlayers, setMigratingPlayers] = useState(false);
  const [playersResult, setPlayersResult] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [duplicatesResult, setDuplicatesResult] = useState(null);
  const [resettingPoints, setResettingPoints] = useState(false);
  const [pointsResult, setPointsResult] = useState(null);
  const [clearingMatches, setClearingMatches] = useState(false);
  const [matchesResult, setMatchesResult] = useState(null);

  const runMigration = async () => {
    if (!window.confirm('Are you sure you want to migrate all user budgets to 900M? This action will update all users with budgets below 900M.')) {
      return;
    }

    setMigrating(true);
    setResult(null);

    try {
      const migrationResult = await migrateBudgetsToTarget();
      setResult(migrationResult);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setMigrating(false);
    }
  };

  const runPlayersMigration = async () => {
    if (!window.confirm('Are you sure you want to add 50 new players to the market?')) {
      return;
    }

    setMigratingPlayers(true);
    setPlayersResult(null);

    try {
      const migrationResult = await add50NewPlayers();
      setPlayersResult(migrationResult);
    } catch (error) {
      setPlayersResult({
        success: false,
        error: error.message
      });
    } finally {
      setMigratingPlayers(false);
    }
  };

  const runRemoveDuplicates = async () => {
    if (!window.confirm('Are you sure you want to remove duplicate players from the market? This will keep only one version of each player (highest rated).')) {
      return;
    }

    setRemovingDuplicates(true);
    setDuplicatesResult(null);

    try {
      const result = await removeDuplicatePlayers();
      setDuplicatesResult(result);
    } catch (error) {
      setDuplicatesResult({
        success: false,
        error: error.message
      });
    } finally {
      setRemovingDuplicates(false);
    }
  };

  const runAddBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive number');
      return;
    }

    if (!window.confirm(`Are you sure you want to add $${amount}M to ALL users?`)) {
      return;
    }

    setMigrating(true);
    setResult(null);

    try {
      const migrationResult = await addBudgetToAllUsers(amount * 1000000);
      setResult(migrationResult);
      setBudgetAmount('');
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setMigrating(false);
    }
  };

  const runResetPoints = async () => {
    if (!window.confirm('Are you sure you want to reset ALL users\' points to 0? This action cannot be undone!')) {
      return;
    }

    setResettingPoints(true);
    setPointsResult(null);

    try {
      const result = await resetAllPointsToZero();
      setPointsResult(result);
    } catch (error) {
      setPointsResult({
        success: false,
        error: error.message
      });
    } finally {
      setResettingPoints(false);
    }
  };

  const runClearMatches = async () => {
    if (!window.confirm('Are you sure you want to clear ALL pending matches for all users? This will remove all active match references.')) {
      return;
    }

    setClearingMatches(true);
    setMatchesResult(null);

    try {
      const result = await clearAllPendingMatches();
      setMatchesResult(result);
    } catch (error) {
      setMatchesResult({
        success: false,
        error: error.message
      });
    } finally {
      setClearingMatches(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Tools</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚽</Text>
          <Text style={styles.warningTitle}>Add 50 New Players</Text>
          <Text style={styles.warningText}>
            Add 50 new players to the transfer market. Perfect for refreshing the market when it feels empty.
          </Text>
          <Text style={styles.warningText}>
            • Adds 50 players from the pool that aren't already on the market
          </Text>
          <Text style={styles.warningText}>
            • Players will be immediately available for purchase
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.migrateButton, migratingPlayers && styles.migrateButtonDisabled]}
          onPress={runPlayersMigration}
          disabled={migratingPlayers}
        >
          <Text style={styles.migrateButtonText}>
            {migratingPlayers ? 'Adding Players...' : '⚽ Add 50 New Players'}
          </Text>
        </TouchableOpacity>

        {playersResult && (
          <View style={[styles.resultCard, playersResult.success ? styles.successCard : styles.errorCard]}>
            <Text style={styles.resultTitle}>
              {playersResult.success ? '✓ Players Added' : '✗ Migration Failed'}
            </Text>

            {playersResult.success ? (
              <>
                <Text style={styles.resultText}>
                  Added: {playersResult.addedCount} players
                </Text>
                {playersResult.message && (
                  <Text style={styles.resultText}>
                    {playersResult.message}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.errorText}>Error: {playersResult.error}</Text>
            )}
          </View>
        )}

        {/* Remove Duplicates Section */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>🧹</Text>
          <Text style={styles.warningTitle}>Remove Duplicate Players</Text>
          <Text style={styles.warningText}>
            Scan and remove duplicate players from the market (keeps highest rated version).
          </Text>
          <Text style={styles.warningText}>
            • Identifies players with same name
          </Text>
          <Text style={styles.warningText}>
            • Keeps only the highest rated version
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.migrateButton, removingDuplicates && styles.migrateButtonDisabled]}
          onPress={runRemoveDuplicates}
          disabled={removingDuplicates}
        >
          <Text style={styles.migrateButtonText}>
            {removingDuplicates ? 'Removing Duplicates...' : '🧹 Remove Duplicates'}
          </Text>
        </TouchableOpacity>

        {duplicatesResult && (
          <View style={[styles.resultCard, duplicatesResult.success ? styles.successCard : styles.errorCard]}>
            <Text style={styles.resultTitle}>
              {duplicatesResult.success ? '✓ Duplicates Removed' : '✗ Operation Failed'}
            </Text>
            {duplicatesResult.success ? (
              <Text style={styles.resultText}>
                Removed: {duplicatesResult.removedCount} duplicate players
              </Text>
            ) : (
              <Text style={styles.errorText}>Error: {duplicatesResult.error}</Text>
            )}
          </View>
        )}

        {/* Add Custom Budget Section */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>💰</Text>
          <Text style={styles.warningTitle}>Add Budget to All Users</Text>
          <Text style={styles.warningText}>
            Add a custom amount of money to ALL users' budgets.
          </Text>
          <Text style={styles.warningText}>
            • Enter amount in millions (M)
          </Text>
          <Text style={styles.warningText}>
            • Amount will be added to current budgets
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter amount in millions (e.g., 100)"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={budgetAmount}
            onChangeText={setBudgetAmount}
          />
          <TouchableOpacity
            style={[styles.migrateButton, (migrating || !budgetAmount) && styles.migrateButtonDisabled]}
            onPress={runAddBudget}
            disabled={migrating || !budgetAmount}
          >
            <Text style={styles.migrateButtonText}>
              {migrating ? 'Adding Budget...' : '💰 Add Budget'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reset Points Section */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>🔄</Text>
          <Text style={styles.warningTitle}>Reset All Points</Text>
          <Text style={styles.warningText}>
            Reset all users' points (wins/draws/losses/league points) to 0. Perfect for starting a new season.
          </Text>
          <Text style={styles.warningText}>
            • Resets wins, draws, losses to 0
          </Text>
          <Text style={styles.warningText}>
            • Resets league points to 0
          </Text>
          <Text style={styles.warningText}>
            • Does NOT affect budgets or squads
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.migrateButton, resettingPoints && styles.migrateButtonDisabled]}
          onPress={runResetPoints}
          disabled={resettingPoints}
        >
          <Text style={styles.migrateButtonText}>
            {resettingPoints ? 'Resetting Points...' : '🔄 Reset All Points'}
          </Text>
        </TouchableOpacity>

        {pointsResult && (
          <View style={[styles.resultCard, pointsResult.success ? styles.successCard : styles.errorCard]}>
            <Text style={styles.resultTitle}>
              {pointsResult.success ? '✓ Points Reset' : '✗ Operation Failed'}
            </Text>
            {pointsResult.success ? (
              <Text style={styles.resultText}>
                Reset: {pointsResult.resetCount} users' points
              </Text>
            ) : (
              <Text style={styles.errorText}>Error: {pointsResult.error}</Text>
            )}
          </View>
        )}

        {/* Clear Matches Section */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>❌</Text>
          <Text style={styles.warningTitle}>Clear All Pending Matches</Text>
          <Text style={styles.warningText}>
            Clear all users' pending/stuck matches. Use this to fix stuck match states.
          </Text>
          <Text style={styles.warningText}>
            • Removes activeMatchId from all users
          </Text>
          <Text style={styles.warningText}>
            • Does NOT delete match history
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.migrateButton, clearingMatches && styles.migrateButtonDisabled]}
          onPress={runClearMatches}
          disabled={clearingMatches}
        >
          <Text style={styles.migrateButtonText}>
            {clearingMatches ? 'Clearing Matches...' : '❌ Clear Pending Matches'}
          </Text>
        </TouchableOpacity>

        {matchesResult && (
          <View style={[styles.resultCard, matchesResult.success ? styles.successCard : styles.errorCard]}>
            <Text style={styles.resultTitle}>
              {matchesResult.success ? '✓ Matches Cleared' : '✗ Operation Failed'}
            </Text>
            {matchesResult.success ? (
              <Text style={styles.resultText}>
                Cleared: {matchesResult.clearedCount} users' pending matches
              </Text>
            ) : (
              <Text style={styles.errorText}>Error: {matchesResult.error}</Text>
            )}
          </View>
        )}

        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>Budget Migration Tool</Text>
          <Text style={styles.warningText}>
            This will update all existing users' budgets to 900M (if their current budget is below 900M).
          </Text>
          <Text style={styles.warningText}>
            • Users with budgets below 900M will be topped up to 900M
          </Text>
          <Text style={styles.warningText}>
            • Users with budgets at or above 900M will be skipped
          </Text>
          <Text style={styles.warningText}>
            • New users will automatically start with 900M
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.migrateButton, migrating && styles.migrateButtonDisabled]}
          onPress={runMigration}
          disabled={migrating}
        >
          <Text style={styles.migrateButtonText}>
            {migrating ? 'Running Migration...' : 'Run Budget Migration'}
          </Text>
        </TouchableOpacity>

        {result && (
          <View style={[styles.resultCard, result.success ? styles.successCard : styles.errorCard]}>
            <Text style={styles.resultTitle}>
              {result.success ? '✓ Migration Complete' : '✗ Migration Failed'}
            </Text>

            {result.success ? (
              <>
                <Text style={styles.resultText}>
                  Updated: {result.updatedCount} managers
                </Text>
                <Text style={styles.resultText}>
                  Skipped: {result.skippedCount} managers
                </Text>

                {result.updates && result.updates.length > 0 && (
                  <View style={styles.updatesList}>
                    <Text style={styles.updatesTitle}>Updated Managers:</Text>
                    {result.updates.map((update, index) => (
                      <View key={index} style={styles.updateItem}>
                        <Text style={styles.updateName}>{update.name}</Text>
                        <Text style={styles.updateDetails}>
                          ${(update.oldBudget / 1000000).toFixed(1)}M → ${(update.newBudget / 1000000).toFixed(1)}M
                          (added ${(update.additionalBudget / 1000000).toFixed(1)}M)
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.errorText}>Error: {result.error}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
    paddingTop: 20,
    zIndex: 100,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  warningCard: {
    backgroundColor: '#3a2d1a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ffa726',
  },
  warningIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffa726',
    textAlign: 'center',
    marginBottom: 15,
  },
  warningText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    lineHeight: 20,
  },
  migrateButton: {
    background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  migrateButtonDisabled: {
    opacity: 0.5,
  },
  migrateButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  successCard: {
    backgroundColor: '#1a3a2d',
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  errorCard: {
    backgroundColor: '#3a1a1a',
    borderWidth: 2,
    borderColor: '#f5576c',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#f5576c',
  },
  updatesList: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#2d3561',
  },
  updatesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  updateItem: {
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  updateName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  updateDetails: {
    fontSize: 12,
    color: '#43e97b',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1a1f3a',
    color: '#ffffff',
    fontSize: 16,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2d3561',
    marginBottom: 10,
  },
});

export default AdminMigration;
