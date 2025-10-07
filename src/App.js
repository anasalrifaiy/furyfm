import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import TransferMarket from './screens/TransferMarket';
import Squad from './screens/Squad';
import Formation from './screens/Formation';
import Friends from './screens/Friends';
import Leaderboard from './screens/Leaderboard';
import Notifications from './screens/Notifications';
import ManagerProfile from './screens/ManagerProfile';
import Match from './screens/Match';

const MainApp = () => {
  const { currentUser, managerProfile, logout } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [currentScreen, setCurrentScreen] = useState('home');
  const [authScreen, setAuthScreen] = useState('login');
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState(null);

  useEffect(() => {
    // Check if running on web - native driver is not supported on web
    const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: !isWeb,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Load unread notifications count
    if (managerProfile?.notifications) {
      const count = Object.values(managerProfile.notifications).filter(n => !n.read).length;
      setUnreadNotifications(count);
    }
  }, [managerProfile]);

  const formatCurrency = (amount) => {
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  const handleViewProfile = (managerId) => {
    setSelectedManagerId(managerId);
    setCurrentScreen('profile');
  };

  const handleAcceptMatchChallenge = (matchId) => {
    setActiveMatchId(matchId);
    setCurrentScreen('match');
  };

  if (!currentUser) {
    return authScreen === 'login' ? (
      <Login onSwitch={() => setAuthScreen('signup')} />
    ) : (
      <Signup onSwitch={() => setAuthScreen('login')} />
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.logo}>🔥 Fury FM</Text>
        <Text style={styles.subtitle}>Advanced Football Manager</Text>
      </View>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Manager</Text>
          <Text style={styles.statValue}>{managerProfile?.managerName}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Budget</Text>
          <Text style={styles.statValue}>{formatCurrency(managerProfile?.budget || 0)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{managerProfile?.points || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderHomeScreen = () => (
    <ScrollView style={styles.content}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome back, {managerProfile?.managerName}!</Text>
        <Text style={styles.welcomeSubtitle}>Budget: {formatCurrency(managerProfile?.budget || 0)}</Text>

        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Squad Size</Text>
            <Text style={styles.statCardValue}>{managerProfile?.squad?.length || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Wins</Text>
            <Text style={styles.statCardValue}>{managerProfile?.wins || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Friends</Text>
            <Text style={styles.statCardValue}>{managerProfile?.friends?.length || 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('squad')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>My Squad</Text>
          <Text style={styles.menuDesc}>View and manage your players</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('market')}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuTitle}>Transfer Market</Text>
          <Text style={styles.menuDesc}>Buy and sell players</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => setCurrentScreen('formation')}>
          <Text style={styles.menuIcon}>⚽</Text>
          <Text style={styles.menuTitle}>Formation</Text>
          <Text style={styles.menuDesc}>Set your tactical lineup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.successCard]} onPress={() => setCurrentScreen('match')}>
          <Text style={styles.menuIcon}>🏟️</Text>
          <Text style={styles.menuTitle}>Match</Text>
          <Text style={styles.menuDesc}>Challenge friends to play</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={() => setCurrentScreen('friends')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>Friends</Text>
          <Text style={styles.menuDesc}>Find and add managers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('leaderboard')}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuTitle}>Leaderboard</Text>
          <Text style={styles.menuDesc}>Compete with other managers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('notifications')}>
          <View style={styles.iconContainer}>
            <Text style={styles.menuIcon}>🔔</Text>
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </View>
          <Text style={styles.menuTitle}>Notifications</Text>
          <Text style={styles.menuDesc}>View your alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => handleViewProfile(currentUser.uid)}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuTitle}>My Profile</Text>
          <Text style={styles.menuDesc}>View your stats</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={logout}>
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={styles.menuTitle}>Logout</Text>
          <Text style={styles.menuDesc}>Sign out of your account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'market':
        return <TransferMarket onBack={() => setCurrentScreen('home')} />;
      case 'squad':
        return <Squad onBack={() => setCurrentScreen('home')} />;
      case 'formation':
        return <Formation onBack={() => setCurrentScreen('home')} />;
      case 'match':
        return <Match onBack={() => { setCurrentScreen('home'); setActiveMatchId(null); }} activeMatchId={activeMatchId} />;
      case 'friends':
        return <Friends onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} />;
      case 'leaderboard':
        return <Leaderboard onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} />;
      case 'notifications':
        return <Notifications onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} onAcceptMatchChallenge={handleAcceptMatchChallenge} />;
      case 'profile':
        return <ManagerProfile managerId={selectedManagerId} onBack={() => setCurrentScreen('home')} />;
      default:
        return (
          <>
            {renderHeader()}
            {renderHomeScreen()}
          </>
        );
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
      {renderCurrentScreen()}
    </Animated.View>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
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
  successCard: {
    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
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
  iconContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#f5576c',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default App;