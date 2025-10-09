import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { migrateBudgetsToTarget } from '../utils/migrateBudgets';

const AdminMigration = ({ onBack }) => {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin: Budget Migration</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
});

export default AdminMigration;
