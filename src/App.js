import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';

const App = () => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [currentScreen, setCurrentScreen] = useState('home');
  const [playerData, setPlayerData] = useState({
    managerName: 'Alex Fury',
    clubName: 'Fury FC',
    season: '2024/25',
    league: 'Premier League',
    position: 1,
    points: 78,
    goalsFor: 95,
    goalsAgainst: 23
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.logo}>🔥 Fury FM</Text>
        <Text style={styles.subtitle}>Advanced Football Manager</Text>
      </View>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Season</Text>
          <Text style={styles.statValue}>{playerData.season}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Position</Text>
          <Text style={styles.statValue}>#{playerData.position}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{playerData.points}</Text>
        </View>
      </View>
    </View>
  );

  const renderHomeScreen = () => (
    <ScrollView style={styles.content}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome back, {playerData.managerName}!</Text>
        <Text style={styles.welcomeSubtitle}>Managing {playerData.clubName}</Text>

        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Goals For</Text>
            <Text style={styles.statCardValue}>{playerData.goalsFor}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Goals Against</Text>
            <Text style={styles.statCardValue}>{playerData.goalsAgainst}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Goal Difference</Text>
            <Text style={styles.statCardValue}>+{playerData.goalsFor - playerData.goalsAgainst}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('squad')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>Squad Management</Text>
          <Text style={styles.menuDesc}>Manage your players and tactics</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('transfers')}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuTitle}>Transfer Market</Text>
          <Text style={styles.menuDesc}>Buy and sell players</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => setCurrentScreen('matches')}>
          <Text style={styles.menuIcon}>⚽</Text>
          <Text style={styles.menuTitle}>Fixtures</Text>
          <Text style={styles.menuDesc}>View upcoming matches</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={() => setCurrentScreen('tactics')}>
          <Text style={styles.menuIcon}>📋</Text>
          <Text style={styles.menuTitle}>Tactics</Text>
          <Text style={styles.menuDesc}>Set formations and strategies</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFeatureScreen = (title, icon) => (
    <ScrollView style={styles.content}>
      <View style={styles.featureHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.featureTitle}>{icon} {title}</Text>
      </View>

      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonIcon}>🚀</Text>
        <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
        <Text style={styles.comingSoonDesc}>
          This feature is under development. The new Fury FM will include advanced {title.toLowerCase()}
          with modern UI, real-time updates, and enhanced gameplay mechanics.
        </Text>
      </View>
    </ScrollView>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'squad':
        return renderFeatureScreen('Squad Management', '👥');
      case 'transfers':
        return renderFeatureScreen('Transfer Market', '💰');
      case 'matches':
        return renderFeatureScreen('Fixtures', '⚽');
      case 'tactics':
        return renderFeatureScreen('Tactics', '📋');
      default:
        return renderHomeScreen();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {renderHeader()}
      {renderCurrentScreen()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    backdropFilter: 'blur(10px)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#667eea',
    marginBottom: 20,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#252b54',
    borderRadius: 12,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 5,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  secondaryCard: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  accentCard: {
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  warningCard: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  menuIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  menuDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 15,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  comingSoonCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  comingSoonIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  comingSoonDesc: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default App;