import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
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
import MatchHistory from './screens/MatchHistory';
import Training from './screens/Training';
import AdminMigration from './screens/AdminMigration';
import CoachingStaff from './screens/CoachingStaff';
import ClubFacilities from './screens/ClubFacilities';
import Bank from './screens/Bank';
import ProLeague from './screens/ProLeague';
import { database } from './firebase';
import { ref, onValue, update, get } from 'firebase/database';

const MainApp = () => {
  const { currentUser, managerProfile, logout } = useAuth();
  const { t, language, switchLanguage, isRTL } = useLanguage();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [currentScreen, setCurrentScreen] = useState('home');
  const [authScreen, setAuthScreen] = useState('login');
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeMatchId, setActiveMatchId] = useState(() => {
    // Restore active match ID from localStorage on initialization
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('activeMatchId') || null;
    }
    return null;
  });
  const [activeMatch, setActiveMatch] = useState(null);

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
    // Save activeMatchId to localStorage whenever it changes
    if (typeof window !== 'undefined' && window.localStorage) {
      if (activeMatchId) {
        localStorage.setItem('activeMatchId', activeMatchId);
      } else {
        localStorage.removeItem('activeMatchId');
      }
    }
  }, [activeMatchId]);

  useEffect(() => {
    // Real-time listener for unread notifications count
    if (!currentUser) return;

    const notificationsRef = ref(database, `managers/${currentUser.uid}/notifications`);

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notifData = [];
        snapshot.forEach(childSnapshot => {
          notifData.push(childSnapshot.val());
        });
        const count = notifData.filter(n => !n.read).length;
        setUnreadNotifications(count);
      } else {
        setUnreadNotifications(0);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    // Real-time listener for active matches (including practice matches)
    if (!currentUser) return;

    const checkMatches = () => {
      // First check for practice match from localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedPracticeMatch = localStorage.getItem('practiceMatch');
        const storedPracticeMatchState = localStorage.getItem('practiceMatchState');

        if (storedPracticeMatch && storedPracticeMatchState) {
          try {
            const practiceMatch = JSON.parse(storedPracticeMatch);
            console.log('Found practice match in localStorage:', practiceMatch.id);

            setActiveMatch(practiceMatch);

            if (activeMatchId !== practiceMatch.id) {
              setActiveMatchId(practiceMatch.id);
            }
            return; // Don't check Firebase if we have a practice match
          } catch (error) {
            console.error('Failed to parse practice match:', error);
            localStorage.removeItem('practiceMatch');
            localStorage.removeItem('practiceMatchState');
            localStorage.removeItem('activeMatchId');
          }
        }
      }

      // If no practice match, check Firebase for regular matches
      const matchesRef = ref(database, 'matches');

      get(matchesRef).then((snapshot) => {
        if (snapshot.exists()) {
          let foundActiveMatch = null;
          const oneHourAgo = Date.now() - (60 * 60 * 1000);

          snapshot.forEach(childSnapshot => {
            const match = childSnapshot.val();
            if (
              (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid) &&
              (match.state === 'waiting' || match.state === 'prematch' || match.state === 'ready' || match.state === 'playing' || match.state === 'halftime') &&
              match.state !== 'cancelled' &&
              (match.createdAt && match.createdAt > oneHourAgo)
            ) {
              foundActiveMatch = { ...match, id: childSnapshot.key };
            }
          });

          setActiveMatch(foundActiveMatch);

          if (foundActiveMatch) {
            if (activeMatchId !== foundActiveMatch.id) {
              setActiveMatchId(foundActiveMatch.id);
            }
          } else {
            if (activeMatchId && !activeMatchId.startsWith('practice_')) {
              setActiveMatchId(null);
            }
          }
        } else {
          setActiveMatch(null);
          if (activeMatchId && !activeMatchId.startsWith('practice_')) {
            setActiveMatchId(null);
          }
        }
      });
    };

    checkMatches();

    // Re-check periodically (every 2 seconds) to catch updates
    const interval = setInterval(checkMatches, 2000);

    return () => clearInterval(interval);
  }, [currentUser, currentScreen]);

  // Handle browser back button navigation
  useEffect(() => {
    // Check if we're running in a browser environment
    if (typeof window === 'undefined' || !window.history) return;

    // Add a history entry when the app first loads
    if (currentUser) {
      window.history.pushState({ screen: currentScreen }, '', window.location.href);
    }

    const handlePopState = (event) => {
      // Prevent default back navigation that would leave the app
      event.preventDefault();

      // Navigate back to home screen instead of exiting the app
      if (currentScreen !== 'home') {
        setCurrentScreen('home');
        setActiveMatchId(null);
        setSelectedManagerId(null);
        // Push a new state so we stay in the app
        window.history.pushState({ screen: 'home' }, '', window.location.href);
      } else {
        // If already on home, push state again to prevent leaving
        window.history.pushState({ screen: 'home' }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentScreen, currentUser]);

  // Update browser history when screen changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history && currentUser && currentScreen !== 'home') {
      window.history.pushState({ screen: currentScreen }, '', window.location.href);
    }
  }, [currentScreen, currentUser]);

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

  const handleCancelPendingMatch = async (e) => {
    e.stopPropagation(); // Prevent banner click from firing

    if (!activeMatch) return;

    try {
      // Check if it's a practice match
      if (activeMatch.isPractice || activeMatch.id?.startsWith('practice_')) {
        // Just clear localStorage for practice matches
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('practiceMatch');
          localStorage.removeItem('practiceMatchState');
          localStorage.removeItem('activeMatchId');
        }
      } else {
        // Update Firebase for regular matches
        const matchRef = ref(database, `matches/${activeMatch.id}`);
        await update(matchRef, {
          state: 'cancelled',
          cancelledBy: currentUser.uid,
          cancelledAt: Date.now()
        });
      }

      // Clear local state
      setActiveMatch(null);
      setActiveMatchId(null);
    } catch (error) {
      console.error('Error cancelling match:', error);
      alert('Failed to cancel match. Please try again.');
    }
  };

  const handleClearAllPendingMatches = async () => {
    if (!currentUser) return;

    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('Cancel all your pending matches? This will remove all waiting/prematch challenges.');
      if (!confirmed) return;
    }

    try {
      const matchesRef = ref(database, 'matches');
      const snapshot = await get(matchesRef);

      if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach(childSnapshot => {
          const match = childSnapshot.val();
          // Cancel all pending matches involving this user
          if (
            (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid) &&
            (match.state === 'waiting' || match.state === 'prematch')
          ) {
            updates[`matches/${childSnapshot.key}/state`] = 'cancelled';
            updates[`matches/${childSnapshot.key}/cancelledBy`] = currentUser.uid;
            updates[`matches/${childSnapshot.key}/cancelledAt`] = Date.now();
          }
        });

        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
          alert(`Cancelled ${Object.keys(updates).length / 3} pending match(es)`);
        } else {
          alert('No pending matches to cancel');
        }
      }

      // Clear local state
      setActiveMatch(null);
      setActiveMatchId(null);
    } catch (error) {
      console.error('Error clearing pending matches:', error);
      alert('Failed to clear pending matches. Please try again.');
    }
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
        <Text style={styles.logo}>🔥 {t('appTitle')}</Text>
        <Text style={styles.subtitle}>{t('appSubtitle')}</Text>
      </View>
      <View style={styles.topButtons}>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => switchLanguage(language === 'en' ? 'ar' : 'en')}
        >
          <Text style={styles.languageButtonText}>
            {language === 'en' ? 'العربية' : 'English'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setCurrentScreen('notifications')}
        >
          <Text style={styles.notificationIcon}>🔔</Text>
          {unreadNotifications > 0 && (
            <View style={styles.notificationBadgeTop}>
              <Text style={styles.badgeTextTop}>{unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('manager')}</Text>
          <Text style={styles.statValue}>{managerProfile?.managerName}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('budget')}</Text>
          <Text style={styles.statValue}>{formatCurrency(managerProfile?.budget || 0)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('points')}</Text>
          <Text style={styles.statValue}>{managerProfile?.points || 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderHomeScreen = () => {
    // Debug: Check what email we're comparing
    console.log('Current user email:', currentUser?.email);
    console.log('Is admin?', currentUser?.email === 'anasalrifai90@gmail.com');

    return (
    <ScrollView style={styles.content}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>{t('welcomeBack')}, {managerProfile?.managerName}!</Text>
        <Text style={styles.welcomeSubtitle}>{t('budget')}: {formatCurrency(managerProfile?.budget || 0)}</Text>

        {activeMatch && (
          <TouchableOpacity style={styles.clearMatchesButton} onPress={handleClearAllPendingMatches}>
            <Text style={styles.clearMatchesButtonText}>⚠️ Clear All Pending Matches</Text>
          </TouchableOpacity>
        )}

        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('squadSize')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.squad?.length || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('wins')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.wins || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('friends')}</Text>
            <Text style={styles.statCardValue}>{managerProfile?.friends?.length || 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('squad')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>{t('mySquad')}</Text>
          <Text style={styles.menuDesc}>{t('mySquadDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('market')}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuTitle}>{t('transferMarket')}</Text>
          <Text style={styles.menuDesc}>{t('transferMarketDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => setCurrentScreen('formation')}>
          <Text style={styles.menuIcon}>⚽</Text>
          <Text style={styles.menuTitle}>{t('formation')}</Text>
          <Text style={styles.menuDesc}>{t('formationDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('training')}>
          <Text style={styles.menuIcon}>🎓</Text>
          <Text style={styles.menuTitle}>{t('training')}</Text>
          <Text style={styles.menuDesc}>{t('trainingDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('coaching')}>
          <Text style={styles.menuIcon}>👨‍🏫</Text>
          <Text style={styles.menuTitle}>{t('coachingStaff')}</Text>
          <Text style={styles.menuDesc}>{t('coachingStaffDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => setCurrentScreen('facilities')}>
          <Text style={styles.menuIcon}>🏗️</Text>
          <Text style={styles.menuTitle}>{t('clubFacilities')}</Text>
          <Text style={styles.menuDesc}>{t('clubFacilitiesDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('bank')}>
          <Text style={styles.menuIcon}>🏦</Text>
          <Text style={styles.menuTitle}>{t('bank')}</Text>
          <Text style={styles.menuDesc}>{t('bankDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.successCard]} onPress={() => setCurrentScreen('match')}>
          <Text style={styles.menuIcon}>🏟️</Text>
          <Text style={styles.menuTitle}>{t('match')}</Text>
          <Text style={styles.menuDesc}>{t('matchDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={() => setCurrentScreen('proleague')}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuTitle}>Pro League</Text>
          <Text style={styles.menuDesc}>Compete for points and glory!</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => setCurrentScreen('matchHistory')}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuTitle}>{t('matchHistory')}</Text>
          <Text style={styles.menuDesc}>{t('matchHistoryDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={() => setCurrentScreen('friends')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>{t('friendsMenu')}</Text>
          <Text style={styles.menuDesc}>{t('friendsDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.primaryCard]} onPress={() => setCurrentScreen('leaderboard')}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuTitle}>{t('leaderboard')}</Text>
          <Text style={styles.menuDesc}>{t('leaderboardDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.accentCard]} onPress={() => handleViewProfile(currentUser.uid)}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuTitle}>{t('myProfile')}</Text>
          <Text style={styles.menuDesc}>{t('myProfileDesc')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuCard, styles.warningCard]} onPress={logout}>
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={styles.menuTitle}>{t('logout')}</Text>
          <Text style={styles.menuDesc}>{t('logoutDesc')}</Text>
        </TouchableOpacity>

        {currentUser?.email === 'anasalrifai90@gmail.com' && (
          <TouchableOpacity style={[styles.menuCard, styles.secondaryCard]} onPress={() => setCurrentScreen('adminMigration')}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuTitle}>Admin: Budget Migration</Text>
            <Text style={styles.menuDesc}>Run once to update budgets</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    );
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'market':
        return <TransferMarket onBack={() => setCurrentScreen('home')} />;
      case 'squad':
        return <Squad onBack={() => setCurrentScreen('home')} />;
      case 'formation':
        return <Formation onBack={() => setCurrentScreen('home')} />;
      case 'training':
        return <Training onBack={() => setCurrentScreen('home')} />;
      case 'coaching':
        return <CoachingStaff onBack={() => setCurrentScreen('home')} />;
      case 'facilities':
        return <ClubFacilities onBack={() => setCurrentScreen('home')} />;
      case 'bank':
        return <Bank onBack={() => setCurrentScreen('home')} />;
      case 'match':
        return <Match onBack={() => { setCurrentScreen('home'); setActiveMatchId(null); }} activeMatchId={activeMatchId} />;
      case 'matchHistory':
        return <MatchHistory onBack={() => setCurrentScreen('home')} />;
      case 'friends':
        return <Friends onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} />;
      case 'leaderboard':
        return <Leaderboard onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} />;
      case 'notifications':
        return <Notifications onBack={() => setCurrentScreen('home')} onViewProfile={handleViewProfile} onAcceptMatchChallenge={handleAcceptMatchChallenge} />;
      case 'profile':
        return <ManagerProfile managerId={selectedManagerId} onBack={() => setCurrentScreen('home')} />;
      case 'proleague':
        return <ProLeague onBack={() => setCurrentScreen('home')} onStartMatch={(matchId) => { setActiveMatchId(matchId); setCurrentScreen('match'); }} />;
      case 'adminMigration':
        // Only allow admin user to access this screen
        if (currentUser?.email === 'anasalrifai90@gmail.com') {
          return <AdminMigration onBack={() => setCurrentScreen('home')} />;
        } else {
          // Redirect non-admin users back to home
          setCurrentScreen('home');
          return null;
        }
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

      {/* Active Match Indicator Banner */}
      {activeMatch && currentScreen !== 'match' && currentScreen !== 'notifications' && (
        <TouchableOpacity
          style={styles.activeMatchBanner}
          onPress={() => {
            console.log('Banner clicked - navigating to match:', activeMatch.id);
            setActiveMatchId(activeMatch.id);
            setCurrentScreen('match');
          }}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerIcon}>⚽</Text>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerTitle}>
                {activeMatch.state === 'waiting' ? 'Match Challenge Pending' :
                 activeMatch.state === 'prematch' ? 'Pre-Match Setup' :
                 activeMatch.state === 'ready' ? 'Match Starting...' :
                 activeMatch.state === 'halftime' ? 'Half Time' :
                 'Match in Progress'}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {activeMatch.homeManager?.managerName} vs {activeMatch.awayManager?.managerName}
              </Text>
              {(activeMatch.state === 'playing' || activeMatch.state === 'halftime') && (
                <Text style={styles.bannerScore}>
                  {activeMatch.homeScore || 0} - {activeMatch.awayScore || 0}
                </Text>
              )}
            </View>
            <View style={styles.bannerButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelPendingMatch}
              >
                <Text style={styles.cancelButtonText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.bannerArrow}>→</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
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
    marginBottom: 15,
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  languageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  notificationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'relative',
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationBadgeTop: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f5576c',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeTextTop: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
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
  clearMatchesButton: {
    backgroundColor: '#f5576c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  clearMatchesButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
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
  activeMatchBanner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1f3a',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 15,
    borderTopWidth: 2,
    borderColor: '#667eea',
    elevation: 10,
    zIndex: 9999,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 3,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#a0aec0',
    marginBottom: 3,
  },
  bannerScore: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#667eea',
  },
  bannerArrow: {
    fontSize: 24,
    color: '#667eea',
    marginLeft: 10,
  },
  bannerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelButton: {
    backgroundColor: '#f5576c',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
});

export default App;