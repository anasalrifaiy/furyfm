import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, push, set, onValue, off } from 'firebase/database';
import { showAlert } from '../utils/alert';

const Match = ({ onBack, activeMatchId }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const [friends, setFriends] = useState([]);
  const [matchState, setMatchState] = useState('select'); // 'select', 'waiting', 'prematch', 'ready', 'playing', 'halftime', 'paused', 'finished'
  const [currentMatch, setCurrentMatch] = useState(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState([]);
  const [isHome, setIsHome] = useState(true);
  const [substitutionMode, setSubstitutionMode] = useState(null); // { playerOut: player, playerOutIndex: number }
  const [selectedTactic, setSelectedTactic] = useState('Balanced');
  const [substitutionsUsed, setSubstitutionsUsed] = useState(0);
  const [substitutedPlayers, setSubstitutedPlayers] = useState([]); // Track players who have been subbed out
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);
  const [homePausesUsed, setHomePausesUsed] = useState(0);
  const [awayPausesUsed, setAwayPausesUsed] = useState(0);
  const [homeResumeReady, setHomeResumeReady] = useState(false);
  const [awayResumeReady, setAwayResumeReady] = useState(false);
  const [prematchStarting11, setPrematchStarting11] = useState([]);
  const [prematchFormation, setPrematchFormation] = useState('4-3-3');
  const [selectingPlayerSlot, setSelectingPlayerSlot] = useState(null);
  const [goalCelebration, setGoalCelebration] = useState(null); // { scorer: 'Player Name', team: 'home'/'away' }
  const [shotAnimation, setShotAnimation] = useState(null); // { fromX, fromY, toX, toY, startTime }
  const [goalMoment, setGoalMoment] = useState(null); // { show: true, scorer, team, startTime }
  const [ballPossession, setBallPossession] = useState('home'); // 'home' or 'away' - tracks which team has the ball
  const [ballHolder, setBallHolder] = useState(null); // Player currently holding the ball { player, team }
  const [passAnimation, setPassAnimation] = useState(null); // { fromPlayer, toPlayer, startTime }
  const previousMatchStateRef = useRef(matchState);
  const lastCelebratedEventRef = useRef(null); // Track last celebrated event to avoid duplicates

  // Helper function for formation positions
  const getFormationPositions = (formation, squad) => {
    // Returns array of {position, x, y} based on formation
    // GK at y=95 (very close to goal), defenders at 72-78, midfielders at 45-55, attackers at 15-25
    const formations = {
      '4-3-3': [
        { pos: 'GK', x: 50, y: 95 },
        { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
        { pos: 'CDM', x: 50, y: 55 },
        { pos: 'CM', x: 28, y: 45 }, { pos: 'CM', x: 72, y: 45 },
        { pos: 'LW', x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 }
      ],
      '4-4-2': [
        { pos: 'GK', x: 50, y: 95 },
        { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
        { pos: 'LM', x: 18, y: 48 }, { pos: 'CM', x: 37, y: 52 }, { pos: 'CM', x: 63, y: 52 }, { pos: 'RM', x: 82, y: 48 },
        { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 }
      ],
      '3-5-2': [
        { pos: 'GK', x: 50, y: 95 },
        { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
        { pos: 'LWB', x: 12, y: 52 }, { pos: 'CDM', x: 50, y: 55 }, { pos: 'CM', x: 32, y: 48 }, { pos: 'CM', x: 68, y: 48 }, { pos: 'RWB', x: 88, y: 52 },
        { pos: 'ST', x: 37, y: 18 }, { pos: 'ST', x: 63, y: 18 }
      ],
      '4-2-3-1': [
        { pos: 'GK', x: 50, y: 95 },
        { pos: 'LB', x: 15, y: 75 }, { pos: 'CB', x: 37, y: 78 }, { pos: 'CB', x: 63, y: 78 }, { pos: 'RB', x: 85, y: 75 },
        { pos: 'CDM', x: 37, y: 58 }, { pos: 'CDM', x: 63, y: 58 },
        { pos: 'LW', x: 18, y: 35 }, { pos: 'CAM', x: 50, y: 38 }, { pos: 'RW', x: 82, y: 35 },
        { pos: 'ST', x: 50, y: 15 }
      ],
      '3-4-3': [
        { pos: 'GK', x: 50, y: 95 },
        { pos: 'CB', x: 28, y: 76 }, { pos: 'CB', x: 50, y: 78 }, { pos: 'CB', x: 72, y: 76 },
        { pos: 'LM', x: 18, y: 50 }, { pos: 'CM', x: 37, y: 52 }, { pos: 'CM', x: 63, y: 52 }, { pos: 'RM', x: 82, y: 50 },
        { pos: 'LW', x: 18, y: 22 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'RW', x: 82, y: 22 }
      ]
    };

    const formationLayout = formations[formation] || formations['4-3-3'];

    // Smart player-to-position matching
    const usedPlayers = new Set();
    const positionedPlayers = [];

    // Helper to check if a player fits a position
    const playerFitsPosition = (player, targetPos) => {
      const positionCompatibility = {
        'GK': ['GK'],
        'LB': ['LB', 'LWB', 'CB'],
        'CB': ['CB', 'LB', 'RB'],
        'RB': ['RB', 'RWB', 'CB'],
        'LWB': ['LWB', 'LB', 'LM'],
        'RWB': ['RWB', 'RB', 'RM'],
        'CDM': ['CDM', 'CM', 'CB'],
        'CM': ['CM', 'CDM', 'CAM'],
        'CAM': ['CAM', 'CM', 'LW', 'RW'],
        'LM': ['LM', 'LW', 'LWB'],
        'RM': ['RM', 'RW', 'RWB'],
        'LW': ['LW', 'LM', 'ST'],
        'RW': ['RW', 'RM', 'ST'],
        'ST': ['ST', 'LW', 'RW', 'CAM']
      };

      const compatiblePositions = positionCompatibility[targetPos] || [targetPos];
      return compatiblePositions.includes(player.position);
    };

    // First pass: Try to match players exactly to their positions
    formationLayout.forEach((layoutPos) => {
      const bestPlayer = squad.find(player =>
        !usedPlayers.has(player.id) && player.position === layoutPos.pos
      );

      if (bestPlayer) {
        usedPlayers.add(bestPlayer.id);
        positionedPlayers.push({
          ...bestPlayer,
          baseX: layoutPos.x,
          baseY: layoutPos.y,
          currentX: layoutPos.x,
          currentY: layoutPos.y
        });
      } else {
        positionedPlayers.push(null); // Placeholder
      }
    });

    // Second pass: Fill empty slots with compatible players
    positionedPlayers.forEach((player, idx) => {
      if (player === null) {
        const layoutPos = formationLayout[idx];
        const compatiblePlayer = squad.find(p =>
          !usedPlayers.has(p.id) && playerFitsPosition(p, layoutPos.pos)
        );

        if (compatiblePlayer) {
          usedPlayers.add(compatiblePlayer.id);
          positionedPlayers[idx] = {
            ...compatiblePlayer,
            baseX: layoutPos.x,
            baseY: layoutPos.y,
            currentX: layoutPos.x,
            currentY: layoutPos.y
          };
        }
      }
    });

    // Third pass: Fill any remaining slots with any unused players
    positionedPlayers.forEach((player, idx) => {
      if (player === null) {
        const layoutPos = formationLayout[idx];
        const anyPlayer = squad.find(p => !usedPlayers.has(p.id));

        if (anyPlayer) {
          usedPlayers.add(anyPlayer.id);
          positionedPlayers[idx] = {
            ...anyPlayer,
            baseX: layoutPos.x,
            baseY: layoutPos.y,
            currentX: layoutPos.x,
            currentY: layoutPos.y
          };
        }
      }
    });

    // Return only non-null players
    return positionedPlayers.filter(p => p !== null);
  };

  // Helper function to adjust player positions based on tactic
  const adjustPositionsForTactic = (players, tactic, isHome) => {
    if (!tactic || tactic === 'Balanced') return players;

    return players.map(player => {
      let adjustedY = player.baseY;

      // Skip goalkeeper - they stay in position
      if (player.position === 'GK') {
        return player;
      }

      if (tactic === 'Attacking') {
        // Move players forward (toward opponent goal)
        // Defenders move up 8%, midfielders 10%, attackers 12%
        if (['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(player.position)) {
          adjustedY = player.baseY - 8;  // Defenders push up
        } else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(player.position)) {
          adjustedY = player.baseY - 10; // Midfielders more aggressive
        } else if (['ST', 'LW', 'RW'].includes(player.position)) {
          adjustedY = player.baseY - 12; // Attackers press high
        }
      } else if (tactic === 'Defensive') {
        // Move players back (toward own goal)
        // Attackers drop 12%, midfielders 10%, defenders 5%
        if (['ST', 'LW', 'RW'].includes(player.position)) {
          adjustedY = player.baseY + 12; // Attackers drop deep
        } else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(player.position)) {
          adjustedY = player.baseY + 10; // Midfielders compact
        } else if (['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(player.position)) {
          adjustedY = player.baseY + 5;  // Defenders sit deeper
        }
      }

      // Ensure players stay within bounds (5% to 95%)
      adjustedY = Math.max(5, Math.min(92, adjustedY));

      return {
        ...player,
        baseY: adjustedY,
        currentY: adjustedY
      };
    });
  };

  useEffect(() => {
    if (managerProfile) {
      loadFriends();
      cleanupStuckMatches();
    }
  }, [managerProfile]);

  // Restore practice match from localStorage on mount or when returning to screen
  useEffect(() => {
    console.log('Match screen mounted/updated - checking for practice match');
    console.log('activeMatchId:', activeMatchId);
    console.log('matchState:', matchState);
    console.log('currentMatch:', currentMatch?.id);

    // Only restore if no current match
    if (!currentMatch && !activeMatchId) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedPracticeMatch = localStorage.getItem('practiceMatch');
        const storedPracticeMatchState = localStorage.getItem('practiceMatchState');

        console.log('Stored practice match exists:', !!storedPracticeMatch);
        console.log('Stored practice state:', storedPracticeMatchState);

        if (storedPracticeMatch && storedPracticeMatchState) {
          try {
            const matchData = JSON.parse(storedPracticeMatch);
            console.log('Restoring practice match:', matchData.id);
            setCurrentMatch(matchData);
            setIsHome(true);
            setMatchState(storedPracticeMatchState);
          } catch (error) {
            console.error('Failed to restore practice match:', error);
            localStorage.removeItem('practiceMatch');
            localStorage.removeItem('practiceMatchState');
          }
        }
      }
    }
  }, [activeMatchId, currentMatch]); // Run when activeMatchId or currentMatch changes

  // Load active match when activeMatchId changes
  useEffect(() => {
    if (activeMatchId) {
      loadActiveMatch(activeMatchId);
    }
  }, [activeMatchId]);

  // Cleanup stuck and old matches
  const cleanupStuckMatches = async () => {
    if (!currentUser) return;

    const matchesRef = ref(database, 'matches');
    const snapshot = await get(matchesRef);

    if (!snapshot.exists()) return;

    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    snapshot.forEach(async (childSnapshot) => {
      const match = childSnapshot.val();
      const matchAge = match.createdAt || 0;
      const matchRef = ref(database, `matches/${childSnapshot.key}`);

      // Auto-cancel waiting/prematch matches older than 30 minutes
      if (
        (match.state === 'waiting' || match.state === 'prematch') &&
        matchAge > 0 &&
        matchAge < thirtyMinutesAgo &&
        (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid)
      ) {
        await update(matchRef, {
          state: 'cancelled',
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          events: [`Match automatically cancelled due to inactivity`],
          cancelledAt: Date.now()
        });
      }

      // Auto-finish stuck 'ready' or 'playing' matches older than 2 hours
      if (
        (match.state === 'ready' || match.state === 'playing' || match.state === 'halftime') &&
        matchAge > 0 &&
        matchAge < twoHoursAgo &&
        (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid)
      ) {
        await update(matchRef, {
          state: 'finished',
          minute: 90,
          events: [...(match.events || []), `Match automatically ended due to inactivity`],
          finishedAt: Date.now()
        });
      }

      // Delete old finished/cancelled matches older than 24 hours
      if (
        (match.state === 'finished' || match.state === 'cancelled') &&
        matchAge > 0 &&
        matchAge < twentyFourHoursAgo
      ) {
        // Don't delete, just mark for cleanup by leaving it (Firebase will handle it)
        // Or you could delete it: await remove(matchRef);
      }
    });
  };

  const acceptMatchChallenge = async (matchId) => {
    const matchRef = ref(database, `matches/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
      showAlert('Error', 'Match not found.');
      return;
    }

    const matchData = snapshot.val();

    console.log('Accepting challenge - matchId:', matchId);
    console.log('Match data before update:', matchData);

    // Determine if I'm home or away
    const amHome = matchData.homeManager.uid === currentUser.uid;
    console.log('acceptMatchChallenge - currentUser.uid:', currentUser.uid);
    console.log('acceptMatchChallenge - homeManager.uid:', matchData.homeManager.uid);
    console.log('acceptMatchChallenge - awayManager.uid:', matchData.awayManager.uid);
    console.log('acceptMatchChallenge - amHome:', amHome);
    setIsHome(amHome);

    // Mark myself as ready (accepting the challenge)
    const myPath = amHome ? 'homeManager' : 'awayManager';
    await update(ref(database, `matches/${matchId}/${myPath}`), { ready: true });

    // Transition BOTH managers to prematch setup immediately
    await update(ref(database, `matches/${matchId}`), { state: 'prematch' });

    console.log('Updated Firebase to prematch state');

    // Reload the match data to get the complete updated state
    const updatedSnapshot = await get(matchRef);
    const updatedMatchData = updatedSnapshot.val();

    console.log('Updated match data:', updatedMatchData);

    // Set local state to prematch with complete data - IMPORTANT: include id!
    setCurrentMatch({ ...updatedMatchData, id: matchId });
    setMatchState('prematch');

    console.log('Local state updated to prematch');

    showAlert('Challenge Accepted!', 'Now set up your formation for the match.');
  };

  const loadActiveMatch = async (matchId) => {
    const matchRef = ref(database, `matches/${matchId}`);
    const snapshot = await get(matchRef);

    if (snapshot.exists()) {
      const matchData = snapshot.val();
      const amHome = matchData.homeManager.uid === currentUser.uid;
      console.log('loadActiveMatch - currentUser.uid:', currentUser.uid);
      console.log('loadActiveMatch - homeManager.uid:', matchData.homeManager?.uid);
      console.log('loadActiveMatch - awayManager.uid:', matchData.awayManager?.uid);
      console.log('loadActiveMatch - amHome:', amHome);
      setIsHome(amHome);
      // IMPORTANT: Add the id to the match object so the Firebase listener can work
      setCurrentMatch({ ...matchData, id: matchId });
      setMatchState(matchData.state);

      // If I'm the away manager and match is still in 'waiting' state, auto-accept it
      if (!amHome && matchData.state === 'waiting') {
        console.log('Auto-accepting challenge as away manager');
        acceptMatchChallenge(matchId);
      }
    }
  };

  // Listen for match updates when in a match
  useEffect(() => {
    if (!currentMatch?.id) return;

    console.log('Setting up Firebase listener for match:', currentMatch.id);
    const matchId = currentMatch.id; // Capture the id to avoid stale closure

    const matchRef = ref(database, `matches/${matchId}`);
    const unsubscribe = onValue(matchRef,
      async (snapshot) => {
        console.log('Firebase listener callback fired!'); // This should fire on EVERY change
        if (snapshot.exists()) {
          const matchData = snapshot.val();
          const previousState = previousMatchStateRef.current;

          console.log('Firebase listener triggered - minute:', matchData.minute, 'state:', matchData.state);

        // Update match state based on Firebase data
        setMatchState(matchData.state);
        previousMatchStateRef.current = matchData.state;
        setHomeScore(matchData.homeScore || 0);
        setAwayScore(matchData.awayScore || 0);
        setMinute(matchData.minute || 0);
        setEvents(matchData.events || []);
        // IMPORTANT: Preserve the id when updating from Firebase using captured matchId
        setCurrentMatch({ ...matchData, id: matchId });
        setHomePausesUsed(matchData.homePausesUsed || 0);
        setAwayPausesUsed(matchData.awayPausesUsed || 0);
        setHomeResumeReady(matchData.homeResumeReady || false);
        setAwayResumeReady(matchData.awayResumeReady || false);

        // Detect state change to 'playing' - start simulation if home manager
        console.log('Checking if should start simulation:', {
          'matchData.state': matchData.state,
          'previousState': previousState,
          'isHome': isHome,
          'condition': matchData.state === 'playing' && (previousState === 'ready' || previousState === 'prematch' || previousState === 'select' || previousState === 'waiting') && isHome
        });

        if (matchData.state === 'playing' && (previousState === 'ready' || previousState === 'prematch' || previousState === 'select' || previousState === 'waiting') && isHome) {
          console.log('Match state changed to playing - starting simulation');
          simulateMatch();
        }

        // Detect second half start - check for secondHalfStarted flag
        if (matchData.state === 'playing' && matchData.secondHalfStarted && isHome && !matchData.secondHalfSimulationStarted) {
          console.log('Second half starting - resuming simulation');
          console.log('Match data:', matchData);
          // Mark that second half simulation has started to avoid duplicate calls
          const matchRef = ref(database, `matches/${currentMatch.id}`);
          await update(matchRef, { secondHalfSimulationStarted: true });
          console.log('Second half simulation flag set, starting simulation');
          simulateSecondHalf();
        }

        // Check if match is finished
        if (matchData.state === 'finished' && matchState !== 'finished') {
          handleMatchFinished(matchData);
        }

        // Check for new goals and show celebration + shot animation (only if it's a new event)
        // SKIP for practice matches - they handle celebrations locally
        if (!matchData.isPractice && matchData.events && matchData.events.length > 0) {
          const latestEvent = matchData.events[0];
          if (latestEvent.includes('⚽ GOAL!') && latestEvent !== lastCelebratedEventRef.current) {
            // Extract scorer name from event
            const scorerMatch = latestEvent.match(/GOAL! ([^(]+)/);
            if (scorerMatch) {
              const scorerName = scorerMatch[1].trim();
              // Determine which team scored
              const isHomeGoal = matchData.homeManager.squad.some(p => latestEvent.includes(p.name));

              // Show goal celebration
              setGoalCelebration({ scorer: scorerName, team: isHomeGoal ? 'home' : 'away' });
              lastCelebratedEventRef.current = latestEvent; // Mark this event as celebrated

              // Trigger shot animation towards goal
              const shooterX = 40 + Math.random() * 20; // Attack zone X
              const shooterY = isHomeGoal ? 25 + Math.random() * 15 : 60 + Math.random() * 15; // Attack zone Y
              const goalX = 50; // Center of goal
              const goalY = isHomeGoal ? 2 : 98; // Top or bottom goal

              setShotAnimation({
                fromX: shooterX,
                fromY: shooterY,
                toX: goalX + (Math.random() - 0.5) * 10, // Slight variation
                toY: goalY,
                startTime: Date.now()
              });

              // Show dramatic goal moment overlay after shot reaches goal
              setTimeout(() => {
                setGoalMoment({
                  show: true,
                  scorer: scorerName,
                  team: isHomeGoal ? 'home' : 'away',
                  startTime: Date.now()
                });
                // Hide goal moment after 2.5 seconds
                setTimeout(() => setGoalMoment(null), 2500);
              }, 800); // Wait for shot animation to complete

              // Auto-hide celebration after 3 seconds
              setTimeout(() => setGoalCelebration(null), 3000);
              // Shot animation clears itself in renderPitch
            }
          }
        }
      } else {
        console.warn('Firebase listener: snapshot does not exist');
      }
    },
    (error) => {
      console.error('Firebase listener error:', error);
    });

    return () => {
      console.log('Cleaning up Firebase listener for match:', matchId);
      off(matchRef);
    };
  }, [currentMatch?.id, isHome]);

  // Handle pause countdown timer
  useEffect(() => {
    if (!currentMatch?.paused || !currentMatch?.pauseEndTime) {
      setPauseCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((currentMatch.pauseEndTime - Date.now()) / 1000));
      setPauseCountdown(remaining);

      if (remaining === 0 && currentMatch.paused) {
        // Auto-resume match when countdown ends (after 25 seconds)
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        update(matchRef, {
          paused: false,
          pausedBy: null,
          pauseReason: null,
          pauseEndTime: null,
          pauseStartTime: null,
          homeResumeReady: false,
          awayResumeReady: false
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentMatch?.paused, currentMatch?.pauseEndTime, currentMatch?.id]);

  // Check if both managers clicked resume
  useEffect(() => {
    if (currentMatch?.paused && homeResumeReady && awayResumeReady) {
      // Both managers ready - resume immediately
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      update(matchRef, {
        paused: false,
        pausedBy: null,
        pauseReason: null,
        pauseEndTime: null,
        pauseStartTime: null,
        homeResumeReady: false,
        awayResumeReady: false
      });
    }
  }, [currentMatch?.paused, homeResumeReady, awayResumeReady, currentMatch?.id]);

  // Initialize prematch state when entering waiting or prematch
  useEffect(() => {
    if ((matchState === 'waiting' || matchState === 'prematch') && currentMatch) {
      const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
      const mySquad = myTeam.squad;
      const myFormation = myTeam.formation || '4-3-3';
      setPrematchStarting11(mySquad.slice(0, 11));
      setPrematchFormation(myFormation);
    }
  }, [matchState, currentMatch, isHome]);

  // Load all live matches for spectator mode
  useEffect(() => {
    if (!currentUser) return;

    const matchesRef = ref(database, 'matches');

    const unsubscribe = onValue(matchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allMatches = [];
        const now = Date.now();
        const maxMatchAge = 3 * 60 * 60 * 1000; // 3 hours max

        snapshot.forEach(childSnapshot => {
          const match = childSnapshot.val();
          const matchAge = now - (match.createdAt || 0);

          // Only show matches that are:
          // 1. Currently playing or at halftime (truly live)
          // 2. Not involving the current user (exclude own matches)
          // 3. Not cancelled or finished
          // 4. Have a valid createdAt timestamp
          // 5. Are not older than 3 hours (to filter out stuck matches)
          if (
            (match.state === 'playing' || match.state === 'halftime') &&
            match.state !== 'cancelled' &&
            match.state !== 'finished' &&
            match.homeManager?.uid !== currentUser.uid &&
            match.awayManager?.uid !== currentUser.uid &&
            match.createdAt &&
            matchAge < maxMatchAge
          ) {
            allMatches.push({ id: childSnapshot.key, ...match });
          }
        });
        setLiveMatches(allMatches);
      } else {
        setLiveMatches([]);
      }
    });

    return () => off(matchesRef);
  }, [currentUser]);

  const loadFriends = async () => {
    if (!managerProfile?.friends || managerProfile.friends.length === 0) {
      setFriends([]);
      return;
    }

    const friendsData = [];
    for (const friendId of managerProfile.friends) {
      const friendRef = ref(database, `managers/${friendId}`);
      const snapshot = await get(friendRef);
      if (snapshot.exists()) {
        friendsData.push({ uid: friendId, ...snapshot.val() });
      }
    }
    setFriends(friendsData);
  };

  const challengeFriend = async (opponent) => {
    // Check if I'm already in an active match
    const matchesRef = ref(database, 'matches');
    const matchesSnapshot = await get(matchesRef);

    if (matchesSnapshot.exists()) {
      let myActiveMatch = null;
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

      matchesSnapshot.forEach(childSnapshot => {
        const match = childSnapshot.val();
        const matchAge = match.createdAt || 0;

        // Only consider matches created in the last 2 hours and not finished/forfeited
        if (
          matchAge > twoHoursAgo &&
          (match.state === 'waiting' || match.state === 'prematch' || match.state === 'ready' || match.state === 'playing' || match.state === 'halftime' || match.state === 'paused') &&
          (match.homeManager?.uid === currentUser.uid || match.awayManager?.uid === currentUser.uid)
        ) {
          myActiveMatch = { id: childSnapshot.key, ...match };
        }
      });

      if (myActiveMatch) {
        // If there's an active match, load it automatically so user can see and forfeit it
        const amHome = myActiveMatch.homeManager?.uid === currentUser.uid;
        setIsHome(amHome);
        setCurrentMatch(myActiveMatch);
        setMatchState(myActiveMatch.state);

        const opponent = amHome ? myActiveMatch.awayManager?.name : myActiveMatch.homeManager?.name;
        showAlert('Match in Progress', `You have an active match (${myActiveMatch.state}) vs ${opponent}. You can forfeit it using the button below.`);
        return;
      }
    }

    // Check if opponent is already in an active match
    if (matchesSnapshot.exists()) {
      let opponentActiveMatch = null;
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

      matchesSnapshot.forEach(childSnapshot => {
        const match = childSnapshot.val();
        const matchAge = match.createdAt || 0;

        // Only consider recent matches (last 2 hours) and not finished/forfeited
        if (
          matchAge > twoHoursAgo &&
          (match.state === 'waiting' || match.state === 'prematch' || match.state === 'ready' || match.state === 'playing' || match.state === 'halftime' || match.state === 'paused') &&
          (match.homeManager?.uid === opponent.uid || match.awayManager?.uid === opponent.uid)
        ) {
          opponentActiveMatch = match;
        }
      });

      if (opponentActiveMatch) {
        showAlert('Opponent Busy', `${opponent.managerName} is currently in another match. Please try again later.`);
        return;
      }
    }

    // Validate squads
    const myStarting = (managerProfile.squad || []).slice(0, 11);
    const opponentStarting = (opponent.squad || []).slice(0, 11);

    if (myStarting.length < 11) {
      showAlert('Not Enough Players', 'You need at least 11 players in your squad to play a match.');
      return;
    }

    if (opponentStarting.length < 11) {
      showAlert('Opponent Not Ready', 'Your opponent doesn\'t have enough players yet.');
      return;
    }

    // Create match in database
    const newMatchRef = push(matchesRef);
    const matchId = newMatchRef.key;

    const matchData = {
      id: matchId,
      homeManager: {
        uid: currentUser.uid,
        name: managerProfile.managerName,
        clubName: managerProfile.clubName || managerProfile.managerName,
        managerName: managerProfile.managerName,
        squad: myStarting,
        ready: false
      },
      awayManager: {
        uid: opponent.uid,
        name: opponent.managerName,
        clubName: opponent.clubName || opponent.managerName,
        managerName: opponent.managerName,
        squad: opponentStarting,
        ready: false
      },
      state: 'waiting',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      events: [],
      createdAt: Date.now()
    };

    await set(newMatchRef, matchData);

    console.log('Match created:', matchData);

    // Send notification to opponent
    const notificationRef = ref(database, `managers/${opponent.uid}/notifications`);
    await push(notificationRef, {
      type: 'match_challenge',
      from: currentUser.uid,
      fromName: managerProfile.managerName,
      matchId: matchId,
      message: `${managerProfile.managerName} challenges you to a match!`,
      timestamp: Date.now(),
      read: false
    });

    // Set local state to show waiting lobby
    console.log('Setting local state - matchData:', matchData);
    console.log('Has homeManager?', !!matchData.homeManager);
    console.log('Has awayManager?', !!matchData.awayManager);
    setCurrentMatch(matchData);
    setIsHome(true);
    setMatchState('waiting');
    console.log('State set to waiting');

    showAlert('Challenge Sent!', 'Waiting for opponent to accept...');
  };

  const startAIPracticeMatch = async () => {
    // Validate squad
    const myStarting = (managerProfile.squad || []).slice(0, 11);

    if (myStarting.length < 11) {
      showAlert('Not Enough Players', 'You need at least 11 players in your squad to play a match.');
      return;
    }

    // Generate AI team "Alkawaya Pro" with balanced squad
    const aiSquad = generateAISquad();

    // Generate random AI tactic
    const aiTactics = ['Defensive', 'Balanced', 'Attacking'];
    const randomAITactic = aiTactics[Math.floor(Math.random() * aiTactics.length)];

    // Create practice match (doesn't go to database, just local)
    const matchData = {
      id: `practice_${Date.now()}`,
      isPractice: true, // Mark as practice match
      homeManager: {
        uid: currentUser.uid,
        name: managerProfile.managerName,
        clubName: managerProfile.clubName || managerProfile.managerName,
        managerName: managerProfile.managerName,
        squad: myStarting,
        ready: true
      },
      awayManager: {
        uid: 'ai_alkawaya_pro',
        name: 'Alkawaya Pro',
        clubName: 'Alkawaya Pro FC',
        managerName: 'AI Coach',
        squad: aiSquad,
        ready: true
      },
      state: 'ready',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      events: [],
      homeTactic: 'Balanced',
      awayTactic: randomAITactic,
      createdAt: Date.now()
    };

    // Save practice match to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('practiceMatch', JSON.stringify(matchData));
      localStorage.setItem('practiceMatchState', 'ready');
      localStorage.setItem('activeMatchId', matchData.id); // Store as active match
    }

    setCurrentMatch(matchData);
    setIsHome(true);
    setMatchState('ready');
  };

  // Helper to save practice match to localStorage
  const savePracticeMatchToStorage = (matchData, state) => {
    if (typeof window !== 'undefined' && window.localStorage && matchData?.isPractice) {
      localStorage.setItem('practiceMatch', JSON.stringify(matchData));
      if (state) {
        localStorage.setItem('practiceMatchState', state);
      }
    }
  };

  // Helper to clear practice match from localStorage
  const clearPracticeMatchFromStorage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('practiceMatch');
      localStorage.removeItem('practiceMatchState');
    }
  };

  const generateAISquad = () => {
    // Generate a balanced AI team with overall ratings 70-80
    const positions = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'];
    return positions.map((pos, index) => ({
      id: `ai_player_${index}`,
      name: `AI Player ${index + 1}`,
      position: pos,
      overall: 70 + Math.floor(Math.random() * 11), // 70-80 rating
      age: 25,
      nationality: 'AI',
      price: 10000000
    }));
  };

  const forfeitMatch = async () => {
    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('Are you sure you want to forfeit this match? The opponent will win by default.');
      if (!confirmed) return;
    }

    if (!currentMatch.isPractice) {
      const matchRef = ref(database, `matches/${currentMatch.id}`);

      // Set final score based on who forfeited
      const finalHomeScore = isHome ? 0 : 3;
      const finalAwayScore = isHome ? 3 : 0;

      await update(matchRef, {
        state: 'finished',
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        minute: 90,
        events: [`${minute}' ⚠️ Match forfeited by ${isHome ? currentMatch.homeManager.name : currentMatch.awayManager.name}`, ...(currentMatch.events || [])],
        forfeitedBy: currentUser.uid,
        forfeitedAt: Date.now()
      });

      // Notify opponent
      const opponentUid = isHome ? currentMatch.awayManager.uid : currentMatch.homeManager.uid;
      const notificationRef = ref(database, `managers/${opponentUid}/notifications`);
      await push(notificationRef, {
        type: 'match_forfeit',
        message: `${managerProfile.managerName} forfeited the match. You win 3-0!`,
        timestamp: Date.now(),
        read: false
      });
    }

    // Clear practice match from localStorage if applicable
    if (currentMatch?.isPractice) {
      clearPracticeMatchFromStorage();
    }

    // Reset to selection screen
    setCurrentMatch(null);
    setMatchState('select');
    setHomeScore(0);
    setAwayScore(0);
    setMinute(0);
    setEvents([]);
    setSubstitutionMode(null);
    setSubstitutionsUsed(0);
  };

  const markReadyToKickoff = async () => {
    if (!currentMatch) return;

    // For practice matches, just start immediately (no Firebase)
    if (currentMatch.isPractice) {
      const updatedMatch = {
        ...currentMatch,
        state: 'playing',
        homeKickoffReady: true,
        awayKickoffReady: true,
        startedAt: Date.now(),
        minute: 0,
        second: 0
      };
      setCurrentMatch(updatedMatch);
      setMatchState('playing');
      savePracticeMatchToStorage(updatedMatch, 'playing');
      // Start simulation immediately for practice match
      simulatePracticeMatch();
      return;
    }

    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const snapshot = await get(matchRef);
    const matchData = snapshot.val();

    // Check if match is in ready state
    if (matchData.state !== 'ready') {
      return;
    }

    // Mark myself as ready for kickoff
    const readyField = isHome ? 'homeKickoffReady' : 'awayKickoffReady';
    await update(matchRef, { [readyField]: true });

    // Check if both are ready for kickoff
    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val();

    if (updatedMatch.homeKickoffReady && updatedMatch.awayKickoffReady) {
      // Both ready - start the match
      console.log('Both managers ready - transitioning to playing state');
      await update(matchRef, {
        state: 'playing',
        startedAt: Date.now(),
        minute: 0,
        second: 0
      });
      // The listener will detect the state change and start simulation
    }
  };

  // Calculate team strength based on player ratings
  const calculateTeamStrength = (squad) => {
    if (!squad || squad.length === 0) return 50;
    const avgRating = squad.reduce((sum, player) => sum + player.overall, 0) / squad.length;
    return avgRating;
  };

  // Simulate practice match locally (no Firebase)
  const simulatePracticeMatch = () => {
    console.log('Starting practice match simulation');

    let homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    let awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);

    // Track current tactics (can change during match)
    let currentHomeTactic = currentMatch.homeTactic || 'Balanced';
    let currentAwayTactic = currentMatch.awayTactic || 'Balanced';

    const applyTacticBonus = (strength, tactic) => {
      if (tactic === 'Attacking') {
        return strength * 1.15; // +15% attacking power
      } else if (tactic === 'Defensive') {
        return strength * 0.90; // -10% attacking power (more defensive)
      }
      return strength; // Balanced - no change
    };

    let currentSecond = 0;
    let localHomeScore = 0;
    let localAwayScore = 0;
    let localEvents = [];
    let localGoalscorers = {};
    let localBallPossession = 'home'; // Home team starts with kickoff
    let localBallHolder = null;

    const interval = setInterval(() => {
      currentSecond++;
      const matchMinute = Math.floor(currentSecond / (120 / 90)); // 120 seconds = 90 minutes

      setMinute(matchMinute);

      // AI tactical changes at certain minutes (20, 40, 60, 70)
      if ([20, 40, 60, 70].includes(matchMinute) && Math.random() < 0.4) { // 40% chance to change
        const tactics = ['Defensive', 'Balanced', 'Attacking'];
        const newAITactic = tactics[Math.floor(Math.random() * tactics.length)];
        if (newAITactic !== currentAwayTactic) {
          currentAwayTactic = newAITactic;
          const eventText = `${matchMinute}' 📋 Alkawaya Pro changes tactics to ${newAITactic}`;
          localEvents = [eventText, ...localEvents];
          setEvents(localEvents);
          console.log('AI changed tactic:', newAITactic);
        }
      }

      // Recalculate strengths with current tactics
      const adjustedHomeStrength = applyTacticBonus(homeStrength, currentHomeTactic);
      const adjustedAwayStrength = applyTacticBonus(awayStrength, currentAwayTactic);
      const totalStrength = adjustedHomeStrength + adjustedAwayStrength;
      const homeChance = (adjustedHomeStrength / totalStrength) * 0.55 + 0.05;

      // Enhanced match events with all new mechanics
      const eventRoll = Math.random();

      if (eventRoll < 0.04) {
        // GOAL EVENT (4% chance) - VISUAL SEQUENCE: Shot → Goal announcement
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;
        const opposingTeam = isHomeGoal ? currentMatch.awayManager : currentMatch.homeManager;

        // Enhanced realistic goal scoring - weight by position AND overall rating
        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const attackingMids = team.squad.filter(p => ['CAM', 'CM'].includes(p.position));
        const wideMids = team.squad.filter(p => ['LM', 'RM', 'LWB', 'RWB'].includes(p.position));
        const defensiveMids = team.squad.filter(p => ['CDM'].includes(p.position));
        const defenders = team.squad.filter(p => ['CB', 'LB', 'RB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();

        if (scorerRoll < 0.60 && attackers.length > 0) {
          const weightedAttackers = attackers.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedAttackers.sort((a, b) => b.weight - a.weight);
          scorer = weightedAttackers[0].player;
        } else if (scorerRoll < 0.80 && attackingMids.length > 0) {
          const weightedMids = attackingMids.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedMids.sort((a, b) => b.weight - a.weight);
          scorer = weightedMids[0].player;
        } else if (scorerRoll < 0.90 && wideMids.length > 0) {
          scorer = wideMids[Math.floor(Math.random() * wideMids.length)];
        } else if (scorerRoll < 0.96 && defenders.length > 0) {
          const sortedDefenders = [...defenders].sort((a, b) => b.overall - a.overall);
          scorer = sortedDefenders[0];
        } else if (scorerRoll < 0.99 && defensiveMids.length > 0) {
          scorer = defensiveMids[Math.floor(Math.random() * defensiveMids.length)];
        } else {
          const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        const scorerName = scorer.name;
        const goalTypes = ['powerful strike', 'clinical finish', 'stunning goal', 'brilliant header', 'precision shot', 'unstoppable effort'];
        const goalType = goalTypes[Math.floor(Math.random() * goalTypes.length)];

        // STEP 1: Update ball holder to shooter BEFORE shot
        localBallHolder = { playerId: scorer.id, playerName: scorer.name, team: isHomeGoal ? 'home' : 'away' };
        setBallHolder(localBallHolder);

        // STEP 2: Show "Player shoots!" event immediately
        const shootEvent = `${matchMinute}' ⚽ ${scorer.name} shoots!`;
        localEvents = [shootEvent, ...localEvents];
        setEvents(localEvents);

        // STEP 3: Trigger shot animation from realistic shooter position
        // Calculate approximate position based on scorer's role
        let shooterX = 50; // Center by default
        let shooterY = isHomeGoal ? 70 : 30; // Attacking third

        // Adjust position based on player position
        if (scorer.position === 'ST') {
          shooterX = 50; // Center striker
          shooterY = isHomeGoal ? 25 : 75;
        } else if (scorer.position === 'LW') {
          shooterX = 30; // Left wing
          shooterY = isHomeGoal ? 30 : 70;
        } else if (scorer.position === 'RW') {
          shooterX = 70; // Right wing
          shooterY = isHomeGoal ? 30 : 70;
        } else if (['CAM', 'CM'].includes(scorer.position)) {
          shooterX = 50; // Central
          shooterY = isHomeGoal ? 45 : 55;
        }

        const shooterPosition = { x: shooterX, y: shooterY };

        const goalX = 50;
        const goalY = isHomeGoal ? 2 : 98;

        setShotAnimation({
          fromX: shooterPosition.x,
          fromY: shooterPosition.y,
          toX: goalX + (Math.random() - 0.5) * 8,
          toY: goalY,
          startTime: Date.now()
        });

        // STEP 4: AFTER shot animation completes (1200ms), announce GOAL!
        setTimeout(() => {
          // Update score
          if (isHomeGoal) {
            localHomeScore++;
            setHomeScore(localHomeScore);
          } else {
            localAwayScore++;
            setAwayScore(localAwayScore);
          }

          // Add GOAL! event
          const eventText = `${matchMinute}' ⚽⚽ GOAAAAL! ${scorerName} (${scorer.overall}) with a ${goalType}!`;
          localEvents = [eventText, ...localEvents];
          setEvents(localEvents);

          // Track goalscorer for XP
          if (!localGoalscorers[scorer.id]) {
            localGoalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
          }
          localGoalscorers[scorer.id].goals++;

          // After goal, reset to kickoff
          localBallPossession = isHomeGoal ? 'away' : 'home';
          localBallHolder = null;
          setBallPossession(localBallPossession);
          setBallHolder(null);

          // Show celebration
          setGoalCelebration({ scorer: scorerName, team: isHomeGoal ? 'home' : 'away' });

          // Show goal moment overlay
          setGoalMoment({
            show: true,
            scorer: scorerName,
            team: isHomeGoal ? 'home' : 'away',
            startTime: Date.now()
          });
          setTimeout(() => setGoalMoment(null), 2500);

          // Auto-hide celebration
          setTimeout(() => setGoalCelebration(null), 3000);

          console.log('GOAL!', eventText);
        }, 1200); // Wait for shot to reach goal (1200ms)
      } else if (eventRoll < 0.10) {
        // SHOT/SAVE EVENT (6% chance)
        const teamRoll = Math.random();
        const isHomeShot = teamRoll < 0.5;
        const attackingTeam = isHomeShot ? currentMatch.homeManager : currentMatch.awayManager;
        const defendingTeam = isHomeShot ? currentMatch.awayManager : currentMatch.homeManager;

        // Prefer ball holder for shooting
        let shooter;
        if (localBallHolder && localBallHolder.team === (isHomeShot ? 'home' : 'away')) {
          const ballHolderPlayer = attackingTeam.squad.find(p => p.id === localBallHolder.playerId);
          if (ballHolderPlayer && ['ST', 'LW', 'RW', 'CAM'].includes(ballHolderPlayer.position)) {
            shooter = ballHolderPlayer;
          }
        }

        if (!shooter) {
          const shooters = attackingTeam.squad.filter(p => ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(p.position));
          if (shooters.length > 0) {
            const strikers = shooters.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
            if (strikers.length > 0 && Math.random() < 0.7) {
              shooter = strikers[Math.floor(Math.random() * strikers.length)];
            } else {
              shooter = shooters[Math.floor(Math.random() * shooters.length)];
            }
          }
        }

        if (shooter) {
          const gk = defendingTeam.squad.find(p => p.position === 'GK');
          const shotAccuracy = 0.65 + (shooter.overall / 100) * 0.25;
          const shotOnTarget = Math.random() < shotAccuracy;

          // Calculate shooter and goal positions
          const isHomeGoal = !isHomeShot;
          const goalX = 50;
          const goalY = isHomeGoal ? 5 : 95;

          let shooterX = 50;
          let shooterY = isHomeShot ? 30 : 70;

          if (shooter.position === 'ST') {
            shooterX = 50;
            shooterY = isHomeShot ? 25 : 75;
          } else if (shooter.position === 'LW') {
            shooterX = 30;
            shooterY = isHomeShot ? 30 : 70;
          } else if (shooter.position === 'RW') {
            shooterX = 70;
            shooterY = isHomeShot ? 30 : 70;
          } else if (['CAM', 'CM'].includes(shooter.position)) {
            shooterX = 50;
            shooterY = isHomeShot ? 45 : 55;
          }

          // Update ball holder to shooter BEFORE shot
          localBallHolder = { playerId: shooter.id, playerName: shooter.name, team: isHomeShot ? 'home' : 'away' };
          setBallHolder(localBallHolder);

          if (!shotOnTarget) {
            // Show shoot event
            const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
            localEvents = [shootEvent, ...localEvents];
            setEvents(localEvents);

            // Trigger shot animation going wide/over
            setShotAnimation({
              fromX: shooterX,
              fromY: shooterY,
              toX: goalX + (Math.random() - 0.5) * 30,  // Much wider miss
              toY: goalY + (Math.random() < 0.5 ? -8 : 8),  // Over or wide
              startTime: Date.now(),
              isSave: true
            });

            setTimeout(() => {
              const missTypes = ['shoots wide', 'blasts over the bar', 'misses the target'];
              const missType = missTypes[Math.floor(Math.random() * missTypes.length)];
              const eventText = `${matchMinute}' 📍 ${shooter.name} ${missType}!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);

              localBallHolder = null;
              setBallHolder(null);
            }, 1200);
          } else if (gk) {
            const baseSaveChance = 0.60;
            const gkBonus = (gk.overall - 75) / 100;
            const shooterPenalty = (shooter.overall - 75) / 100;
            const saveChance = Math.max(0.30, Math.min(0.85, baseSaveChance + gkBonus - shooterPenalty));
            const isSaved = Math.random() < saveChance;

            // Calculate shooter and goal positions for shot animation
            const isHomeGoal = !isHomeShot;
            const goalX = 50;
            const goalY = isHomeGoal ? 5 : 95;

            let shooterX = 50;
            let shooterY = isHomeShot ? 30 : 70;

            if (shooter.position === 'ST') {
              shooterX = 50;
              shooterY = isHomeShot ? 25 : 75;
            } else if (shooter.position === 'LW') {
              shooterX = 30;
              shooterY = isHomeShot ? 30 : 70;
            } else if (shooter.position === 'RW') {
              shooterX = 70;
              shooterY = isHomeShot ? 30 : 70;
            } else if (['CAM', 'CM'].includes(shooter.position)) {
              shooterX = 50;
              shooterY = isHomeShot ? 45 : 55;
            }

            // Update ball holder to shooter BEFORE shot animation
            localBallHolder = { playerId: shooter.id, playerName: shooter.name, team: isHomeShot ? 'home' : 'away' };
            setBallHolder(localBallHolder);

            if (isSaved) {
              // Show "shoots!" event first
              const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
              localEvents = [shootEvent, ...localEvents];
              setEvents(localEvents);

              // Trigger shot animation
              setShotAnimation({
                fromX: shooterX,
                fromY: shooterY,
                toX: goalX + (Math.random() - 0.5) * 12,
                toY: goalY,
                startTime: Date.now(),
                isSave: true  // Mark as save so we can show it differently
              });

              // After shot completes, show save message
              setTimeout(() => {
                const saveTypes = ['makes a brilliant save', 'denies with a diving save', 'pulls off a great save', 'catches confidently'];
                const saveType = saveTypes[Math.floor(Math.random() * saveTypes.length)];
                const eventText = `${matchMinute}' 🧤 ${gk.name} ${saveType}! ${shooter.name} denied.`;
                localEvents = [eventText, ...localEvents];
                setEvents(localEvents);

                // Clear ball holder after save
                localBallHolder = null;
                setBallHolder(null);
              }, 1200);
            } else {
              // Close call - shot animation but just misses
              const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
              localEvents = [shootEvent, ...localEvents];
              setEvents(localEvents);

              setShotAnimation({
                fromX: shooterX,
                fromY: shooterY,
                toX: goalX + (Math.random() - 0.5) * 15,
                toY: goalY + (Math.random() < 0.5 ? -3 : 3),  // Slightly off target
                startTime: Date.now(),
                isSave: true
              });

              setTimeout(() => {
                const closeCallTypes = ['shot saved at the near post', 'tips it over the bar', 'makes a fingertip save'];
                const closeCall = closeCallTypes[Math.floor(Math.random() * closeCallTypes.length)];
                const eventText = `${matchMinute}' 😰 Close call! ${gk.name} ${closeCall}! ${shooter.name} almost scored!`;
                localEvents = [eventText, ...localEvents];
                setEvents(localEvents);

                localBallHolder = null;
                setBallHolder(null);
              }, 1200);
            }
          } else {
            const eventText = `${matchMinute}' 🛡️ ${shooter.name}'s shot is blocked by the defense!`;
            localEvents = [eventText, ...localEvents];
            setEvents(localEvents);
          }
        }
      } else if (eventRoll < 0.15) {
        // DEFENSIVE EVENT (5% chance)
        const isHome = localBallPossession === 'away';
        const defendingTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
        const attackingTeam = isHome ? currentMatch.awayManager : currentMatch.homeManager;
        const defendingTeamName = isHome ? 'home' : 'away';

        const defenders = defendingTeam.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position));

        if (defenders.length > 0) {
          const defender = defenders[Math.floor(Math.random() * defenders.length)];
          const tackleSuccess = 0.55 + (defender.overall / 100) * 0.25;
          const isSuccessful = Math.random() < tackleSuccess;

          if (isSuccessful) {
            const tackleTypes = ['wins the ball with a strong tackle', 'intercepts brilliantly', 'makes a crucial tackle', 'reads the play perfectly'];
            const tackleType = tackleTypes[Math.floor(Math.random() * tackleTypes.length)];
            const eventText = `${matchMinute}' 🛡️ ${defender.name} ${tackleType}!`;
            localEvents = [eventText, ...localEvents];
            setEvents(localEvents);

            localBallPossession = defendingTeamName;
            localBallHolder = { playerId: defender.id, playerName: defender.name, team: defendingTeamName };
            setBallPossession(localBallPossession);
            setBallHolder(localBallHolder);
          } else {
            const attacker = attackingTeam.squad.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position))[0];
            if (attacker) {
              const eventText = `${matchMinute}' 💨 ${attacker.name} evades ${defender.name}'s challenge!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            }
          }
        }
      } else if (eventRoll < 0.23) {
        // PASS EVENT (8% chance)
        const teamRoll = Math.random();
        const isHome = teamRoll < 0.5;
        const team = isHome ? currentMatch.homeManager : currentMatch.awayManager;
        const teamName = isHome ? 'home' : 'away';

        const passers = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM', 'CB', 'LB', 'RB'].includes(p.position));

        if (passers.length > 0) {
          const passer = passers[Math.floor(Math.random() * passers.length)];
          const receivers = team.squad.filter(p => p.id !== passer.id && p.position !== 'GK');

          if (receivers.length > 0) {
            // Make passes more logical based on passer's position
            const attackers = receivers.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
            const mids = receivers.filter(p => ['CAM', 'CM', 'LM', 'RM'].includes(p.position));
            const defenders = receivers.filter(p => ['CB', 'LB', 'RB', 'CDM'].includes(p.position));

            let receiver;
            const receiverRoll = Math.random();

            // Progressive passing based on passer position
            if (['ST', 'LW', 'RW'].includes(passer.position)) {
              // Attackers: prefer other attackers or attacking mids (no sudden passes to defense)
              if (receiverRoll < 0.40 && attackers.length > 0) {
                receiver = attackers[Math.floor(Math.random() * attackers.length)];
              } else if (mids.length > 0) {
                receiver = mids[Math.floor(Math.random() * mids.length)];
              } else {
                receiver = attackers.length > 0 ? attackers[0] : receivers[0];
              }
            } else if (['CAM', 'CM', 'LM', 'RM'].includes(passer.position)) {
              // Midfielders: can pass forward to attackers or sideways/back to other mids
              if (receiverRoll < 0.45 && attackers.length > 0) {
                receiver = attackers[Math.floor(Math.random() * attackers.length)];
              } else if (receiverRoll < 0.85 && mids.length > 0) {
                receiver = mids[Math.floor(Math.random() * mids.length)];
              } else if (defenders.length > 0) {
                receiver = defenders[Math.floor(Math.random() * defenders.length)];
              } else {
                receiver = receivers[Math.floor(Math.random() * receivers.length)];
              }
            } else {
              // Defenders: prefer passing to midfielders or other defenders (build from back)
              if (receiverRoll < 0.50 && mids.length > 0) {
                receiver = mids[Math.floor(Math.random() * mids.length)];
              } else if (receiverRoll < 0.85 && defenders.length > 0) {
                receiver = defenders[Math.floor(Math.random() * defenders.length)];
              } else if (attackers.length > 0) {
                // Occasional long ball forward
                receiver = attackers[Math.floor(Math.random() * attackers.length)];
              } else {
                receiver = receivers[Math.floor(Math.random() * receivers.length)];
              }
            }

            const passAccuracy = 0.75 + (passer.overall / 100) * 0.20;
            const passSuccess = Math.random() < passAccuracy;

            if (passSuccess) {
              localBallPossession = teamName;
              localBallHolder = { playerId: receiver.id, playerName: receiver.name, team: teamName };
              setBallPossession(localBallPossession);
              setBallHolder(localBallHolder);

              const eventText = `${matchMinute}' ⚡ ${passer.name} → ${receiver.name} - excellent pass forward!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            } else {
              const eventText = `${matchMinute}' ❌ ${passer.name}'s pass is intercepted!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
              localBallPossession = isHome ? 'away' : 'home';
              localBallHolder = null;
              setBallPossession(localBallPossession);
              setBallHolder(null);
            }
          }
        }
      }

      // Half time at 60 seconds (45 match minutes)
      if (currentSecond === 60) {
        console.log('Half time reached in practice match');
        clearInterval(interval);
        setCurrentMatch({
          ...currentMatch,
          state: 'halftime',
          homeScore: localHomeScore,
          awayScore: localAwayScore,
          minute: matchMinute,
          events: localEvents,
          goalscorers: localGoalscorers,
          homeTactic: currentHomeTactic,
          awayTactic: currentAwayTactic
        });
        setMatchState('halftime');
      }

      // Full time at 120 seconds (90 match minutes)
      if (currentSecond === 120) {
        console.log('Full time reached in practice match');
        clearInterval(interval);
        finishPracticeMatch(localHomeScore, localAwayScore, localEvents, localGoalscorers);
      }
    }, 1000);
  };

  // Finish practice match and award XP only
  const finishPracticeMatch = async (finalHomeScore, finalAwayScore, matchEvents, goalscorers) => {
    const homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    const awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);

    const playerWon = finalHomeScore > finalAwayScore;
    const isDraw = finalHomeScore === finalAwayScore;

    // Generate match report
    let matchReport = '';
    if (playerWon) {
      matchReport = `${currentMatch.homeManager.name} won ${finalHomeScore}-${finalAwayScore} in practice. `;
      if (homeStrength > awayStrength + 3) {
        matchReport += 'Good warm-up against weaker opposition.';
      } else {
        matchReport += 'Excellent practice session with good results.';
      }
    } else if (finalAwayScore > finalHomeScore) {
      matchReport = `Alkawaya Pro won ${finalAwayScore}-${finalHomeScore}. A tough practice match - room for improvement.`;
    } else {
      matchReport = `Practice match ended ${finalHomeScore}-${finalAwayScore}. Good training session.`;
    }

    setCurrentMatch({
      ...currentMatch,
      state: 'finished',
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      events: matchEvents,
      goalscorers,
      matchReport,
      homeStrength: homeStrength.toFixed(1),
      awayStrength: awayStrength.toFixed(1),
      finishedAt: Date.now()
    });
    setMatchState('finished');

    const managerRef = ref(database, `managers/${currentUser.uid}`);
    const managerSnapshot = await get(managerRef);

    if (managerSnapshot.exists()) {
      const managerData = managerSnapshot.val();
      let totalPlayerXP = 0;
      let clubFacilitiesXP = 0;

      // Award XP to goalscorers (player training XP)
      const updatedSquad = (managerData.squad || []).map(player => {
        const scorerData = goalscorers[player.id];
        if (scorerData && scorerData.managerId === currentUser.uid) {
          const xpEarned = scorerData.goals * 50;
          totalPlayerXP += xpEarned;
          return {
            ...player,
            xp: (player.xp || 0) + xpEarned
          };
        }
        return player;
      });

      // Award club facilities XP for winning or drawing
      if (playerWon) {
        clubFacilitiesXP = 100; // Win: 100 XP
      } else if (isDraw) {
        clubFacilitiesXP = 50; // Draw: 50 XP
      }
      // Loss: 0 XP

      const currentClubXP = managerData.clubFacilitiesXP || 0;
      const newClubXP = currentClubXP + clubFacilitiesXP;

      // Award money and victory XP for winning
      let moneyEarned = 0;
      let victoryXP = 0;
      let finalSquad = updatedSquad;

      if (playerWon) {
        const stadiumLevel = managerData.facilities?.stadium || 0;

        // Base match winnings: $2M guaranteed
        const baseWinnings = 2000000;

        // Stadium bonus revenue
        const stadiumBonuses = [
          0,          // No stadium (level 0) - only base
          2000000,    // Level 1: +$2M bonus = $4M total
          5000000,    // Level 2: +$5M bonus = $7M total
          10000000,   // Level 3: +$10M bonus = $12M total
          20000000    // Level 4: +$20M bonus = $22M total
        ];

        const stadiumBonus = stadiumBonuses[stadiumLevel] || 0;
        moneyEarned = baseWinnings + stadiumBonus;

        // Award victory XP to all players (100 XP each)
        victoryXP = 100;
        finalSquad = finalSquad.map(player => ({
          ...player,
          xp: (player.xp || 0) + victoryXP
        }));
      }

      const newBudget = (managerData.budget || 0) + moneyEarned;

      // Update manager profile with new squad, club XP, and budget
      await update(managerRef, {
        squad: finalSquad,
        clubFacilitiesXP: newClubXP,
        budget: newBudget
      });

      console.log(`Practice match rewards - Player XP: ${totalPlayerXP}, Victory XP: ${victoryXP * finalSquad.length}, Club Facilities XP: ${clubFacilitiesXP}, Money: $${moneyEarned}`);

      // Show detailed results
      let rewardMessage = '';
      if (totalPlayerXP > 0) {
        rewardMessage += `⚽ Goalscorers earned ${totalPlayerXP} XP for training!\n`;
      }
      if (playerWon && victoryXP > 0) {
        rewardMessage += `⭐ All players gained +${victoryXP} XP (WIN)!\n`;
      }
      if (clubFacilitiesXP > 0) {
        rewardMessage += `🏗️ Club earned ${clubFacilitiesXP} Facilities XP ${playerWon ? '(WIN)' : '(DRAW)'}!\n`;
      }
      if (moneyEarned > 0) {
        const stadiumLevel = managerData.facilities?.stadium || 0;
        rewardMessage += `\n💰 Match Winnings: $${(2000000 / 1000000).toFixed(1)}M\n`;
        if (stadiumLevel > 0) {
          rewardMessage += `🏟️ Stadium Bonus (Lv.${stadiumLevel}): +$${((moneyEarned - 2000000) / 1000000).toFixed(1)}M\n`;
        }
        rewardMessage += `💵 Total Earned: $${(moneyEarned / 1000000).toFixed(1)}M`;
      }
      if (!rewardMessage) {
        rewardMessage = 'No rewards earned. Try scoring goals and winning!';
      } else if (moneyEarned === 0) {
        rewardMessage += '\n💡 Win matches to earn money and more XP!';
      }

      showAlert('Practice Match Complete', rewardMessage);
    }

    // Note: localStorage cleanup is handled when user clicks back from finished screen
  };

  const simulateMatch = async (matchData) => {
    const match = matchData || currentMatch;
    if (!match) {
      console.error('No match data available for simulation');
      return;
    }

    console.log('Starting match simulation for match:', match.id);
    const matchRef = ref(database, `matches/${match.id}`);

    // Set match start time for server-side time tracking
    const now = Date.now();
    if (!match.matchStartTime) {
      await update(matchRef, {
        matchStartTime: now,
        lastUpdateTime: now,
        ballPossession: 'home', // Home team starts with kickoff
        ballHolder: null
      });
    }

    // Enhanced team strength calculation with formation and tactics consideration
    let homeStrength = calculateTeamStrength(match.homeManager.squad);
    let awayStrength = calculateTeamStrength(match.awayManager.squad);

    // Apply formation bonuses - more attackers = higher attack strength
    const homeFormation = match.homeManager.formation || '4-3-3';
    const awayFormation = match.awayManager.formation || '4-3-3';

    const formationBonus = (formation) => {
      const formationMultipliers = {
        '4-3-3': 1.05,  // Balanced attacking
        '4-4-2': 1.0,   // Standard balanced
        '3-5-2': 1.02,  // Slight attacking edge
        '4-2-3-1': 1.03, // Good attacking structure
        '3-4-3': 1.08   // Very attacking
      };
      return formationMultipliers[formation] || 1.0;
    };

    homeStrength *= formationBonus(homeFormation);
    awayStrength *= formationBonus(awayFormation);

    // Apply tactic bonuses with more realistic impact
    const homeTactic = match.homeTactic || 'Balanced';
    const awayTactic = match.awayTactic || 'Balanced';

    // Attacking: +20% goal scoring chance, riskier defense
    // Defensive: +10% defensive stability, -15% goal scoring
    // Balanced: no change
    const applyTacticBonus = (strength, tactic) => {
      if (tactic === 'Attacking') {
        return strength * 1.20; // +20% attacking power
      } else if (tactic === 'Defensive') {
        return strength * 0.85; // Reduce attacking threat
      }
      return strength; // Balanced - no change
    };

    homeStrength = applyTacticBonus(homeStrength, homeTactic);
    awayStrength = applyTacticBonus(awayStrength, awayTactic);

    console.log('Team strengths - Home:', homeStrength, '(', homeTactic, ') Away:', awayStrength, '(', awayTactic, ')');

    if (homeStrength === 0 || awayStrength === 0) {
      console.error('Squad strength is 0, cannot simulate match');
      return;
    }

    const totalStrength = homeStrength + awayStrength;

    // Enhanced win probability calculation with more realistic outcomes
    // Based on real football statistics and team quality differences
    const strengthRatio = homeStrength / awayStrength;
    let homeChance, awayChance;

    // More sophisticated probability model
    if (strengthRatio > 1.5) {
      // Home team much stronger (e.g., 85 vs 75 overall)
      homeChance = 0.70 + Math.min(0.15, (strengthRatio - 1.5) * 0.25); // 70-85%
    } else if (strengthRatio > 1.2) {
      // Home team stronger (e.g., 82 vs 78 overall)
      homeChance = 0.60 + (strengthRatio - 1.2) * 0.30; // 60-70%
    } else if (strengthRatio < 0.67) {
      // Away team much stronger
      homeChance = 0.15 + Math.max(0, (strengthRatio - 0.5) * 0.2); // 15-18%
    } else if (strengthRatio < 0.83) {
      // Away team stronger
      homeChance = 0.30 - (0.83 - strengthRatio) * 0.4; // 25-30%
    } else {
      // Teams evenly matched - home advantage + quality difference
      const baseChance = homeStrength / totalStrength; // Pure strength ratio
      const homeAdvantage = 0.08; // 8% home advantage bonus
      homeChance = baseChance + homeAdvantage;
    }

    // Ensure probability bounds
    homeChance = Math.max(0.10, Math.min(0.90, homeChance));
    awayChance = 1 - homeChance;

    console.log('Enhanced goal probability - Home:', (homeChance * 100).toFixed(1), '% Away:', (awayChance * 100).toFixed(1), '%');

    let currentSecond = 0;

    console.log('Setting up match interval...');
    const interval = setInterval(async () => {
      try {
        // Check if match is paused or finished
        const currentData = (await get(matchRef)).val();

        // Check if match is already finished (safety check)
        if (currentData.state === 'finished') {
          console.log('Match is already finished, stopping simulation');
          clearInterval(interval);
          return;
        }

        if (currentData.paused) {
          console.log('Match is paused, skipping simulation tick');
          return;
        }

        // Server-side time synchronization - calculate actual elapsed time
        if (currentData.matchStartTime) {
          const elapsedMs = Date.now() - currentData.matchStartTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);

          // Fast-forward to current time if client fell behind
          if (elapsedSeconds > currentSecond) {
            console.log(`Fast-forwarding from second ${currentSecond} to ${elapsedSeconds}`);
            currentSecond = Math.min(elapsedSeconds, 120); // Cap at 120 seconds (full time)
          }
        }

        currentSecond++;

        // Safety check: if we're past 120 seconds, finish immediately
        if (currentSecond > 120) {
          console.log('Match exceeded 120 seconds, finishing now');
          clearInterval(interval);
          await finishMatch();
          return;
        }

        // Convert seconds to match minutes (120 seconds = 90 minutes)
        const matchMinute = Math.floor(currentSecond / (120 / 90));

        console.log(`Match second ${currentSecond}, minute ${matchMinute}`);

        // Generate match events - goals, passes, shots, saves
        const eventRoll = Math.random();

        // Get latest match data including substituted players list
        const latestData = (await get(matchRef)).val();
        const substitutedPlayers = latestData.substitutedPlayers || [];

        if (eventRoll < 0.04) {
          // GOAL EVENT (4% chance) - VISUAL SEQUENCE: Shot → Goal announcement
          const teamRoll = Math.random();
          const isHomeGoal = teamRoll < homeChance;
          const team = isHomeGoal ? match.homeManager : match.awayManager;
          const opposingTeam = isHomeGoal ? match.awayManager : match.homeManager;

          // Filter out substituted players
          const availablePlayers = team.squad.filter(p => !substitutedPlayers.includes(p.id));

          // Enhanced realistic goal scoring - weight by position AND overall rating
          const attackers = availablePlayers.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
          const attackingMids = availablePlayers.filter(p => ['CAM', 'CM'].includes(p.position));
          const wideMids = availablePlayers.filter(p => ['LM', 'RM', 'LWB', 'RWB'].includes(p.position));
          const defensiveMids = availablePlayers.filter(p => ['CDM'].includes(p.position));
          const defenders = availablePlayers.filter(p => ['CB', 'LB', 'RB'].includes(p.position));

          let scorer;
          const scorerRoll = Math.random();

          // Weighted scoring based on realistic probabilities and player quality
          if (scorerRoll < 0.60 && attackers.length > 0) {
            const weightedAttackers = attackers.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
            weightedAttackers.sort((a, b) => b.weight - a.weight);
            scorer = weightedAttackers[0].player;
          } else if (scorerRoll < 0.80 && attackingMids.length > 0) {
            const weightedMids = attackingMids.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
            weightedMids.sort((a, b) => b.weight - a.weight);
            scorer = weightedMids[0].player;
          } else if (scorerRoll < 0.90 && wideMids.length > 0) {
            scorer = wideMids[Math.floor(Math.random() * wideMids.length)];
          } else if (scorerRoll < 0.96 && defenders.length > 0) {
            const sortedDefenders = [...defenders].sort((a, b) => b.overall - a.overall);
            scorer = sortedDefenders[0];
          } else if (scorerRoll < 0.99 && defensiveMids.length > 0) {
            scorer = defensiveMids[Math.floor(Math.random() * defensiveMids.length)];
          } else {
            const outfieldPlayers = availablePlayers.filter(p => p.position !== 'GK');
            scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
          }

          const goalTypes = ['powerful strike', 'clinical finish', 'stunning goal', 'brilliant header', 'precision shot', 'unstoppable effort'];
          const goalType = goalTypes[Math.floor(Math.random() * goalTypes.length)];

          // STEP 1: Show "shoots!" event immediately
          const shootEvent = `${matchMinute}' ⚽ ${scorer.name} shoots!`;
          await update(matchRef, {
            events: [shootEvent, ...(latestData.events || [])],
            ballHolder: { playerId: scorer.id, playerName: scorer.name, team: isHomeGoal ? 'home' : 'away' }
          });

          // STEP 2: Wait for shot animation (1200ms), then announce GOAL!
          await new Promise(resolve => setTimeout(resolve, 1200));

          // STEP 3: Update score and add GOAL! event
          const newScore = isHomeGoal
            ? { homeScore: (latestData.homeScore || 0) + 1 }
            : { awayScore: (latestData.awayScore || 0) + 1 };

          const eventText = `${matchMinute}' ⚽⚽ GOAAAAL! ${scorer.name} (${scorer.overall}) with a ${goalType}!`;

          // Track goalscorer for XP rewards
          const goalscorers = latestData.goalscorers || {};
          if (!goalscorers[scorer.id]) {
            goalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
          }
          goalscorers[scorer.id].goals++;

          // Get current events and prepend GOAL event
          const currentEvents = (await get(matchRef)).val().events || [];
          const newEvents = [eventText, ...currentEvents];

          // After goal, reset to kickoff - conceding team gets possession
          const kickoffTeam = isHomeGoal ? 'away' : 'home';
          await update(matchRef, {
            ...newScore,
            events: newEvents,
            goalscorers,
            ballPossession: kickoffTeam,
            ballHolder: null
          });

          console.log('GOAL!', eventText);
        } else if (eventRoll < 0.10) {
          // SHOT/SAVE EVENT (6% chance) - Enhanced with accuracy and GK save mechanics
          const teamRoll = Math.random();
          const isHomeShot = teamRoll < 0.5;
          const attackingTeam = isHomeShot ? match.homeManager : match.awayManager;
          const defendingTeam = isHomeShot ? match.awayManager : match.homeManager;

          const availablePlayers = attackingTeam.squad.filter(p => !substitutedPlayers.includes(p.id));

          // Prefer shooters in attacking positions, especially if they have the ball
          const currentBallHolder = latestData.ballHolder;
          let shooter;

          if (currentBallHolder && currentBallHolder.team === (isHomeShot ? 'home' : 'away')) {
            // If ball holder is in good shooting position (striker or attacking player), they shoot
            const ballHolderPlayer = availablePlayers.find(p => p.id === currentBallHolder.playerId);
            if (ballHolderPlayer && ['ST', 'LW', 'RW', 'CAM'].includes(ballHolderPlayer.position)) {
              shooter = ballHolderPlayer;
            }
          }

          // If no specific shooter identified, pick from attacking players
          if (!shooter) {
            const shooters = availablePlayers.filter(p => ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(p.position));
            if (shooters.length > 0) {
              // Weight selection towards strikers and wingers
              const strikers = shooters.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
              if (strikers.length > 0 && Math.random() < 0.7) {
                shooter = strikers[Math.floor(Math.random() * strikers.length)];
              } else {
                shooter = shooters[Math.floor(Math.random() * shooters.length)];
              }
            }
          }

          if (shooter) {
            const gk = defendingTeam.squad.find(p => p.position === 'GK');

            // Calculate shot accuracy based on shooter's overall rating
            // Higher rating = better accuracy (65-90% on target)
            const shotAccuracy = 0.65 + (shooter.overall / 100) * 0.25;
            const shotOnTarget = Math.random() < shotAccuracy;

            // Calculate shot positions
            const isHomeGoal = !isHomeShot;
            const goalX = 50;
            const goalY = isHomeGoal ? 5 : 95;

            let shooterX = 50;
            let shooterY = isHomeShot ? 30 : 70;

            if (shooter.position === 'ST') {
              shooterX = 50;
              shooterY = isHomeShot ? 25 : 75;
            } else if (shooter.position === 'LW') {
              shooterX = 30;
              shooterY = isHomeShot ? 30 : 70;
            } else if (shooter.position === 'RW') {
              shooterX = 70;
              shooterY = isHomeShot ? 30 : 70;
            } else if (['CAM', 'CM'].includes(shooter.position)) {
              shooterX = 50;
              shooterY = isHomeShot ? 45 : 55;
            }

            if (!shotOnTarget) {
              // Shot off target - show animation
              const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
              await update(matchRef, {
                events: [shootEvent, ...(latestData.events || [])],
                ballHolder: { playerId: shooter.id, playerName: shooter.name, team: isHomeShot ? 'home' : 'away' },
                shotAnimation: {
                  fromX: shooterX,
                  fromY: shooterY,
                  toX: goalX + (Math.random() - 0.5) * 30,
                  toY: goalY + (Math.random() < 0.5 ? -8 : 8),
                  startTime: Date.now(),
                  isSave: true
                }
              });

              await new Promise(resolve => setTimeout(resolve, 1200));

              const missTypes = ['shoots wide', 'blasts over the bar', 'misses the target'];
              const missType = missTypes[Math.floor(Math.random() * missTypes.length)];
              const eventText = `${matchMinute}' 📍 ${shooter.name} ${missType}!`;
              await update(matchRef, {
                events: [eventText, ...(latestData.events || [])],
                ballHolder: null
              });
            } else if (gk) {
              // Shot on target - goalkeeper save attempt
              // GK save probability based on both shooter and GK ratings
              // Better GK = higher save chance, better shooter = lower save chance
              const baseSaveChance = 0.60; // 60% base save rate
              const gkBonus = (gk.overall - 75) / 100; // -0.10 to +0.15 based on GK quality
              const shooterPenalty = (shooter.overall - 75) / 100; // Better shooter reduces save chance
              const saveChance = Math.max(0.30, Math.min(0.85, baseSaveChance + gkBonus - shooterPenalty));

              const isSaved = Math.random() < saveChance;

              if (isSaved) {
                // Show shoot event + animation
                const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
                await update(matchRef, {
                  events: [shootEvent, ...(latestData.events || [])],
                  ballHolder: { playerId: shooter.id, playerName: shooter.name, team: isHomeShot ? 'home' : 'away' },
                  shotAnimation: {
                    fromX: shooterX,
                    fromY: shooterY,
                    toX: goalX + (Math.random() - 0.5) * 12,
                    toY: goalY,
                    startTime: Date.now(),
                    isSave: true
                  }
                });

                await new Promise(resolve => setTimeout(resolve, 1200));

                const saveTypes = ['makes a brilliant save', 'denies with a diving save', 'pulls off a great save', 'catches confidently'];
                const saveType = saveTypes[Math.floor(Math.random() * saveTypes.length)];
                const eventText = `${matchMinute}' 🧤 ${gk.name} ${saveType}! ${shooter.name} denied.`;
                await update(matchRef, {
                  events: [eventText, ...(latestData.events || [])],
                  ballHolder: null
                });
              } else {
                // Shot beats GK but doesn't result in goal - close call with animation
                const shootEvent = `${matchMinute}' ⚽ ${shooter.name} shoots!`;
                await update(matchRef, {
                  events: [shootEvent, ...(latestData.events || [])],
                  ballHolder: { playerId: shooter.id, playerName: shooter.name, team: isHomeShot ? 'home' : 'away' },
                  shotAnimation: {
                    fromX: shooterX,
                    fromY: shooterY,
                    toX: goalX + (Math.random() - 0.5) * 15,
                    toY: goalY + (Math.random() < 0.5 ? -3 : 3),
                    startTime: Date.now(),
                    isSave: true
                  }
                });

                await new Promise(resolve => setTimeout(resolve, 1200));

                const closeCallTypes = ['shot saved at the near post', 'tips it over the bar', 'makes a fingertip save'];
                const closeCall = closeCallTypes[Math.floor(Math.random() * closeCallTypes.length)];
                const eventText = `${matchMinute}' 😰 Close call! ${gk.name} ${closeCall}! ${shooter.name} almost scored!`;
                await update(matchRef, {
                  events: [eventText, ...(latestData.events || [])],
                  ballHolder: null
                });
              }
            } else {
              // No GK - shot saved by defense or missed
              const eventText = `${matchMinute}' 🛡️ ${shooter.name}'s shot is blocked by the defense!`;
              const newEvents = [eventText, ...(latestData.events || [])];
              await update(matchRef, { events: newEvents });
            }
          }
        } else if (eventRoll < 0.23) {
          // DEFENSIVE EVENT (5% chance) - Tackles and Interceptions
          // Defending team tries to win the ball
          const currentBallPossession = latestData.ballPossession || 'home';
          const isHome = currentBallPossession === 'away'; // Defending team
          const defendingTeam = isHome ? match.homeManager : match.awayManager;
          const attackingTeam = isHome ? match.awayManager : match.homeManager;
          const defendingTeamName = isHome ? 'home' : 'away';

          const availableDefenders = defendingTeam.squad.filter(p => !substitutedPlayers.includes(p.id));
          const defenders = availableDefenders.filter(p =>
            ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position)
          );

          if (defenders.length > 0) {
            const defender = defenders[Math.floor(Math.random() * defenders.length)];

            // Calculate tackle success based on defender's overall rating
            const tackleSuccess = 0.55 + (defender.overall / 100) * 0.25; // 55-80% success rate
            const isSuccessful = Math.random() < tackleSuccess;

            if (isSuccessful) {
              // Successful tackle - ball possession changes
              const tackleTypes = ['wins the ball with a strong tackle', 'intercepts brilliantly', 'makes a crucial tackle', 'reads the play perfectly'];
              const tackleType = tackleTypes[Math.floor(Math.random() * tackleTypes.length)];
              const eventText = `${matchMinute}' 🛡️ ${defender.name} ${tackleType}!`;
              const newEvents = [eventText, ...(latestData.events || [])];

              // Update ball possession to defending team
              await update(matchRef, {
                events: newEvents,
                ballPossession: defendingTeamName,
                ballHolder: { playerId: defender.id, playerName: defender.name, team: defendingTeamName }
              });

              console.log(`Successful tackle by ${defender.name} - possession changed`);
            } else {
              // Failed tackle - attacker keeps ball
              const availableAttackers = attackingTeam.squad.filter(p => !substitutedPlayers.includes(p.id));
              const attacker = availableAttackers.find(p => p.id === latestData.ballHolder?.playerId)
                || availableAttackers.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position))[0];

              if (attacker) {
                const eventText = `${matchMinute}' 💨 ${attacker.name} evades ${defender.name}'s challenge!`;
                const newEvents = [eventText, ...(latestData.events || [])];
                await update(matchRef, { events: newEvents });
                console.log(`Failed tackle - ${attacker.name} keeps possession`);
              }
            }
          }
        } else if (eventRoll < 0.31) {
          // PASS/BUILDUP EVENT (8% chance) - Enhanced with receiver tracking
          const teamRoll = Math.random();
          const isHome = teamRoll < 0.5;
          const team = isHome ? match.homeManager : match.awayManager;
          const teamName = isHome ? 'home' : 'away';

          const availablePlayers = team.squad.filter(p => !substitutedPlayers.includes(p.id));
          const passers = availablePlayers.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM', 'CB', 'LB', 'RB'].includes(p.position));

          if (passers.length > 0) {
            const passer = passers[Math.floor(Math.random() * passers.length)];

            // Select receiver - prefer players in advanced positions
            const receivers = availablePlayers.filter(p =>
              p.id !== passer.id && p.position !== 'GK'
            );

            if (receivers.length > 0) {
              // Weight receiver selection by position (prefer attackers)
              const attackers = receivers.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
              const mids = receivers.filter(p => ['CAM', 'CM', 'LM', 'RM'].includes(p.position));

              let receiver;
              const receiverRoll = Math.random();
              if (receiverRoll < 0.50 && attackers.length > 0) {
                receiver = attackers[Math.floor(Math.random() * attackers.length)];
              } else if (receiverRoll < 0.85 && mids.length > 0) {
                receiver = mids[Math.floor(Math.random() * mids.length)];
              } else {
                receiver = receivers[Math.floor(Math.random() * receivers.length)];
              }

              // Calculate pass success based on passer's overall rating
              const passAccuracy = 0.75 + (passer.overall / 100) * 0.20; // 75-95% success rate
              const passSuccess = Math.random() < passAccuracy;

              if (passSuccess) {
                // Update ball possession and holder
                const ballPossessionData = {
                  ballPossession: teamName,
                  ballHolder: { playerId: receiver.id, playerName: receiver.name, team: teamName }
                };
                await update(matchRef, ballPossessionData);

                const eventText = `${matchMinute}' ⚡ ${passer.name} → ${receiver.name} - excellent pass forward!`;
                const newEvents = [eventText, ...(latestData.events || [])];
                await update(matchRef, { events: newEvents });

                console.log(`Pass completed: ${passer.name} → ${receiver.name}`);
              } else {
                // Pass intercepted or lost
                const eventText = `${matchMinute}' ❌ ${passer.name}'s pass is intercepted!`;
                const newEvents = [eventText, ...(latestData.events || [])];
                await update(matchRef, { events: newEvents, ballPossession: isHome ? 'away' : 'home', ballHolder: null });
                console.log('Pass intercepted!');
              }
            }
          }
        }

        // Update minute in Firebase
        await update(matchRef, { minute: matchMinute, second: currentSecond });

        // Half time at 60 seconds (45 match minutes)
        if (currentSecond >= 60 && currentData.state !== 'halftime') {
          console.log('Half time reached');
          clearInterval(interval);
          await update(matchRef, {
            state: 'halftime',
            second: 60  // Save current second for second half
          });
          return; // Stop processing this interval
        }

        // Full time at 120 seconds (90 match minutes)
        if (currentSecond >= 120) {
          console.log('Full time reached');
          clearInterval(interval);
          await finishMatch();
          return; // Stop processing this interval
        }
      } catch (error) {
        console.error('Error during match simulation:', error);
        clearInterval(interval);
      }
    }, 1000);
  };

  const resumeFromHalftime = async () => {
    if (!currentMatch) return;

    // For practice matches, resume immediately
    if (currentMatch.isPractice) {
      setCurrentMatch({
        ...currentMatch,
        state: 'playing',
        homeSecondHalfReady: true,
        awaySecondHalfReady: true,
        secondHalfStarted: true
      });
      setMatchState('playing');
      simulatePracticeSecondHalf();
      return;
    }

    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const matchData = (await get(matchRef)).val();

    // Check if match is in halftime state
    if (matchData.state !== 'halftime') {
      return;
    }

    // Mark myself as ready for second half
    const readyField = isHome ? 'homeSecondHalfReady' : 'awaySecondHalfReady';
    await update(matchRef, { [readyField]: true });

    console.log(`${isHome ? 'Home' : 'Away'} manager ready for second half`);

    // Check if both are ready for second half
    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val();

    if (updatedMatch.homeSecondHalfReady && updatedMatch.awaySecondHalfReady) {
      // Both ready - continue to second half
      console.log('Both managers ready - starting second half');
      console.log('Current match data before update:', {
        state: updatedMatch.state,
        second: updatedMatch.second,
        minute: updatedMatch.minute
      });

      await update(matchRef, {
        state: 'playing',
        secondHalfStarted: true,
        secondHalfSimulationStarted: false  // Ensure this is false so simulation can start
      });

      console.log('Second half state updated in Firebase');

      // If we're the home manager, start simulation immediately as backup
      // (The listener should also catch this, but this ensures it starts)
      if (isHome) {
        console.log('Home manager - starting second half simulation directly');
        setTimeout(async () => {
          const checkData = (await get(matchRef)).val();
          if (checkData.state === 'playing' && checkData.secondHalfStarted && !checkData.secondHalfSimulationStarted) {
            console.log('Second half not started by listener, starting now');
            await update(matchRef, { secondHalfSimulationStarted: true });
            simulateSecondHalf();
          }
        }, 500); // Wait 500ms for listener to process
      }
    } else {
      console.log('Waiting for other manager:', {
        homeReady: updatedMatch.homeSecondHalfReady,
        awayReady: updatedMatch.awaySecondHalfReady
      });
    }
  };

  // Simulate practice match second half locally
  const simulatePracticeSecondHalf = () => {
    console.log('Starting practice match second half');

    const homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    const awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);
    const totalStrength = homeStrength + awayStrength;

    const homeChance = (homeStrength / totalStrength) * 0.55 + 0.05;
    const awayChance = (awayStrength / totalStrength) * 0.55;

    let currentSecond = 60;
    let localHomeScore = currentMatch.homeScore || 0;
    let localAwayScore = currentMatch.awayScore || 0;
    let localEvents = currentMatch.events || [];
    let localGoalscorers = currentMatch.goalscorers || {};
    let localBallPossession = currentMatch.ballPossession || 'away'; // Away team starts second half
    let localBallHolder = null;

    const interval = setInterval(() => {
      currentSecond++;
      const matchMinute = Math.floor(currentSecond / (120 / 90)); // 120 seconds = 90 minutes

      setMinute(matchMinute);

      // Enhanced match events with all new mechanics
      const eventRoll = Math.random();

      if (eventRoll < 0.04) {
        // GOAL EVENT - VISUAL SEQUENCE: Shot → Goal announcement
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;

        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const attackingMids = team.squad.filter(p => ['CAM', 'CM'].includes(p.position));
        const wideMids = team.squad.filter(p => ['LM', 'RM', 'LWB', 'RWB'].includes(p.position));
        const defensiveMids = team.squad.filter(p => ['CDM'].includes(p.position));
        const defenders = team.squad.filter(p => ['CB', 'LB', 'RB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();
        if (scorerRoll < 0.60 && attackers.length > 0) {
          const weightedAttackers = attackers.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedAttackers.sort((a, b) => b.weight - a.weight);
          scorer = weightedAttackers[0].player;
        } else if (scorerRoll < 0.80 && attackingMids.length > 0) {
          const weightedMids = attackingMids.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedMids.sort((a, b) => b.weight - a.weight);
          scorer = weightedMids[0].player;
        } else if (scorerRoll < 0.90 && wideMids.length > 0) {
          scorer = wideMids[Math.floor(Math.random() * wideMids.length)];
        } else if (scorerRoll < 0.96 && defenders.length > 0) {
          const sortedDefenders = [...defenders].sort((a, b) => b.overall - a.overall);
          scorer = sortedDefenders[0];
        } else if (scorerRoll < 0.99 && defensiveMids.length > 0) {
          scorer = defensiveMids[Math.floor(Math.random() * defensiveMids.length)];
        } else {
          const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        const scorerName = scorer.name;
        const goalTypes = ['powerful strike', 'clinical finish', 'stunning goal', 'brilliant header', 'precision shot', 'unstoppable effort'];
        const goalType = goalTypes[Math.floor(Math.random() * goalTypes.length)];

        // STEP 1: Ball to shooter
        localBallHolder = { playerId: scorer.id, playerName: scorer.name, team: isHomeGoal ? 'home' : 'away' };
        setBallHolder(localBallHolder);

        // STEP 2: Show shoot event immediately
        const shootEvent = `${matchMinute}' ⚽ ${scorer.name} shoots!`;
        localEvents = [shootEvent, ...localEvents];
        setEvents(localEvents);

        // STEP 3: Trigger shot animation from realistic shooter position
        let shooterX = 50;
        let shooterY = isHomeGoal ? 70 : 30;

        // Position based on scorer's role
        if (scorer.position === 'ST') {
          shooterX = 50;
          shooterY = isHomeGoal ? 25 : 75;
        } else if (scorer.position === 'LW') {
          shooterX = 30;
          shooterY = isHomeGoal ? 30 : 70;
        } else if (scorer.position === 'RW') {
          shooterX = 70;
          shooterY = isHomeGoal ? 30 : 70;
        } else if (['CAM', 'CM'].includes(scorer.position)) {
          shooterX = 50;
          shooterY = isHomeGoal ? 45 : 55;
        }

        const shooterPosition = { x: shooterX, y: shooterY };

        const goalX = 50;
        const goalY = isHomeGoal ? 2 : 98;

        setShotAnimation({
          fromX: shooterPosition.x,
          fromY: shooterPosition.y,
          toX: goalX + (Math.random() - 0.5) * 8,
          toY: goalY,
          startTime: Date.now()
        });

        // STEP 4: AFTER shot completes (1200ms), announce GOAL!
        setTimeout(() => {
          if (isHomeGoal) {
            localHomeScore++;
            setHomeScore(localHomeScore);
          } else {
            localAwayScore++;
            setAwayScore(localAwayScore);
          }

          const eventText = `${matchMinute}' ⚽⚽ GOAAAAL! ${scorerName} (${scorer.overall}) with a ${goalType}!`;
          localEvents = [eventText, ...localEvents];
          setEvents(localEvents);

          if (!localGoalscorers[scorer.id]) {
            localGoalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
          }
          localGoalscorers[scorer.id].goals++;

          localBallPossession = isHomeGoal ? 'away' : 'home';
          localBallHolder = null;
          setBallPossession(localBallPossession);
          setBallHolder(null);

          setGoalCelebration({ scorer: scorerName, team: isHomeGoal ? 'home' : 'away' });

          setGoalMoment({
            show: true,
            scorer: scorerName,
            team: isHomeGoal ? 'home' : 'away',
            startTime: Date.now()
          });
          setTimeout(() => setGoalMoment(null), 2500);

          setTimeout(() => setGoalCelebration(null), 3000);
          console.log('GOAL!', eventText);
        }, 1200); // Wait for shot to reach goal (1200ms)
      } else if (eventRoll < 0.10) {
        // SHOT/SAVE EVENT
        const teamRoll = Math.random();
        const isHomeShot = teamRoll < 0.5;
        const attackingTeam = isHomeShot ? currentMatch.homeManager : currentMatch.awayManager;
        const defendingTeam = isHomeShot ? currentMatch.awayManager : currentMatch.homeManager;

        let shooter;
        if (localBallHolder && localBallHolder.team === (isHomeShot ? 'home' : 'away')) {
          const ballHolderPlayer = attackingTeam.squad.find(p => p.id === localBallHolder.playerId);
          if (ballHolderPlayer && ['ST', 'LW', 'RW', 'CAM'].includes(ballHolderPlayer.position)) {
            shooter = ballHolderPlayer;
          }
        }

        if (!shooter) {
          const shooters = attackingTeam.squad.filter(p => ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(p.position));
          if (shooters.length > 0) {
            const strikers = shooters.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
            if (strikers.length > 0 && Math.random() < 0.7) {
              shooter = strikers[Math.floor(Math.random() * strikers.length)];
            } else {
              shooter = shooters[Math.floor(Math.random() * shooters.length)];
            }
          }
        }

        if (shooter) {
          const gk = defendingTeam.squad.find(p => p.position === 'GK');
          const shotAccuracy = 0.65 + (shooter.overall / 100) * 0.25;
          const shotOnTarget = Math.random() < shotAccuracy;

          if (!shotOnTarget) {
            const missTypes = ['shoots wide', 'blasts over the bar', 'misses the target'];
            const missType = missTypes[Math.floor(Math.random() * missTypes.length)];
            const eventText = `${matchMinute}' 📍 ${shooter.name} ${missType}!`;
            localEvents = [eventText, ...localEvents];
            setEvents(localEvents);
          } else if (gk) {
            const baseSaveChance = 0.60;
            const gkBonus = (gk.overall - 75) / 100;
            const shooterPenalty = (shooter.overall - 75) / 100;
            const saveChance = Math.max(0.30, Math.min(0.85, baseSaveChance + gkBonus - shooterPenalty));
            const isSaved = Math.random() < saveChance;

            if (isSaved) {
              const saveTypes = ['makes a brilliant save', 'denies with a diving save', 'pulls off a great save', 'catches confidently'];
              const saveType = saveTypes[Math.floor(Math.random() * saveTypes.length)];
              const eventText = `${matchMinute}' 🧤 ${gk.name} ${saveType}! ${shooter.name} denied.`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            } else {
              const closeCallTypes = ['shot saved at the near post', 'tips it over the bar', 'makes a fingertip save'];
              const closeCall = closeCallTypes[Math.floor(Math.random() * closeCallTypes.length)];
              const eventText = `${matchMinute}' 😰 Close call! ${gk.name} ${closeCall}! ${shooter.name} almost scored!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            }
          }
        }
      } else if (eventRoll < 0.15) {
        // DEFENSIVE EVENT
        const isHome = localBallPossession === 'away';
        const defendingTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
        const attackingTeam = isHome ? currentMatch.awayManager : currentMatch.homeManager;
        const defendingTeamName = isHome ? 'home' : 'away';

        const defenders = defendingTeam.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position));

        if (defenders.length > 0) {
          const defender = defenders[Math.floor(Math.random() * defenders.length)];
          const tackleSuccess = 0.55 + (defender.overall / 100) * 0.25;
          const isSuccessful = Math.random() < tackleSuccess;

          if (isSuccessful) {
            const tackleTypes = ['wins the ball with a strong tackle', 'intercepts brilliantly', 'makes a crucial tackle', 'reads the play perfectly'];
            const tackleType = tackleTypes[Math.floor(Math.random() * tackleTypes.length)];
            const eventText = `${matchMinute}' 🛡️ ${defender.name} ${tackleType}!`;
            localEvents = [eventText, ...localEvents];
            setEvents(localEvents);

            localBallPossession = defendingTeamName;
            localBallHolder = { playerId: defender.id, playerName: defender.name, team: defendingTeamName };
            setBallPossession(localBallPossession);
            setBallHolder(localBallHolder);
          } else {
            const attacker = attackingTeam.squad.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position))[0];
            if (attacker) {
              const eventText = `${matchMinute}' 💨 ${attacker.name} evades ${defender.name}'s challenge!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            }
          }
        }
      } else if (eventRoll < 0.23) {
        // PASS EVENT
        const teamRoll = Math.random();
        const isHome = teamRoll < 0.5;
        const team = isHome ? currentMatch.homeManager : currentMatch.awayManager;
        const teamName = isHome ? 'home' : 'away';

        const passers = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM', 'CB', 'LB', 'RB'].includes(p.position));

        if (passers.length > 0) {
          const passer = passers[Math.floor(Math.random() * passers.length)];
          const receivers = team.squad.filter(p => p.id !== passer.id && p.position !== 'GK');

          if (receivers.length > 0) {
            const attackers = receivers.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
            const mids = receivers.filter(p => ['CAM', 'CM', 'LM', 'RM'].includes(p.position));

            let receiver;
            const receiverRoll = Math.random();
            if (receiverRoll < 0.50 && attackers.length > 0) {
              receiver = attackers[Math.floor(Math.random() * attackers.length)];
            } else if (receiverRoll < 0.85 && mids.length > 0) {
              receiver = mids[Math.floor(Math.random() * mids.length)];
            } else {
              receiver = receivers[Math.floor(Math.random() * receivers.length)];
            }

            const passAccuracy = 0.75 + (passer.overall / 100) * 0.20;
            const passSuccess = Math.random() < passAccuracy;

            if (passSuccess) {
              localBallPossession = teamName;
              localBallHolder = { playerId: receiver.id, playerName: receiver.name, team: teamName };
              setBallPossession(localBallPossession);
              setBallHolder(localBallHolder);

              const eventText = `${matchMinute}' ⚡ ${passer.name} → ${receiver.name} - excellent pass forward!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
            } else {
              const eventText = `${matchMinute}' ❌ ${passer.name}'s pass is intercepted!`;
              localEvents = [eventText, ...localEvents];
              setEvents(localEvents);
              localBallPossession = isHome ? 'away' : 'home';
              localBallHolder = null;
              setBallPossession(localBallPossession);
              setBallHolder(null);
            }
          }
        }
      }

      // Full time at 120 seconds (90 match minutes)
      if (currentSecond >= 120) {
        console.log('Full time reached in practice match');
        clearInterval(interval);
        finishPracticeMatch(localHomeScore, localAwayScore, localEvents, localGoalscorers);
      }
    }, 1000);
  };

  const simulateSecondHalf = async () => {
    if (!currentMatch) return;

    console.log('========== SECOND HALF STARTING ==========');
    const matchRef = ref(database, `matches/${currentMatch.id}`);

    const initialData = (await get(matchRef)).val();
    console.log('Second half initial state:', {
      second: initialData.second,
      minute: initialData.minute,
      state: initialData.state,
      secondHalfStarted: initialData.secondHalfStarted
    });

    // Calculate team strengths
    const homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    const awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);
    const totalStrength = homeStrength + awayStrength;

    // Calculate win probabilities with strength-based decisiveness
    const strengthRatio = homeStrength / awayStrength;
    let homeChance, awayChance;

    if (strengthRatio > 1.2) {
      homeChance = 0.65 + Math.min(0.15, (strengthRatio - 1.2) * 0.3);
    } else if (strengthRatio < 0.83) {
      homeChance = 0.20 - Math.min(0.05, (0.83 - strengthRatio) * 0.3);
    } else {
      homeChance = (homeStrength / totalStrength) * 0.55 + 0.05;
    }
    awayChance = 1 - homeChance;

    const interval = setInterval(async () => {
      const currentData = (await get(matchRef)).val();

      // Check if match is already finished or in halftime (shouldn't happen but safety check)
      if (currentData.state === 'finished' || currentData.state === 'halftime') {
        console.log('Match is already finished or at halftime, stopping simulation');
        clearInterval(interval);
        return;
      }

      // Check if match is paused
      if (currentData.paused) {
        console.log('Match is paused, skipping simulation tick');
        return;
      }

      const currentSecond = (currentData.second || 60) + 1;
      console.log(`Second half tick: second=${currentSecond}, from currentData.second=${currentData.second}`);

      // Safety check: if we're somehow past 120 seconds, finish immediately
      if (currentSecond > 120) {
        console.log('Match exceeded 120 seconds, finishing now');
        clearInterval(interval);
        await finishMatch();
        return;
      }

      const matchMinute = Math.floor(currentSecond / (120 / 90));

      console.log(`Second half - second ${currentSecond}, minute ${matchMinute}`);

      // Generate match events - goals, passes, shots, saves
      const eventRoll = Math.random();
      const substitutedPlayers = currentData.substitutedPlayers || [];

      if (eventRoll < 0.04) {
        // GOAL EVENT (4% chance) - Enhanced realistic second half goal scoring
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;
        const opposingTeam = isHomeGoal ? currentMatch.awayManager : currentMatch.homeManager;

        // Filter out substituted players
        const availablePlayers = team.squad.filter(p => !substitutedPlayers.includes(p.id));

        // Enhanced realistic goal scoring - weight by position AND overall rating
        const attackers = availablePlayers.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const attackingMids = availablePlayers.filter(p => ['CAM', 'CM'].includes(p.position));
        const wideMids = availablePlayers.filter(p => ['LM', 'RM', 'LWB', 'RWB'].includes(p.position));
        const defensiveMids = availablePlayers.filter(p => ['CDM'].includes(p.position));
        const defenders = availablePlayers.filter(p => ['CB', 'LB', 'RB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();

        // Weighted scoring based on realistic probabilities and player quality
        if (scorerRoll < 0.60 && attackers.length > 0) {
          // 60% chance for strikers/wingers - pick best attacker with some randomness
          const weightedAttackers = attackers.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedAttackers.sort((a, b) => b.weight - a.weight);
          scorer = weightedAttackers[0].player;
        } else if (scorerRoll < 0.80 && attackingMids.length > 0) {
          // 20% chance for attacking/central midfielders
          const weightedMids = attackingMids.map(p => ({ player: p, weight: p.overall + Math.random() * 15 }));
          weightedMids.sort((a, b) => b.weight - a.weight);
          scorer = weightedMids[0].player;
        } else if (scorerRoll < 0.90 && wideMids.length > 0) {
          // 10% chance for wide midfielders/wingbacks
          scorer = wideMids[Math.floor(Math.random() * wideMids.length)];
        } else if (scorerRoll < 0.96 && defenders.length > 0) {
          // 6% chance for defenders (set pieces)
          const sortedDefenders = [...defenders].sort((a, b) => b.overall - a.overall);
          scorer = sortedDefenders[0];
        } else if (scorerRoll < 0.99 && defensiveMids.length > 0) {
          // 3% chance for defensive midfielders (long shots)
          scorer = defensiveMids[Math.floor(Math.random() * defensiveMids.length)];
        } else {
          // 1% rare case - any outfield player (excluding GK)
          const outfieldPlayers = availablePlayers.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        const newScore = isHomeGoal
          ? { homeScore: currentData.homeScore + 1 }
          : { awayScore: currentData.awayScore + 1 };

        await update(matchRef, newScore);

        // Enhanced goal event text with more variety
        const goalTypes = ['powerful strike', 'clinical finish', 'stunning goal', 'brilliant header', 'precision shot', 'unstoppable effort', 'counter-attack goal', 'composed finish'];
        const goalType = goalTypes[Math.floor(Math.random() * goalTypes.length)];
        const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) with a ${goalType}!`;

        // Track goalscorer for XP rewards
        const goalscorers = currentData.goalscorers || {};
        if (!goalscorers[scorer.id]) {
          goalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
        }
        goalscorers[scorer.id].goals++;

        const newEvents = [eventText, ...(currentData.events || [])];
        await update(matchRef, { events: newEvents, goalscorers });

        console.log('GOAL!', eventText);
      } else if (eventRoll < 0.10) {
        // SHOT/SAVE EVENT (6% chance)
        const teamRoll = Math.random();
        const isHomeShot = teamRoll < 0.5;
        const attackingTeam = isHomeShot ? currentMatch.homeManager : currentMatch.awayManager;
        const defendingTeam = isHomeShot ? currentMatch.awayManager : currentMatch.homeManager;

        const availablePlayers = attackingTeam.squad.filter(p => !substitutedPlayers.includes(p.id));
        const shooters = availablePlayers.filter(p => ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(p.position));
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          const gk = defendingTeam.squad.find(p => p.position === 'GK');

          const eventText = gk
            ? `${matchMinute}' 🧤 Great save by ${gk.name}! ${shooter.name} denied.`
            : `${matchMinute}' 📍 ${shooter.name} shoots wide!`;
          const newEvents = [eventText, ...(currentData.events || [])];
          await update(matchRef, { events: newEvents });
        }
      } else if (eventRoll < 0.18) {
        // PASS/BUILDUP EVENT (8% chance)
        const teamRoll = Math.random();
        const isHome = teamRoll < 0.5;
        const team = isHome ? currentMatch.homeManager : currentMatch.awayManager;

        const availablePlayers = team.squad.filter(p => !substitutedPlayers.includes(p.id));
        const midfielders = availablePlayers.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(p.position));
        if (midfielders.length > 0) {
          const passer = midfielders[Math.floor(Math.random() * midfielders.length)];

          const eventText = `${matchMinute}' ⚡ ${passer.name} with a great pass forward!`;
          const newEvents = [eventText, ...(currentData.events || [])];
          await update(matchRef, { events: newEvents });
        }
      }

      // Update minute and second
      await update(matchRef, { minute: matchMinute, second: currentSecond });

      // Full time at 120 seconds (90 match minutes)
      if (currentSecond >= 120) {
        console.log('Full time reached');
        clearInterval(interval);
        await finishMatch();
      }
    }, 1000);
  };

  const finishMatch = async () => {
    if (!currentMatch) {
      console.error('finishMatch called but currentMatch is null');
      return;
    }

    console.log('finishMatch called for match:', currentMatch.id);

    try {
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      const matchData = (await get(matchRef)).val();

      console.log('Match data retrieved:', matchData);

      await update(matchRef, {
        state: 'finished',
        finishedAt: Date.now()
      });

      console.log('Match state updated to finished');

      // Only process stats once per manager
      if (!matchData.statsProcessed) {
        console.log('Processing match stats...');
        await update(matchRef, { statsProcessed: true });
        // Add the match ID to matchData before passing to updateMatchStats
        await updateMatchStats({ ...matchData, id: currentMatch.id });
        console.log('Match stats processed successfully');
      } else {
        console.log('Stats already processed, skipping');
      }
    } catch (error) {
      console.error('Error in finishMatch:', error);
    }
  };

  const updateMatchStats = async (matchData) => {
    console.log('updateMatchStats called with matchData:', matchData);

    const finalHomeScore = matchData.homeScore || 0;
    const finalAwayScore = matchData.awayScore || 0;

    console.log('Final score:', finalHomeScore, '-', finalAwayScore);

    // Calculate team strengths for match report
    const homeStrength = calculateTeamStrength(matchData.homeManager.squad);
    const awayStrength = calculateTeamStrength(matchData.awayManager.squad);

    // Generate match report
    let matchReport = '';
    const scoreDiff = Math.abs(finalHomeScore - finalAwayScore);
    const strengthDiff = Math.abs(homeStrength - awayStrength);

    if (finalHomeScore > finalAwayScore) {
      // Home win
      matchReport = `${matchData.homeManager.name} won ${finalHomeScore}-${finalAwayScore}. `;
      if (homeStrength > awayStrength + 3) {
        matchReport += `The favorites dominated with superior squad quality (${homeStrength.toFixed(1)} vs ${awayStrength.toFixed(1)} avg rating).`;
      } else if (homeStrength < awayStrength - 3) {
        matchReport += `An upset victory! ${matchData.homeManager.name}'s tactical approach overcame ${matchData.awayManager.name}'s stronger squad (${awayStrength.toFixed(1)} avg rating).`;
      } else {
        matchReport += `A well-deserved victory with home advantage proving decisive in a closely matched contest.`;
      }
    } else if (finalAwayScore > finalHomeScore) {
      // Away win
      matchReport = `${matchData.awayManager.name} won ${finalAwayScore}-${finalHomeScore} away from home. `;
      if (awayStrength > homeStrength + 3) {
        matchReport += `The superior squad quality (${awayStrength.toFixed(1)} vs ${homeStrength.toFixed(1)} avg rating) showed as expected.`;
      } else if (awayStrength < homeStrength - 3) {
        matchReport += `Major upset! ${matchData.awayManager.name} pulled off an incredible away win despite facing a stronger squad.`;
      } else {
        matchReport += `Excellent away performance overcoming home advantage in a competitive match.`;
      }
    } else {
      // Draw
      matchReport = `Match ended ${finalHomeScore}-${finalHomeScore}. `;
      if (strengthDiff < 2) {
        matchReport += `A fair result between two evenly matched teams (${homeStrength.toFixed(1)} vs ${awayStrength.toFixed(1)} avg rating).`;
      } else {
        matchReport += `The underdog held on for a valuable point against a superior opponent.`;
      }
    }

    // Calculate detailed statistics
    const allEvents = matchData.events || [];
    const goalEvents = allEvents.filter(e => e.includes('⚽ GOAL'));
    const saveEvents = allEvents.filter(e => e.includes('🧤'));
    const passEvents = allEvents.filter(e => e.includes('⚡'));

    // Calculate possession percentage based on player actions
    // Get all home and away player names
    const homePlayerNames = matchData.homeManager.squad.map(p => p.name);
    const awayPlayerNames = matchData.awayManager.squad.map(p => p.name);

    // Count events by team (passes, shots, saves)
    let homeActions = 0;
    let awayActions = 0;

    allEvents.forEach(event => {
      // Check if any home player is in the event
      const isHomeEvent = homePlayerNames.some(name => event.includes(name));
      const isAwayEvent = awayPlayerNames.some(name => event.includes(name));

      if (isHomeEvent) homeActions++;
      else if (isAwayEvent) awayActions++;
    });

    const totalActions = homeActions + awayActions;
    const homePossession = totalActions > 0 ? Math.round((homeActions / totalActions) * 100) : 50;
    const awayPossession = 100 - homePossession;

    // Count shots (goals + saves + misses)
    const homeShots = allEvents.filter(e => {
      const isShotEvent = e.includes('⚽ GOAL') || e.includes('🧤') || e.includes('📍');
      const isHomePlayer = homePlayerNames.some(name => e.includes(name));
      return isShotEvent && isHomePlayer;
    }).length;

    const awayShots = allEvents.filter(e => {
      const isShotEvent = e.includes('⚽ GOAL') || e.includes('🧤') || e.includes('📍');
      const isAwayPlayer = awayPlayerNames.some(name => e.includes(name));
      return isShotEvent && isAwayPlayer;
    }).length;

    // Get goalscorers
    const goalscorersData = matchData.goalscorers || {};
    const topScorers = Object.values(goalscorersData)
      .map(gs => {
        const player = matchData.homeManager.squad.find(p => p.id === gs.playerId) ||
                      matchData.awayManager.squad.find(p => p.id === gs.playerId);
        return player ? { name: player.name, goals: gs.goals } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.goals - a.goals);

    // Create match history record with detailed stats
    const matchHistory = {
      id: matchData.id,
      homeManager: {
        uid: matchData.homeManager.uid,
        name: matchData.homeManager.name,
        formation: matchData.homeManager.formation || '4-3-3',
        tactic: matchData.homeTactic || 'Balanced'
      },
      awayManager: {
        uid: matchData.awayManager.uid,
        name: matchData.awayManager.name,
        formation: matchData.awayManager.formation || '4-3-3',
        tactic: matchData.awayTactic || 'Balanced'
      },
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      homeStrength: homeStrength.toFixed(1),
      awayStrength: awayStrength.toFixed(1),
      homePossession,
      awayPossession,
      homeShots,
      awayShots,
      homeShotsOnTarget: allEvents.filter(e => (e.includes('⚽ GOAL') || e.includes('🧤')) && e.includes(`for ${matchData.homeManager.name}`)).length,
      awayShotsOnTarget: allEvents.filter(e => (e.includes('⚽ GOAL') || e.includes('🧤')) && e.includes(`for ${matchData.awayManager.name}`)).length,
      topScorers,
      events: allEvents,
      matchReport: matchReport,
      playedAt: Date.now()
    };

    // Save match to both managers' history
    await push(ref(database, `managers/${matchData.homeManager.uid}/matchHistory`), matchHistory);
    await push(ref(database, `managers/${matchData.awayManager.uid}/matchHistory`), matchHistory);

    // Update manager stats - separate friendly and league stats
    const homeManagerRef = ref(database, `managers/${matchData.homeManager.uid}`);
    const homeSnapshot = await get(homeManagerRef);
    if (homeSnapshot.exists()) {
      const homeData = homeSnapshot.val();
      let homeUpdate = {
        wins: homeData.wins || 0,
        draws: homeData.draws || 0,
        losses: homeData.losses || 0,
      };

      // For Pro League matches, update league stats and points
      if (matchData.isProLeague) {
        homeUpdate.leagueWins = homeData.leagueWins || 0;
        homeUpdate.leagueDraws = homeData.leagueDraws || 0;
        homeUpdate.leagueLosses = homeData.leagueLosses || 0;
        homeUpdate.leaguePoints = homeData.leaguePoints || 0;
        homeUpdate.leagueGoalsFor = (homeData.leagueGoalsFor || 0) + finalHomeScore;
        homeUpdate.leagueGoalsAgainst = (homeData.leagueGoalsAgainst || 0) + finalAwayScore;

        if (finalHomeScore > finalAwayScore) {
          homeUpdate.leagueWins++;
          homeUpdate.leaguePoints += 3;
        } else if (finalHomeScore < finalAwayScore) {
          homeUpdate.leagueLosses++;
        } else {
          homeUpdate.leagueDraws++;
          homeUpdate.leaguePoints += 1;
        }

        // Record this match in league matches history (for daily tracking)
        const today = Date.now();
        await update(ref(database, `managers/${matchData.homeManager.uid}/leagueMatches/${matchData.awayManager.uid}`), {
          timestamp: today,
          result: finalHomeScore > finalAwayScore ? 'win' : (finalHomeScore < finalAwayScore ? 'loss' : 'draw'),
          score: `${finalHomeScore}-${finalAwayScore}`
        });
      }

      // Always update friendly stats (no points)
      if (finalHomeScore > finalAwayScore) {
        homeUpdate.wins++;
      } else if (finalHomeScore < finalAwayScore) {
        homeUpdate.losses++;
      } else {
        homeUpdate.draws++;
      }

      await update(homeManagerRef, homeUpdate);
    }

    // Update away manager stats
    const awayManagerRef = ref(database, `managers/${matchData.awayManager.uid}`);
    const awaySnapshot = await get(awayManagerRef);
    if (awaySnapshot.exists()) {
      const awayData = awaySnapshot.val();
      let awayUpdate = {
        wins: awayData.wins || 0,
        draws: awayData.draws || 0,
        losses: awayData.losses || 0,
      };

      // For Pro League matches, update league stats and points
      if (matchData.isProLeague) {
        awayUpdate.leagueWins = awayData.leagueWins || 0;
        awayUpdate.leagueDraws = awayData.leagueDraws || 0;
        awayUpdate.leagueLosses = awayData.leagueLosses || 0;
        awayUpdate.leaguePoints = awayData.leaguePoints || 0;
        awayUpdate.leagueGoalsFor = (awayData.leagueGoalsFor || 0) + finalAwayScore;
        awayUpdate.leagueGoalsAgainst = (awayData.leagueGoalsAgainst || 0) + finalHomeScore;

        if (finalAwayScore > finalHomeScore) {
          awayUpdate.leagueWins++;
          awayUpdate.leaguePoints += 3;
        } else if (finalAwayScore < finalHomeScore) {
          awayUpdate.leagueLosses++;
        } else {
          awayUpdate.leagueDraws++;
          awayUpdate.leaguePoints += 1;
        }

        // Record this match in league matches history (for daily tracking)
        const today = Date.now();
        await update(ref(database, `managers/${matchData.awayManager.uid}/leagueMatches/${matchData.homeManager.uid}`), {
          timestamp: today,
          result: finalAwayScore > finalHomeScore ? 'win' : (finalAwayScore < finalHomeScore ? 'loss' : 'draw'),
          score: `${finalAwayScore}-${finalHomeScore}`
        });
      }

      // Always update friendly stats (no points)
      if (finalAwayScore > finalHomeScore) {
        awayUpdate.wins++;
      } else if (finalAwayScore < finalHomeScore) {
        awayUpdate.losses++;
      } else {
        awayUpdate.draws++;
      }

      await update(awayManagerRef, awayUpdate);
    }

    // Send notification to both managers
    await push(ref(database, `managers/${matchData.homeManager.uid}/notifications`), {
      type: 'match_finished',
      message: `Match finished: ${matchData.homeManager.name} ${finalHomeScore} - ${finalAwayScore} ${matchData.awayManager.name}`,
      timestamp: Date.now(),
      read: false
    });

    await push(ref(database, `managers/${matchData.awayManager.uid}/notifications`), {
      type: 'match_finished',
      message: `Match finished: ${matchData.homeManager.name} ${finalHomeScore} - ${finalAwayScore} ${matchData.awayManager.name}`,
      timestamp: Date.now(),
      read: false
    });

    // Award XP to goalscorers (50 XP per goal, 100 XP for Pro League)
    const goalscorers = matchData.goalscorers || {};
    const isProLeague = matchData.isProLeague || false;
    for (const scorerId in goalscorers) {
      const scorerData = goalscorers[scorerId];
      const managerId = scorerData.managerId;
      const xpPerGoal = isProLeague ? 100 : 50;  // Double XP for Pro League
      const xpEarned = scorerData.goals * xpPerGoal;

      const managerRef = ref(database, `managers/${managerId}`);
      const managerSnapshot = await get(managerRef);

      if (managerSnapshot.exists()) {
        const managerData = managerSnapshot.val();
        const updatedSquad = (managerData.squad || []).map(player => {
          if (player.id === scorerData.playerId) {
            return {
              ...player,
              xp: (player.xp || 0) + xpEarned
            };
          }
          return player;
        });

        await update(managerRef, { squad: updatedSquad });
        console.log(`Awarded ${xpEarned} XP to player ${scorerData.playerId}`);
      }
    }

    // Determine winner and award match rewards
    let winnerUid = null;
    let winnerName = '';
    if (finalHomeScore > finalAwayScore) {
      winnerUid = matchData.homeManager.uid;
      winnerName = matchData.homeManager.name;
    } else if (finalAwayScore > finalHomeScore) {
      winnerUid = matchData.awayManager.uid;
      winnerName = matchData.awayManager.name;
    }

    // Award money and bonus XP to winner
    if (winnerUid) {
      const winnerRef = ref(database, `managers/${winnerUid}`);
      const winnerSnapshot = await get(winnerRef);

      if (winnerSnapshot.exists()) {
        const winnerData = winnerSnapshot.val();
        const stadiumLevel = winnerData.facilities?.stadium || 0;

        // Base match winnings: $2M guaranteed
        const baseWinnings = 2000000;

        // Stadium bonus revenue
        const stadiumBonuses = [
          0,          // No stadium (level 0) - only base
          2000000,    // Level 1: +$2M bonus = $4M total
          5000000,    // Level 2: +$5M bonus = $7M total
          10000000,   // Level 3: +$10M bonus = $12M total
          20000000    // Level 4: +$20M bonus = $22M total
        ];

        const stadiumBonus = stadiumBonuses[stadiumLevel] || 0;
        let totalReward = baseWinnings + stadiumBonus;

        // Pro League matches give DOUBLE rewards
        const rewardMultiplier = matchData.isProLeague ? 2 : 1;
        totalReward = totalReward * rewardMultiplier;

        // Award money
        const newBudget = (winnerData.budget || 0) + totalReward;

        // Award bonus XP to all players in winning squad (100 XP each, 200 XP for Pro League)
        // IMPORTANT: Use the full manager squad from Firebase, not the match squad (which is only 11 players)
        const fullWinningSquad = winnerData.squad || [];
        const victoryXP = matchData.isProLeague ? 200 : 100;  // Double XP for Pro League

        const updatedWinningSquad = fullWinningSquad.map(player => ({
          ...player,
          xp: (player.xp || 0) + victoryXP
        }));

        await update(winnerRef, {
          budget: newBudget,
          squad: updatedWinningSquad
        });

        // Send detailed reward notification
        let rewardMessage = matchData.isProLeague ? `🏆🏆 Pro League Victory!\n\n` : `🏆 Victory!\n\n`;
        if (matchData.isProLeague) {
          rewardMessage += `🔥 Pro League Bonus: DOUBLE REWARDS!\n\n`;
        }
        const actualBaseWinnings = matchData.isProLeague ? baseWinnings * 2 : baseWinnings;
        const actualStadiumBonus = matchData.isProLeague ? stadiumBonus * 2 : stadiumBonus;
        rewardMessage += `💰 Base Match Winnings: ${(actualBaseWinnings / 1000000).toFixed(1)}M`;
        if (matchData.isProLeague) rewardMessage += ` (x2)`;
        rewardMessage += `\n`;
        if (stadiumLevel > 0) {
          rewardMessage += `🏟️ Stadium Bonus (Lv.${stadiumLevel}): +${(actualStadiumBonus / 1000000).toFixed(1)}M`;
          if (matchData.isProLeague) rewardMessage += ` (x2)`;
          rewardMessage += `\n`;
        }
        rewardMessage += `\n💵 Total Earned: ${(totalReward / 1000000).toFixed(1)}M\n`;
        rewardMessage += `⭐ All players gained +${victoryXP} XP!`;

        if (stadiumLevel === 0) {
          rewardMessage += `\n\n💡 Tip: Build a stadium to earn more!`;
        }

        await push(ref(database, `managers/${winnerUid}/notifications`), {
          type: 'match_reward',
          message: rewardMessage,
          timestamp: Date.now(),
          read: false
        });

        console.log(`Awarded $${totalReward} to ${winnerName} (Base: $${baseWinnings}, Stadium Lv.${stadiumLevel} Bonus: $${stadiumBonus})`);
      }
    }
  };

  const handleMatchFinished = (matchData) => {
    // Already handled by updateMatchStats
  };

  const startSubstitution = async (player, index) => {
    // Pause the match for both managers
    if (!currentMatch.isPractice) {
      const matchRef = ref(database, `matches/${currentMatch.id}`);
      await update(matchRef, {
        paused: true,
        pausedBy: currentUser.uid,
        pauseReason: 'substitution'
      });
    }

    setSubstitutionMode({ playerOut: player, playerOutIndex: index, selecting: false });
  };

  const makeSubstitution = async (playerIn) => {
    if (!currentMatch || !substitutionMode) return;

    const myTeam = isHome ? 'homeManager' : 'awayManager';
    const mySquad = isHome ? currentMatch.homeManager.squad : currentMatch.awayManager.squad;

    // Substitute
    const newSquad = [...mySquad];
    newSquad[substitutionMode.playerOutIndex] = playerIn;

    const newEvent = `${minute}' 🔄 ${isHome ? currentMatch.homeManager.name : currentMatch.awayManager.name}: ${playerIn.name} replaces ${substitutionMode.playerOut.name}`;

    // Update in Firebase or local state depending on match type
    if (!currentMatch.isPractice) {
      const matchRef = ref(database, `matches/${currentMatch.id}/${myTeam}`);
      await update(matchRef, { squad: newSquad });

      const currentEvents = (await get(ref(database, `matches/${currentMatch.id}`))).val().events || [];
      await update(ref(database, `matches/${currentMatch.id}`), {
        events: [newEvent, ...currentEvents]
      });
    } else {
      // For practice matches, update local state only
      const updatedMatch = {
        ...currentMatch,
        [myTeam]: {
          ...currentMatch[myTeam],
          squad: newSquad
        },
        events: [newEvent, ...(currentMatch.events || [])]
      };
      setCurrentMatch(updatedMatch);
    }

    // Track substituted player locally
    setSubstitutedPlayers([...substitutedPlayers, substitutionMode.playerOut.id]);
    setSubstitutionMode(null);
    setSubstitutionsUsed(substitutionsUsed + 1);
    showAlert('Substitution Made', `${playerIn.name} is now on the pitch.`);
  };

  // Log every render to debug state issues
  console.log('===== MATCH RENDER =====');
  console.log('matchState:', matchState);
  console.log('currentMatch?.state:', currentMatch?.state);
  console.log('currentMatch?.id:', currentMatch?.id);
  console.log('isHome:', isHome);
  console.log('========================');

  if (!managerProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Match</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Select Opponent Screen
  if (matchState === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🤝 Friendly Match</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* AI Practice Match */}
          <TouchableOpacity
            style={styles.aiMatchCard}
            onPress={() => startAIPracticeMatch()}
          >
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <View style={styles.aiInfo}>
                <Text style={styles.aiTitle}>Practice vs AI</Text>
                <Text style={styles.aiSubtitle}>Alkawaya Pro</Text>
                <Text style={styles.aiDesc}>Train your players without affecting points or budget</Text>
              </View>
            </View>
            <View style={styles.aiButton}>
              <Text style={styles.aiButtonText}>Start Practice</Text>
            </View>
          </TouchableOpacity>

          {/* Live Matches - Spectator Mode */}
          {liveMatches.length > 0 && (
            <>
              <View style={styles.sectionDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>LIVE MATCHES</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.clearStuckMatchesButton}
                onPress={async () => {
                  if (typeof window !== 'undefined' && window.confirm) {
                    const confirmed = window.confirm(`Clear ALL ${liveMatches.length} visible live/stuck match(es)? This will cancel all matches shown below.`);
                    if (!confirmed) return;
                  }

                  try {
                    if (liveMatches.length === 0) {
                      showAlert('Info', 'No matches to clear');
                      return;
                    }

                    const updates = {};
                    liveMatches.forEach(match => {
                      updates[`matches/${match.id}/state`] = 'cancelled';
                      updates[`matches/${match.id}/cancelledReason`] = 'Bulk cleanup - stuck match';
                      updates[`matches/${match.id}/cancelledAt`] = Date.now();
                    });

                    await update(ref(database), updates);
                    showAlert('Success', `Cleared ${liveMatches.length} match(es)`);
                  } catch (error) {
                    console.error('Error clearing stuck matches:', error);
                    showAlert('Error', 'Failed to clear stuck matches');
                  }
                }}
              >
                <Text style={styles.clearStuckMatchesText}>🧹 Clear ALL Visible Matches ({liveMatches.length})</Text>
              </TouchableOpacity>

              {liveMatches.map(match => (
                <View key={match.id} style={styles.liveMatchCard}>
                  <TouchableOpacity
                    onPress={async () => {
                      // Register as spectator
                      const matchRef = ref(database, `matches/${match.id}`);
                      const spectators = match.spectators || {};
                      spectators[currentUser.uid] = {
                        name: managerProfile.managerName,
                        joinedAt: Date.now()
                      };
                      await update(matchRef, { spectators });

                      setCurrentMatch({ ...match, id: match.id });
                      setIsHome(false); // Spectator mode
                      setMatchState('spectator');
                    }}
                  >
                    <View style={styles.liveMatchHeader}>
                      <Text style={styles.liveMatchIcon}>🔴 LIVE</Text>
                      <Text style={styles.liveMatchMinute}>{match.minute}'</Text>
                      <TouchableOpacity
                        style={styles.cancelLiveMatchButton}
                        onPress={async (e) => {
                          e.stopPropagation();
                          const homeName = match.homeManager?.managerName || match.homeManager?.name || 'Unknown';
                          const awayName = match.awayManager?.managerName || match.awayManager?.name || 'Unknown';

                          if (typeof window !== 'undefined' && window.confirm) {
                            const confirmed = window.confirm(`Cancel this match between ${homeName} and ${awayName}?`);
                            if (!confirmed) return;
                          }

                          try {
                            const matchRef = ref(database, `matches/${match.id}`);
                            await update(matchRef, {
                              state: 'cancelled',
                              cancelledReason: 'Manually cancelled by admin',
                              cancelledAt: Date.now()
                            });
                            showAlert('Success', 'Match cancelled successfully');
                          } catch (error) {
                            console.error('Error cancelling match:', error);
                            showAlert('Error', 'Failed to cancel match');
                          }
                        }}
                      >
                        <Text style={styles.cancelLiveMatchText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.liveMatchTeams}>
                      <View style={styles.liveMatchTeam}>
                        <Text style={styles.liveMatchTeamName}>
                          {match.homeManager?.clubName || match.homeManager?.managerName || match.homeManager?.name || 'Unknown'}
                        </Text>
                        <Text style={styles.liveMatchScore}>{match.homeScore || 0}</Text>
                      </View>
                      <Text style={styles.liveMatchVs}>vs</Text>
                      <View style={styles.liveMatchTeam}>
                        <Text style={styles.liveMatchScore}>{match.awayScore || 0}</Text>
                        <Text style={styles.liveMatchTeamName}>
                          {match.awayManager?.clubName || match.awayManager?.managerName || match.awayManager?.name || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.watchButton}>
                      <Text style={styles.watchButtonText}>👁️ Watch</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.matchAge}>
                    Created: {new Date(match.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CHALLENGE FRIENDS</Text>
            <View style={styles.dividerLine} />
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚽</Text>
              <Text style={styles.emptyTitle}>No Friends Available</Text>
              <Text style={styles.emptyDesc}>
                Add friends first to challenge them to a match!
              </Text>
            </View>
          ) : (
            friends.map(friend => (
              <TouchableOpacity
                key={friend.uid}
                style={styles.friendCard}
                onPress={() => challengeFriend(friend)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{friend.managerName.charAt(0)}</Text>
                </View>
                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>{friend.managerName}</Text>
                  <Text style={styles.friendStats}>
                    W:{friend.wins || 0} D:{friend.draws || 0} L:{friend.losses || 0} • Points: {friend.points || 0}
                  </Text>
                  <Text style={styles.friendSquad}>Squad: {friend.squad?.length || 0} players</Text>
                </View>
                <View style={styles.challengeButton}>
                  <Text style={styles.challengeButtonText}>Challenge</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Waiting for opponent to accept challenge
  if (matchState === 'waiting') {
    console.log('Rendering waiting screen - matchState:', matchState, 'currentMatch.state:', currentMatch?.state);
    console.log('currentMatch:', currentMatch);
    console.log('Has homeManager?', !!currentMatch?.homeManager);
    console.log('Has awayManager?', !!currentMatch?.awayManager);

    if (!currentMatch || !currentMatch.homeManager || !currentMatch.awayManager) {
      console.log('Missing data, showing loading screen');
      return (
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        </View>
      );
    }

    console.log('All data present, rendering waiting UI');
    const opponent = isHome ? currentMatch.awayManager : currentMatch.homeManager;
    const opponentName = opponent?.name || 'Opponent';
    const opponentReady = isHome ? currentMatch.awayManager?.ready : currentMatch.homeManager?.ready;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            setMatchState('select');
            setCurrentMatch(null);
          }} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Waiting for Opponent</Text>
          <TouchableOpacity
            style={styles.forfeitButton}
            onPress={forfeitMatch}
          >
            <Text style={styles.forfeitButtonText}>⚠️ Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.waitingTitle}>Challenge Sent</Text>
            <Text style={styles.waitingDesc}>
              Waiting for {opponentName} to accept your challenge...
            </Text>
            <Text style={styles.waitingStatus}>
              {opponentReady ? '✓ Opponent accepted! Moving to formation setup...' : '⏳ Waiting for response...'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoTitle}>What's Next?</Text>
            <Text style={styles.infoDesc}>
              Once {opponentName} accepts, you'll both be taken to the formation setup screen where you can arrange your starting XI and tactics.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Pre-match setup - adjust formation and tactics
  if (matchState === 'prematch') {
    console.log('Rendering prematch screen - matchState:', matchState, 'currentMatch.state:', currentMatch?.state);

    if (!currentMatch || !currentMatch.homeManager || !currentMatch.awayManager) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading match data...</Text>
          </View>
        </View>
      );
    }

    const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
    const mySquad = myTeam?.squad || [];
    const myFormation = myTeam?.formation || '4-3-3';
    const myPrematchReady = isHome ? currentMatch.homePrematchReady : currentMatch.awayPrematchReady;
    const opponentPrematchReady = isHome ? currentMatch.awayPrematchReady : currentMatch.homePrematchReady;

    console.log('Prematch screen - myPrematchReady:', myPrematchReady, 'opponentPrematchReady:', opponentPrematchReady, 'isHome:', isHome);

    const confirmPrematch = async () => {
      try {
        console.log('confirmPrematch called - isHome:', isHome, 'isPractice:', currentMatch.isPractice);

        if (!currentMatch.isPractice) {
          const matchRef = ref(database, `matches/${currentMatch.id}`);
          const readyField = isHome ? 'homePrematchReady' : 'awayPrematchReady';
          const tacticField = isHome ? 'homeTactic' : 'awayTactic';
          const squadField = isHome ? 'homeManager/squad' : 'awayManager/squad';
          const formationField = isHome ? 'homeManager/formation' : 'awayManager/formation';

          console.log('Updating Firebase with ready status:', readyField);

          await update(matchRef, {
            [readyField]: true,
            [tacticField]: selectedTactic,
            [squadField]: prematchStarting11,
            [formationField]: prematchFormation
          });

          console.log('Firebase updated, checking if both ready...');

          // Check if both ready
          const updatedSnapshot = await get(matchRef);
          const updatedMatch = updatedSnapshot.val();

          console.log('Home ready:', updatedMatch.homePrematchReady, 'Away ready:', updatedMatch.awayPrematchReady);

          if (updatedMatch.homePrematchReady && updatedMatch.awayPrematchReady) {
            // Both ready - start match immediately (skip 'ready' waiting screen)
            console.log('Both managers ready! Starting match...');
            await update(matchRef, {
              state: 'playing',
              startedAt: Date.now(),
              minute: 0,
              second: 0,
              homeScore: 0,
              awayScore: 0,
              events: []
            });
            console.log('Match state updated to playing');
          } else {
            console.log('Waiting for other manager to ready up...');
            showAlert('Ready!', 'Waiting for opponent to confirm...');
          }
        } else {
        // Practice match - go directly to playing
        setCurrentMatch({
          ...currentMatch,
          state: 'playing',
          homePrematchReady: true,
          awayPrematchReady: true,
          homeTactic: selectedTactic,
          homeManager: { ...currentMatch.homeManager, squad: prematchStarting11, formation: prematchFormation },
          startedAt: Date.now(),
          minute: 0,
          second: 0,
          homeScore: 0,
          awayScore: 0,
          events: []
        });
        setMatchState('playing');
        // Start practice match simulation
        simulatePracticeMatch();
        }
      } catch (error) {
        console.error('Error in confirmPrematch:', error);
        showAlert('Error', 'Failed to confirm ready. Please try again.');
      }
    };

    const selectPlayerForSlot = (player) => {
      if (selectingPlayerSlot !== null) {
        const newStarting11 = [...prematchStarting11];
        newStarting11[selectingPlayerSlot] = player;
        setPrematchStarting11(newStarting11);
        setSelectingPlayerSlot(null);
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pre-Match Setup</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>⚽</Text>
            <Text style={styles.infoTitle}>Review Your Team</Text>
            <Text style={styles.infoDesc}>
              Check your starting XI and tactics before the match begins
            </Text>
          </View>

          {/* Tactics Selection */}
          <View style={styles.prematchSection}>
            <Text style={styles.sectionTitle}>Select Tactics</Text>
            <View style={styles.tacticsRow}>
              {['Defensive', 'Balanced', 'Attacking'].map(tactic => (
                <TouchableOpacity
                  key={tactic}
                  style={[
                    styles.tacticCard,
                    selectedTactic === tactic && styles.tacticCardSelected
                  ]}
                  onPress={() => setSelectedTactic(tactic)}
                >
                  <Text style={[
                    styles.tacticText,
                    selectedTactic === tactic && styles.tacticTextSelected
                  ]}>
                    {tactic === 'Defensive' ? '🛡️' : tactic === 'Attacking' ? '⚔️' : '⚖️'}
                  </Text>
                  <Text style={[
                    styles.tacticLabel,
                    selectedTactic === tactic && styles.tacticLabelSelected
                  ]}>
                    {tactic}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Formation Selection */}
          <View style={styles.prematchSection}>
            <Text style={styles.sectionTitle}>Select Formation</Text>
            <View style={styles.formationButtonsRow}>
              {['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '3-4-3'].map(formation => (
                <TouchableOpacity
                  key={formation}
                  style={[
                    styles.formationBtn,
                    prematchFormation === formation && styles.formationBtnActive
                  ]}
                  onPress={() => setPrematchFormation(formation)}
                  disabled={myPrematchReady}
                >
                  <Text style={[
                    styles.formationBtnText,
                    prematchFormation === formation && styles.formationBtnTextActive
                  ]}>
                    {formation}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Formation Display with Clickable Players */}
          <View style={styles.prematchSection}>
            <Text style={styles.sectionTitle}>Starting XI - Tap to Change</Text>
            <View style={styles.prematchFormationPitch}>
              {getFormationPositions(prematchFormation, prematchStarting11).map((player, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.prematchPlayer,
                    { left: `${player.baseX}%`, top: `${player.baseY}%` }
                  ]}
                  onPress={() => !myPrematchReady && setSelectingPlayerSlot(idx)}
                  disabled={myPrematchReady}
                >
                  <View style={styles.prematchPlayerCircle}>
                    <Text style={styles.prematchPlayerName}>{player.name.split(' ').pop()}</Text>
                    <Text style={styles.prematchPlayerRating}>{player.overall}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Player Selection Modal */}
          {selectingPlayerSlot !== null && (
            <View style={styles.modal}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  Select Player for Position {selectingPlayerSlot + 1}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Current: {prematchStarting11[selectingPlayerSlot].name}
                </Text>
                <ScrollView style={styles.benchList}>
                  {(managerProfile.squad || [])
                    .filter(p => !prematchStarting11.some(sp => sp.id === p.id) || p.id === prematchStarting11[selectingPlayerSlot].id)
                    .map(player => (
                      <TouchableOpacity
                        key={player.id}
                        style={styles.benchPlayerOption}
                        onPress={() => selectPlayerForSlot(player)}
                      >
                        <View style={styles.benchPlayerInfo}>
                          <Text style={styles.benchPlayerName}>{player.name}</Text>
                          <Text style={styles.benchPlayerDetails}>
                            {player.position} • OVR {player.overall}
                          </Text>
                        </View>
                        <Text style={styles.benchPlayerRating}>{player.overall}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setSelectingPlayerSlot(null)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Ready Status */}
          <View style={styles.readyStatusCard}>
            <Text style={styles.readyStatusText}>
              You: {myPrematchReady ? '✓ Ready' : '⏳ Not Ready'}
            </Text>
            <Text style={styles.readyStatusText}>
              Opponent: {opponentPrematchReady ? '✓ Ready' : '⏳ Not Ready'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, myPrematchReady && styles.confirmButtonDisabled]}
            onPress={confirmPrematch}
            disabled={myPrematchReady}
          >
            <Text style={styles.confirmButtonText}>
              {myPrematchReady ? '✓ Waiting for Opponent...' : 'Confirm & Ready Up'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Both ready - show start button
  if (matchState === 'ready') {
    if (!currentMatch) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        </View>
      );
    }

    const opponent = isHome ? currentMatch.awayManager : currentMatch.homeManager;
    const myKickoffReady = isHome ? currentMatch.homeKickoffReady : currentMatch.awayKickoffReady;
    const opponentKickoffReady = isHome ? currentMatch.awayKickoffReady : currentMatch.homeKickoffReady;

    const myTacticField = isHome ? 'homeTactic' : 'awayTactic';
    const opponentTacticField = isHome ? 'awayTactic' : 'homeTactic';
    const myCurrentTactic = currentMatch[myTacticField] || 'Balanced';
    const opponentCurrentTactic = currentMatch[opponentTacticField] || 'Balanced';

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {currentMatch.isPractice ? 'Practice Match Ready!' :
             currentMatch.isProLeague ? '🏆 Pro League Ready!' :
             '🤝 Friendly Match Ready!'}
          </Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.matchupCard}>
            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{currentMatch.homeManager.name}</Text>
              <Text style={styles.teamReady}>{currentMatch.homeKickoffReady ? '⚽ Ready to Start' : '⏳ Waiting...'}</Text>
            </View>

            <Text style={styles.vs}>VS</Text>

            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{currentMatch.awayManager.name}</Text>
              <Text style={styles.teamReady}>{currentMatch.awayKickoffReady ? '⚽ Ready to Start' : '⏳ Waiting...'}</Text>
            </View>
          </View>

          {/* Tactics Selection */}
          <View style={styles.tacticsCard}>
            <Text style={styles.tacticsCardTitle}>Select Your Starting Tactic</Text>
            <Text style={styles.tacticsCardSubtitle}>Current: {myCurrentTactic}</Text>
            {currentMatch.isPractice && (
              <Text style={styles.tacticsCardSubtitle}>AI Tactic: {opponentCurrentTactic}</Text>
            )}

            <View style={styles.tacticsButtons}>
              {['Defensive', 'Balanced', 'Attacking'].map(tactic => (
                <TouchableOpacity
                  key={tactic}
                  style={[
                    styles.tacticButton,
                    myCurrentTactic === tactic && styles.tacticButtonActive
                  ]}
                  onPress={async () => {
                    if (!myKickoffReady) {
                      if (currentMatch.isPractice) {
                        const updatedMatch = { ...currentMatch, [myTacticField]: tactic };
                        setCurrentMatch(updatedMatch);
                        savePracticeMatchToStorage(updatedMatch, 'ready');
                      } else {
                        const matchRef = ref(database, `matches/${currentMatch.id}`);
                        await update(matchRef, { [myTacticField]: tactic });
                      }
                    }
                  }}
                  disabled={myKickoffReady}
                >
                  <Text style={styles.tacticButtonIcon}>
                    {tactic === 'Defensive' ? '🛡️' : tactic === 'Attacking' ? '⚔️' : '⚖️'}
                  </Text>
                  <Text style={styles.tacticButtonText}>{tactic}</Text>
                  <Text style={styles.tacticButtonDesc}>
                    {tactic === 'Defensive' ? 'Solid defense, counter-attacks' :
                     tactic === 'Attacking' ? 'Press forward, take risks' :
                     'Balanced approach'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.kickoffInfo}>
            <Text style={styles.kickoffInfoText}>
              {currentMatch.isPractice ? 'Click "Start Match" to begin' : 'Both managers must click "Start Match" to begin'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.startMatchButton, myKickoffReady && styles.startMatchButtonDisabled]}
            onPress={markReadyToKickoff}
            disabled={myKickoffReady}
          >
            <Text style={styles.startMatchButtonText}>
              {myKickoffReady ? '✓ Waiting for opponent...' : '⚽ Start Match'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Half-time screen
  if (matchState === 'halftime') {
    if (!currentMatch) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        </View>
      );
    }

    const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
    const mySquad = myTeam.squad;
    const mySecondHalfReady = isHome ? currentMatch.homeSecondHalfReady : currentMatch.awaySecondHalfReady;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Half Time</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.scoreBoard}>
            <Text style={styles.scoreBoardTitle}>Half Time Score</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreTeam}>{currentMatch.homeManager.name}</Text>
              <Text style={styles.score}>{homeScore} - {awayScore}</Text>
              <Text style={styles.scoreTeam}>{currentMatch.awayManager.name}</Text>
            </View>
          </View>

          <View style={styles.matchupCard}>
            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{currentMatch.homeManager.name}</Text>
              <Text style={styles.teamReady}>{currentMatch.homeSecondHalfReady ? '✓ Ready' : '⏳ Waiting...'}</Text>
            </View>

            <Text style={styles.vs}>VS</Text>

            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{currentMatch.awayManager.name}</Text>
              <Text style={styles.teamReady}>{currentMatch.awaySecondHalfReady ? '✓ Ready' : '⏳ Waiting...'}</Text>
            </View>
          </View>

          <View style={styles.substitutionSection}>
            <Text style={styles.sectionTitle}>Starting XI</Text>
            <Text style={styles.sectionDesc}>Tap a player to substitute them</Text>
            {mySquad.map((player, index) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerRow}
                onPress={() => startSubstitution(player, index)}
              >
                <Text style={styles.playerPosition}>{player.position}</Text>
                <Text style={styles.playerRowName}>{player.name}</Text>
                <Text style={styles.playerRowRating}>{player.overall}</Text>
                <Text style={styles.subIcon}>🔄</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, mySecondHalfReady && styles.startMatchButtonDisabled]}
            onPress={resumeFromHalftime}
            disabled={mySecondHalfReady}
          >
            <Text style={styles.continueButtonText}>
              {mySecondHalfReady ? '✓ Waiting for opponent...' : 'Continue to 2nd Half'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {substitutionMode && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Substitute {substitutionMode.playerOut.name}</Text>
              <Text style={styles.modalSubtitle}>Select replacement from bench:</Text>

              <ScrollView style={styles.benchList}>
                {(managerProfile.squad || [])
                  .filter(p => !mySquad.some(fp => fp.id === p.id))
                  .map(player => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.benchPlayerOption}
                      onPress={() => makeSubstitution(player)}
                    >
                      <View>
                        <Text style={styles.benchPlayerName}>{player.name}</Text>
                        <Text style={styles.benchPlayerDetails}>
                          {player.position} • OVR {player.overall}
                        </Text>
                      </View>
                      <Text style={styles.benchPlayerRating}>{player.overall}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSubstitutionMode(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Playing screen
  if (matchState === 'playing') {
    if (!currentMatch) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        </View>
      );
    }

    const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
    const mySquad = myTeam.squad;
    const myTactic = isHome ? (currentMatch.homeTactic || 'Balanced') : (currentMatch.awayTactic || 'Balanced');

    const changeTactic = async (newTactic) => {
      setSelectedTactic(newTactic);

      if (currentMatch.isPractice) {
        // For practice matches, update local state
        const tacticField = isHome ? 'homeTactic' : 'awayTactic';
        const updatedMatch = {
          ...currentMatch,
          [tacticField]: newTactic
        };
        setCurrentMatch(updatedMatch);

        // Also update localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('practiceMatch', JSON.stringify(updatedMatch));
        }
      } else {
        // For online matches, update Firebase
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        const tacticField = isHome ? 'homeTactic' : 'awayTactic';
        await update(matchRef, { [tacticField]: newTactic });
      }
    };

    const requestSubstitution = async (playerOut, playerOutIndex) => {
      if (substitutionsUsed >= 5) {
        showAlert('No Substitutions Left', 'You have used all 5 substitutions.');
        return;
      }
      setSubstitutionMode({ playerOut, playerOutIndex });
    };

    const renderPitch = (homeSquad, awaySquad, homeFormation = '4-3-3', awayFormation = '4-3-3') => {
      // Get base positions from formation
      let homePlayers = getFormationPositions(homeFormation, homeSquad);
      let awayPlayers = getFormationPositions(awayFormation, awaySquad);

      // Apply tactic-based position adjustments
      const homeTactic = currentMatch.homeTactic || 'Balanced';
      const awayTactic = currentMatch.awayTactic || 'Balanced';
      homePlayers = adjustPositionsForTactic(homePlayers, homeTactic, true);
      awayPlayers = adjustPositionsForTactic(awayPlayers, awayTactic, false);

      // Advanced time-based animation system for realistic movement
      const time = minute + (Date.now() % 1000) / 1000; // Sub-second precision

      // Determine possession with more intelligent switching based on events
      const lastEvent = events[0] || '';
      let possessionTeam = Math.floor(time / 8) % 2; // Changes every 8 seconds for longer attacks

      // Check if last event indicates clear possession
      if (lastEvent.includes('GOAL!')) {
        // After goal, defending team gets possession
        possessionTeam = lastEvent.includes(homeSquad[0]?.name) ? 1 : 0;
      } else if (lastEvent.includes('save') || lastEvent.includes('denied')) {
        // After save, defending team clears the ball
        const isHomeGK = lastEvent.includes('GK') && homeSquad.some(p => lastEvent.includes(p.name));
        possessionTeam = isHomeGK ? 0 : 1;
      }

      // Select ball carrier - Use ACTUAL ball holder from match simulation if available
      let ballCarrier;

      // Check if we have actual ball holder data from the match simulation
      if (currentMatch.ballHolder && currentMatch.ballHolder.playerId) {
        // Find the player with the ball from either team
        ballCarrier = homePlayers.find(p => p.id === currentMatch.ballHolder.playerId) ||
                      awayPlayers.find(p => p.id === currentMatch.ballHolder.playerId);

        // Update possession team based on ball holder
        if (ballCarrier) {
          possessionTeam = currentMatch.ballHolder.team === 'home' ? 0 : 1;
        }
      }

      // Fallback to time-based calculation if no ball holder data
      if (!ballCarrier) {
        const attackProgress = (time % 15) / 15; // 15 second attack cycle (0.0 to 1.0)
        let attackingPlayers;

        if (attackProgress < 0.35) {
          // Build-up phase (0-35%): Start from back, midfielders and defenders
          attackingPlayers = possessionTeam === 0
            ? homePlayers.filter(p => ['CM', 'CDM', 'CAM', 'LM', 'RM', 'CB', 'LB', 'RB'].includes(p.position))
            : awayPlayers.filter(p => ['CM', 'CDM', 'CAM', 'LM', 'RM', 'CB', 'LB', 'RB'].includes(p.position));
        } else if (attackProgress < 0.70) {
          // Middle phase (35-70%): Midfield play
          attackingPlayers = possessionTeam === 0
            ? homePlayers.filter(p => ['CM', 'CDM', 'CAM', 'LM', 'RM', 'LW', 'RW'].includes(p.position))
            : awayPlayers.filter(p => ['CM', 'CDM', 'CAM', 'LM', 'RM', 'LW', 'RW'].includes(p.position));
        } else {
          // Final third (70-100%): Attacking players only
          attackingPlayers = possessionTeam === 0
            ? homePlayers.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position))
            : awayPlayers.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position));
        }

        // Use consistent index based on attack progress to avoid sudden jumps
        const carrierIndex = Math.floor(attackProgress * attackingPlayers.length);
        ballCarrier = attackingPlayers.length > 0
          ? attackingPlayers[Math.min(carrierIndex, attackingPlayers.length - 1)]
          : (possessionTeam === 0 ? homePlayers[0] : awayPlayers[0]);
      }

      // Ball position - STICK to the ball carrier (no floating)
      // CSS transitions handle the smooth movement between players
      const ballX = possessionTeam === 0
        ? ballCarrier.baseX
        : 100 - ballCarrier.baseX;
      const ballY = possessionTeam === 0
        ? ballCarrier.baseY
        : 100 - ballCarrier.baseY;

      return (
        <View style={styles.pitchContainer}>
          <View style={styles.pitch}>
            {/* Top Goal (Away) */}
            <View style={styles.goalTop}>
              <View style={styles.goalNet} />
            </View>

            {/* Bottom Goal (Home) */}
            <View style={styles.goalBottom}>
              <View style={styles.goalNet} />
            </View>

            {/* Pitch markings */}
            <View style={styles.pitchHalfLine} />
            <View style={styles.pitchCenterCircle} />
            <View style={styles.pitchCenterDot} />

            {/* Penalty areas */}
            <View style={styles.penaltyAreaTop} />
            <View style={styles.penaltyAreaBottom} />

            {/* Ball with dynamic position - HIDE during shot animation */}
            {!shotAnimation && (
              <View style={[styles.ball, { left: `${ballX}%`, top: `${ballY}%` }]} />
            )}

            {/* Shot trajectory animation - This becomes the ONLY ball during shot */}
            {shotAnimation && (() => {
              const elapsed = Date.now() - shotAnimation.startTime;
              const duration = 1200; // 1200ms shot duration (longer to see it reach goal)
              const progress = Math.min(elapsed / duration, 1);

              if (progress >= 1) {
                // Clear animation when complete
                setTimeout(() => setShotAnimation(null), 100);
              }

              // Calculate ball position along trajectory with arc
              const currentX = shotAnimation.fromX + (shotAnimation.toX - shotAnimation.fromX) * progress;
              const currentY = shotAnimation.fromY + (shotAnimation.toY - shotAnimation.fromY) * progress;

              // Add parabolic arc to shot
              const arcHeight = 8; // Maximum arc height
              const arc = arcHeight * Math.sin(progress * Math.PI); // Parabolic curve

              return (
                <View
                  style={[
                    styles.shotBall,
                    {
                      left: `${currentX}%`,
                      top: `${currentY - arc}%`,
                      opacity: 1 - progress * 0.3 // Slightly fade as it reaches goal
                    }
                  ]}
                />
              );
            })()}

            {/* Home Team (bottom) - advanced position-based movement with attacking/defending */}
            {homePlayers.map((player, idx) => {
              // Position-specific movement multipliers
              const isGK = player.position === 'GK';
              const isDefender = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(player.position);
              const isMidfielder = ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(player.position);
              const isAttacker = ['ST', 'LW', 'RW'].includes(player.position);

              // Determine if this team is attacking or defending
              const isAttacking = possessionTeam === 0;
              const hasBall = ballCarrier && ballCarrier.id === player.id && possessionTeam === 0;

              // Dynamic movement based on attacking/defending state
              let xMovement, yMovement;

              if (isAttacking) {
                // When attacking: push forward, spread wide - BALANCED movement
                const attackingHorizontal = isGK ? 0.1 : (isDefender ? 0.5 : (isMidfielder ? 0.8 : 1.1));
                const attackingVertical = isGK ? 0.1 : (isDefender ? 0.6 : (isMidfielder ? 0.9 : 1.3));

                xMovement = Math.sin(time * 0.4 + idx * 0.5) * attackingHorizontal;
                yMovement = Math.cos(time * 0.35 + idx * 0.3) * attackingVertical - (isDefender ? 0.5 : 1.5); // Push up

                // Wide players move to flanks when attacking
                if (['LW', 'LM', 'LB', 'LWB'].includes(player.position)) {
                  xMovement -= 1.0;
                } else if (['RW', 'RM', 'RB', 'RWB'].includes(player.position)) {
                  xMovement += 1.0;
                }
              } else {
                // When defending: drop back, compact shape - BALANCED movement
                const defendingHorizontal = isGK ? 0.1 : (isDefender ? 0.3 : (isMidfielder ? 0.5 : 0.7));
                const defendingVertical = isGK ? 0.08 : (isDefender ? 0.25 : (isMidfielder? 0.5 : 0.7));

                xMovement = Math.sin(time * 0.35 + idx * 0.4) * defendingHorizontal;
                yMovement = Math.cos(time * 0.3 + idx * 0.3) * defendingVertical + (isAttacker ? 1.2 : 0); // Drop back

                // Compact shape - pull towards center
                if (player.baseX < 35) xMovement += 0.3;
                else if (player.baseX > 65) xMovement -= 0.3;
              }

              // Player with ball moves more actively
              if (hasBall) {
                xMovement *= 1.3;
                yMovement *= 1.3;
              }

              const x = Math.max(5, Math.min(95, player.baseX + xMovement));
              const y = Math.max(5, Math.min(95, player.baseY + yMovement));

              return (
                <View
                  key={`home-${idx}`}
                  style={[
                    styles.playerDot,
                    styles.playerDotHome,
                    hasBall && styles.playerWithBall,
                    { left: `${x}%`, top: `${y}%` }
                  ]}
                >
                  <Text style={styles.playerDotText}>{player.position}</Text>
                  <Text style={styles.playerNumber}>{idx + 1}</Text>
                </View>
              );
            })}

            {/* Away Team (top) - advanced position-based movement with attacking/defending, inverted Y */}
            {awayPlayers.map((player, idx) => {
              // Position-specific movement multipliers
              const isGK = player.position === 'GK';
              const isDefender = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(player.position);
              const isMidfielder = ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(player.position);
              const isAttacker = ['ST', 'LW', 'RW'].includes(player.position);

              // Determine if this team is attacking or defending
              const isAttacking = possessionTeam === 1;
              const hasBall = ballCarrier && ballCarrier.id === player.id && possessionTeam === 1;

              // Dynamic movement based on attacking/defending state
              let xMovement, yMovement;

              if (isAttacking) {
                // When attacking: push forward, spread wide - BALANCED movement
                const attackingHorizontal = isGK ? 0.1 : (isDefender ? 0.5 : (isMidfielder ? 0.8 : 1.1));
                const attackingVertical = isGK ? 0.1 : (isDefender ? 0.6 : (isMidfielder ? 0.9 : 1.3));

                xMovement = Math.sin(time * 0.4 + idx * 0.5) * attackingHorizontal;
                yMovement = Math.cos(time * 0.35 + idx * 0.3) * attackingVertical + (isDefender ? 0.5 : 1.5); // Push down (inverted)

                // Wide players move to flanks when attacking
                if (['LW', 'LM', 'LB', 'LWB'].includes(player.position)) {
                  xMovement -= 1.0;
                } else if (['RW', 'RM', 'RB', 'RWB'].includes(player.position)) {
                  xMovement += 1.0;
                }
              } else {
                // When defending: drop back, compact shape - BALANCED movement
                const defendingHorizontal = isGK ? 0.1 : (isDefender ? 0.3 : (isMidfielder ? 0.5 : 0.7));
                const defendingVertical = isGK ? 0.08 : (isDefender ? 0.25 : (isMidfielder ? 0.5 : 0.7));

                xMovement = Math.sin(time * 0.35 + idx * 0.4) * defendingHorizontal;
                yMovement = Math.cos(time * 0.3 + idx * 0.3) * defendingVertical - (isAttacker ? 1.2 : 0); // Pull up (inverted)

                // Compact shape - pull towards center
                if (player.baseX < 35) xMovement += 0.3;
                else if (player.baseX > 65) xMovement -= 0.3;
              }

              // Player with ball moves more actively
              if (hasBall) {
                xMovement *= 1.3;
                yMovement *= 1.3;
              }

              const x = Math.max(5, Math.min(95, player.baseX + xMovement));
              const y = 100 - Math.max(5, Math.min(95, player.baseY + yMovement));

              return (
                <View
                  key={`away-${idx}`}
                  style={[
                    styles.playerDot,
                    styles.playerDotAway,
                    hasBall && styles.playerWithBall,
                    { left: `${x}%`, top: `${y}%` }
                  ]}
                >
                  <Text style={styles.playerDotText}>{player.position}</Text>
                  <Text style={styles.playerNumber}>{idx + 1}</Text>
                </View>
              );
            })}
          </View>

          {/* Match Info Overlay with possession */}
          <View style={styles.pitchInfoOverlay}>
            <Text style={styles.pitchInfoText}>
              ⚽ {possessionTeam === 0 ? currentMatch.homeManager.name : currentMatch.awayManager.name} in possession
            </Text>
          </View>
        </View>
      );
    };

    const confirmSubstitution = async (playerIn) => {
      if (!substitutionMode) return;

      const newSquad = [...mySquad];
      newSquad[substitutionMode.playerOutIndex] = playerIn;

      const eventText = `${minute}' 🔄 SUB: ${playerIn.name} replaces ${substitutionMode.playerOut.name}`;

      if (!currentMatch.isPractice) {
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        const teamPath = isHome ? 'homeManager' : 'awayManager';
        await update(ref(database, `matches/${currentMatch.id}/${teamPath}`), { squad: newSquad });

        // Add substitution event and track substituted player
        const currentData = (await get(matchRef)).val();
        const newEvents = [eventText, ...(currentData.events || [])];

        // Track substituted players
        const substitutedPlayersList = currentData.substitutedPlayers || [];
        if (!substitutedPlayersList.includes(substitutionMode.playerOut.id)) {
          substitutedPlayersList.push(substitutionMode.playerOut.id);
        }

        // Resume match after substitution
        await update(matchRef, {
          events: newEvents,
          substitutedPlayers: substitutedPlayersList,
          paused: false,
          pausedBy: null,
          pauseReason: null
        });
      } else {
        // For practice matches, update local state only
        const myTeam = isHome ? 'homeManager' : 'awayManager';
        const updatedMatch = {
          ...currentMatch,
          [myTeam]: {
            ...currentMatch[myTeam],
            squad: newSquad
          },
          events: [eventText, ...(currentMatch.events || [])],
          paused: false,
          pausedBy: null,
          pauseReason: null
        };
        setCurrentMatch(updatedMatch);
        savePracticeMatchToStorage(updatedMatch, matchState);
      }

      // Track substituted player locally
      setSubstitutedPlayers([...substitutedPlayers, substitutionMode.playerOut.id]);
      setSubstitutionsUsed(substitutionsUsed + 1);
      setSubstitutionMode(null);
      showAlert('Substitution Complete', `${playerIn.name} is now on the pitch. Match resumed.`);
      setPauseCountdown(20);
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>
              {currentMatch.isPractice ? 'Practice Match vs AI' :
               currentMatch.isProLeague ? '🏆 Pro League Match' :
               '🤝 Friendly Match'}
            </Text>
            {!currentMatch.spectators?.[currentUser?.uid] && (
              <TouchableOpacity
                style={styles.forfeitButton}
                onPress={forfeitMatch}
              >
                <Text style={styles.forfeitButtonText}>⚠️ Forfeit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.liveScoreBoard}>
            <View style={styles.minuteDisplay}>
              <Text style={styles.minuteText}>{minute}'</Text>
              <Text style={styles.liveIndicator}>● LIVE</Text>
            </View>
            <View style={styles.liveScoreRow}>
              <View style={styles.liveTeam}>
                <Text style={styles.liveTeamName} numberOfLines={1} ellipsizeMode="tail">
                  {currentMatch.homeManager.clubName || currentMatch.homeManager.managerName}
                </Text>
                <Text style={styles.liveScore}>{homeScore}</Text>
              </View>
              <Text style={styles.liveDash}>-</Text>
              <View style={styles.liveTeam}>
                <Text style={styles.liveScore}>{awayScore}</Text>
                <Text style={styles.liveTeamName} numberOfLines={1} ellipsizeMode="tail">
                  {currentMatch.awayManager.clubName || currentMatch.awayManager.managerName}
                </Text>
              </View>
            </View>
          </View>

          {/* Pitch Visualization */}
          {renderPitch(
            currentMatch.homeManager.squad,
            currentMatch.awayManager.squad,
            currentMatch.homeManager.formation || '4-3-3',
            currentMatch.awayManager.formation || '4-3-3'
          )}

          {/* Pause Countdown Banner with Resume Button */}
          {currentMatch.paused && pauseCountdown > 0 && (
            <View style={styles.pauseOverlay}>
              <View style={styles.pauseBanner}>
                <Text style={styles.pauseIcon}>⏸️</Text>
                <View style={styles.pauseInfo}>
                  <Text style={styles.pauseTitle}>Match Paused - Substitution Time</Text>
                  <Text style={styles.pauseCountdown}>⏱️ Auto-resuming in {pauseCountdown} seconds</Text>
                  <Text style={styles.pauseSubtitle}>Both managers can substitute now</Text>
                </View>
              </View>

              {/* Resume Status */}
              <View style={styles.resumeStatusCard}>
                <Text style={styles.resumeStatusTitle}>Resume Status:</Text>
                <View style={styles.resumeStatusRow}>
                  <View style={styles.resumeTeamStatus}>
                    <Text style={styles.resumeTeamName}>{currentMatch.homeManager.name}</Text>
                    <Text style={[
                      styles.resumeStatus,
                      homeResumeReady && styles.resumeStatusReady
                    ]}>
                      {homeResumeReady ? '✓ Ready' : '⏳ Waiting...'}
                    </Text>
                  </View>
                  <View style={styles.resumeTeamStatus}>
                    <Text style={styles.resumeTeamName}>{currentMatch.awayManager.name}</Text>
                    <Text style={[
                      styles.resumeStatus,
                      awayResumeReady && styles.resumeStatusReady
                    ]}>
                      {awayResumeReady ? '✓ Ready' : '⏳ Waiting...'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Resume Button */}
              {!currentMatch.spectators?.[currentUser?.uid] && (
                <TouchableOpacity
                  style={[
                    styles.resumeButton,
                    (isHome ? homeResumeReady : awayResumeReady) && styles.resumeButtonDisabled
                  ]}
                  onPress={async () => {
                    const matchRef = ref(database, `matches/${currentMatch.id}`);
                    const resumeField = isHome ? 'homeResumeReady' : 'awayResumeReady';
                    await update(matchRef, { [resumeField]: true });
                  }}
                  disabled={isHome ? homeResumeReady : awayResumeReady}
                >
                  <Text style={styles.resumeButtonText}>
                    {(isHome ? homeResumeReady : awayResumeReady)
                      ? '✓ Waiting for opponent...'
                      : '▶️ Ready to Resume'
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* In-Match Tactics Switcher - Disabled for Spectators */}
          {!currentMatch.spectators?.[currentUser?.uid] && (
            <View style={styles.inMatchTactics}>
              <Text style={styles.tacticsTitle}>Tactics: {myTactic}</Text>
              <View style={styles.tacticsRow}>
                {['Defensive', 'Balanced', 'Attacking'].map(tactic => (
                  <TouchableOpacity
                    key={tactic}
                    style={[
                      styles.miniTacticBtn,
                      myTactic === tactic && styles.miniTacticBtnActive
                    ]}
                    onPress={() => changeTactic(tactic)}
                  >
                    <Text style={styles.miniTacticText}>
                      {tactic === 'Defensive' ? '🛡️' : tactic === 'Attacking' ? '⚔️' : '⚖️'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Substitutions Section with Pause Button - Hidden for Spectators */}
          {!currentMatch.spectators?.[currentUser?.uid] && (
            <View style={styles.subsSection}>
              <View style={styles.subsHeader}>
                <View>
                  <Text style={styles.subsTitle}>
                    Substitutions: {substitutionsUsed}/5 used
                  </Text>
                  {substitutionsUsed < 5 && (
                    <Text style={styles.subsHint}>Make tactical changes</Text>
                  )}
                </View>
                {substitutionsUsed < 5 && !currentMatch.paused && (
                  <View style={styles.pauseContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pauseSubButton,
                      (isHome ? homePausesUsed : awayPausesUsed) >= 2 && styles.pauseSubButtonDisabled
                    ]}
                    onPress={async () => {
                      const myPausesUsed = isHome ? homePausesUsed : awayPausesUsed;
                      if (myPausesUsed >= 2) {
                        showAlert('Pause Limit Reached', 'You have already used both pauses this match.');
                        return;
                      }

                      // Pause the match for both managers with 25-second timer
                      if (!currentMatch.isPractice) {
                        const matchRef = ref(database, `matches/${currentMatch.id}`);
                        const pauseField = isHome ? 'homePausesUsed' : 'awayPausesUsed';
                        await update(matchRef, {
                          paused: true,
                          pausedBy: currentUser.uid,
                          pauseReason: 'substitution',
                          pauseStartTime: Date.now(),
                          pauseEndTime: Date.now() + 25000, // 25 seconds
                          [pauseField]: myPausesUsed + 1,
                          homeResumeReady: false,
                          awayResumeReady: false
                        });
                      }
                      setSubstitutionMode({ selecting: true });
                      setPauseCountdown(25);
                    }}
                    disabled={(isHome ? homePausesUsed : awayPausesUsed) >= 2}
                  >
                    <Text style={styles.pauseSubButtonText}>
                      ⏸️ {2 - (isHome ? homePausesUsed : awayPausesUsed)}/2
                    </Text>
                  </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Squad List for Substitution */}
              {substitutionMode?.selecting && (
                <View style={styles.quickSubList}>
                  <Text style={styles.quickSubTitle}>Select player to substitute:</Text>
                  {mySquad.map((player, index) => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.quickSubPlayer}
                      onPress={() => startSubstitution(player, index)}
                    >
                      <Text style={styles.quickSubPlayerPos}>{player.position}</Text>
                      <Text style={styles.quickSubPlayerName}>{player.name}</Text>
                      <Text style={styles.quickSubPlayerRating}>{player.overall}</Text>
                      <Text style={styles.quickSubIcon}>🔄</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.quickSubCancel}
                    onPress={() => setSubstitutionMode(null)}
                  >
                    <Text style={styles.quickSubCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Events */}
          <View style={styles.eventsContainer}>
            <Text style={styles.eventsTitle}>Match Events</Text>
            {events.length === 0 ? (
              <Text style={styles.noEvents}>No events yet...</Text>
            ) : (
              events.map((event, index) => (
                <View key={index} style={styles.eventRow}>
                  <Text style={styles.eventText}>{event}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Substitution Modal with Formation View */}
        {substitutionMode && !substitutionMode.selecting && (() => {
          // Define mySquad and myFormation for substitution modal
          const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
          const mySquad = myTeam?.squad || [];
          const myFormation = myTeam?.formation || '4-3-3';

          return (
            <View style={styles.modal}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  ⏸️ Match Paused - Substitution
                </Text>
                <Text style={styles.modalSubtitle}>
                  Substitute {substitutionMode.playerOut.name} ({substitutionMode.playerOut.position})
                </Text>

                {/* Mini Formation View */}
                <View style={styles.miniFormationContainer}>
                  <Text style={styles.miniFormationTitle}>Current Formation: {myFormation}</Text>
                  <View style={styles.miniFormation}>
                    {mySquad.map((player, idx) => {
                      const isPlayerOut = player.id === substitutionMode.playerOut.id;
                      const layout = getFormationPositions(myFormation, mySquad);
                      const pos = layout[idx];

                      return (
                        <View
                          key={player.id}
                          style={[
                            styles.miniPlayer,
                            isPlayerOut && styles.miniPlayerOut,
                            { left: `${pos.baseX}%`, top: `${pos.baseY}%` }
                          ]}
                        >
                          <Text style={styles.miniPlayerText}>{player.position}</Text>
                          {isPlayerOut && <Text style={styles.miniPlayerOutIcon}>❌</Text>}
                        </View>
                      );
                    })}
                  </View>
                </View>

              <Text style={styles.benchTitle}>Choose Replacement from Bench:</Text>
              <ScrollView style={styles.benchList}>
                {(() => {
                  const benchPlayers = (managerProfile.squad || [])
                    .filter(p => !mySquad.some(fp => fp.id === p.id))
                    .filter(p => !substitutedPlayers.includes(p.id));
                  console.log('Total squad:', managerProfile.squad?.length || 0);
                  console.log('Starting 11:', mySquad.length);
                  console.log('Substituted players:', substitutedPlayers.length);
                  console.log('Bench players available:', benchPlayers.length);

                  if (benchPlayers.length === 0) {
                    return (
                      <View style={styles.noBenchPlayers}>
                        <Text style={styles.noBenchText}>No substitutes available</Text>
                        <Text style={styles.noBenchSubtext}>You need more than 11 players in your squad to make substitutions</Text>
                      </View>
                    );
                  }

                  return benchPlayers.map(player => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.benchPlayerOption}
                      onPress={() => confirmSubstitution(player)}
                    >
                      <View style={styles.benchPlayerInfo}>
                        <Text style={styles.benchPlayerName}>{player.name}</Text>
                        <Text style={styles.benchPlayerDetails}>
                          {player.position} • OVR {player.overall}
                        </Text>
                      </View>
                      <Text style={styles.benchPlayerRating}>{player.overall}</Text>
                    </TouchableOpacity>
                  ));
                })()}
              </ScrollView>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={async () => {
                  // Resume match if canceled
                  if (!currentMatch.isPractice) {
                    const matchRef = ref(database, `matches/${currentMatch.id}`);
                    await update(matchRef, {
                      paused: false,
                      pausedBy: null,
                      pauseReason: null
                    });
                  }
                  setSubstitutionMode(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel & Resume Match</Text>
              </TouchableOpacity>
            </View>
          </View>
          );
        })()}

        {/* Goal Moment - Dramatic full-screen overlay when goal is scored */}
        {goalMoment && (
          <View style={styles.goalMomentOverlay}>
            <View style={styles.goalMomentContent}>
              <Text style={styles.goalMomentBig}>⚽</Text>
              <Text style={styles.goalMomentTitle}>GOAAAAAL!</Text>
              <Text style={styles.goalMomentScorer}>{goalMoment.scorer}</Text>
              <View style={[styles.goalMomentTeamBadge, goalMoment.team === 'home' ? styles.goalMomentHome : styles.goalMomentAway]}>
                <Text style={styles.goalMomentTeamText}>{goalMoment.team === 'home' ? currentMatch.homeManager.name : currentMatch.awayManager.name}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Goal Celebration Overlay - Fixed position */}
        {goalCelebration && (
          <View style={styles.goalCelebrationOverlay}>
            <Text style={styles.goalCelebrationText}>GOAAAAAL!</Text>
            <Text style={styles.goalCelebrationScorer}>{goalCelebration.scorer}</Text>
            <Text style={styles.goalCelebrationEmoji}>⚽🎉</Text>
          </View>
        )}
      </View>
    );
  }

  // Spectator mode - watch live matches
  if (matchState === 'spectator') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={async () => {
            // Remove spectator when leaving
            if (currentMatch?.id) {
              const matchRef = ref(database, `matches/${currentMatch.id}/spectators/${currentUser.uid}`);
              await update(ref(database, `matches/${currentMatch.id}`), {
                [`spectators/${currentUser.uid}`]: null
              });
            }
            setMatchState('select');
            setCurrentMatch(null);
          }} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🔴 Watching Live Match</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.spectatorBanner}>
            <Text style={styles.spectatorIcon}>👁️</Text>
            <View style={styles.spectatorInfo}>
              <Text style={styles.spectatorTitle}>Spectator Mode</Text>
              <Text style={styles.spectatorDesc}>You are watching this match live</Text>
            </View>
          </View>

          {/* Watchers List */}
          {currentMatch?.spectators && Object.keys(currentMatch.spectators).length > 0 && (
            <View style={styles.watchersCard}>
              <Text style={styles.watchersTitle}>
                👁️ Watching ({Object.keys(currentMatch.spectators).length})
              </Text>
              <View style={styles.watchersList}>
                {Object.entries(currentMatch.spectators).map(([uid, spectator]) => (
                  <View key={uid} style={styles.watcherChip}>
                    <Text style={styles.watcherName}>{spectator.name || 'Unknown'}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.liveScoreBoard}>
            <View style={styles.minuteDisplay}>
              <Text style={styles.minuteText}>{minute}'</Text>
              <Text style={styles.liveIndicator}>● LIVE</Text>
            </View>
            <View style={styles.liveScoreRow}>
              <View style={styles.liveTeam}>
                <Text style={styles.liveTeamName} numberOfLines={1} ellipsizeMode="tail">
                  {currentMatch.homeManager.clubName || currentMatch.homeManager.managerName}
                </Text>
                <Text style={styles.liveScore}>{homeScore}</Text>
              </View>
              <Text style={styles.liveDash}>-</Text>
              <View style={styles.liveTeam}>
                <Text style={styles.liveScore}>{awayScore}</Text>
                <Text style={styles.liveTeamName} numberOfLines={1} ellipsizeMode="tail">
                  {currentMatch.awayManager.clubName || currentMatch.awayManager.managerName}
                </Text>
              </View>
            </View>
          </View>

          {/* Spectator Info - Pitch removed to prevent duplicate rendering */}
          <View style={styles.spectatorInfoCard}>
            <Text style={styles.spectatorInfoText}>Watch the match unfold in real-time! Check the events below for live updates.</Text>
          </View>

          {/* Match State Info */}
          {matchState === 'halftime' && (
            <View style={styles.halftimeBanner}>
              <Text style={styles.halftimeIcon}>⏸️</Text>
              <Text style={styles.halftimeTitle}>Half Time</Text>
            </View>
          )}

          {pauseCountdown > 0 && (
            <View style={styles.pauseBanner}>
              <Text style={styles.pauseIcon}>⏸️</Text>
              <View style={styles.pauseInfo}>
                <Text style={styles.pauseTitle}>Match Paused - Substitution</Text>
                <Text style={styles.pauseCountdown}>Resuming in {pauseCountdown} seconds</Text>
              </View>
            </View>
          )}

          {/* Match Timeline */}
          <View style={styles.eventsSection}>
            <Text style={styles.eventsTitle}>Match Timeline</Text>
            {events.length === 0 ? (
              <Text style={styles.noEvents}>No events yet...</Text>
            ) : (
              events.map((event, index) => (
                <View key={index} style={styles.eventItem}>
                  <Text style={styles.eventText}>{event}</Text>
                </View>
              ))
            )}
          </View>

          {/* Spectators List */}
          {currentMatch.spectators && Object.keys(currentMatch.spectators).length > 0 && (
            <View style={styles.spectatorsSection}>
              <Text style={styles.spectatorsTitle}>👁️ Watching Now ({Object.keys(currentMatch.spectators).length})</Text>
              <View style={styles.spectatorsList}>
                {Object.values(currentMatch.spectators).map((spectator, index) => (
                  <View key={index} style={styles.spectatorChip}>
                    <Text style={styles.spectatorChipText}>{spectator.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Squads */}
          <View style={styles.squadsSection}>
            <Text style={styles.squadsTitle}>Starting XI</Text>

            <View style={styles.teamSquadSection}>
              <Text style={styles.teamSquadTitle}>{currentMatch.homeManager.managerName}</Text>
              {currentMatch.homeManager.squad.map((player, idx) => (
                <View key={player.id} style={styles.spectatorPlayerRow}>
                  <Text style={styles.spectatorPlayerName}>{player.name}</Text>
                  <Text style={styles.spectatorPlayerPos}>{player.position}</Text>
                  <Text style={styles.spectatorPlayerRating}>{player.overall}</Text>
                </View>
              ))}
            </View>

            <View style={styles.teamSquadSection}>
              <Text style={styles.teamSquadTitle}>{currentMatch.awayManager.managerName}</Text>
              {currentMatch.awayManager.squad.map((player, idx) => (
                <View key={player.id} style={styles.spectatorPlayerRow}>
                  <Text style={styles.spectatorPlayerName}>{player.name}</Text>
                  <Text style={styles.spectatorPlayerPos}>{player.position}</Text>
                  <Text style={styles.spectatorPlayerRating}>{player.overall}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Finished screen
  if (matchState === 'finished') {
    const myScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    const result = myScore > opponentScore ? 'WIN' : myScore < opponentScore ? 'LOSS' : 'DRAW';
    const resultColor = result === 'WIN' ? '#43e97b' : result === 'LOSS' ? '#f5576c' : '#ffa726';

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            // Clear practice match from localStorage if it's a practice match
            if (currentMatch?.isPractice) {
              if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem('practiceMatch');
                localStorage.removeItem('practiceMatchState');
                localStorage.removeItem('activeMatchId');
                console.log('Practice match cleared from localStorage on back');
              }
            }
            setMatchState('select');
            setCurrentMatch(null);
            onBack();
          }} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to Menu</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Full Time</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.resultCard}>
            <Text style={[styles.resultText, { color: resultColor }]}>{result}</Text>
            <View style={styles.finalScoreRow}>
              <Text style={styles.finalTeam}>{currentMatch.homeManager.name}</Text>
              <Text style={styles.finalScore}>{homeScore} - {awayScore}</Text>
              <Text style={styles.finalTeam}>{currentMatch.awayManager.name}</Text>
            </View>
            {currentMatch.isProLeague && (
              <Text style={styles.pointsEarned}>
                League Points: {result === 'WIN' ? '+3' : result === 'DRAW' ? '+1' : '0'}
              </Text>
            )}
            {currentMatch.isPractice && (
              <Text style={styles.practiceLabel}>
                ⚽ Practice Match - No league points
              </Text>
            )}
            {!currentMatch.isProLeague && !currentMatch.isPractice && (
              <Text style={styles.friendlyLabel}>
                🤝 Friendly Match - No league points
              </Text>
            )}
          </View>

          {currentMatch.matchReport && (
            <View style={styles.matchReportCard}>
              <Text style={styles.matchReportTitle}>📊 Match Analysis</Text>
              <Text style={styles.matchReportText}>{currentMatch.matchReport}</Text>
              <View style={styles.strengthComparison}>
                <View style={styles.strengthItem}>
                  <Text style={styles.strengthLabel}>{currentMatch.homeManager.name}</Text>
                  <Text style={styles.strengthValue}>⭐ {currentMatch.homeStrength || 'N/A'}</Text>
                </View>
                <Text style={styles.strengthVs}>VS</Text>
                <View style={styles.strengthItem}>
                  <Text style={styles.strengthLabel}>{currentMatch.awayManager.name}</Text>
                  <Text style={styles.strengthValue}>⭐ {currentMatch.awayStrength || 'N/A'}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.matchSummary}>
            <Text style={styles.summaryTitle}>Match Events</Text>
            {events.length === 0 ? (
              <Text style={styles.noEvents}>0-0 Goalless draw</Text>
            ) : (
              events.slice().reverse().map((event, index) => (
                <View key={index} style={styles.summaryEvent}>
                  <Text style={styles.summaryEventText}>{event}</Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.newMatchButton} onPress={() => {
            setMatchState('select');
            setCurrentMatch(null);
            setHomeScore(0);
            setAwayScore(0);
            setMinute(0);
            setEvents([]);
          }}>
            <Text style={styles.newMatchButtonText}>Play Another Match</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
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
    marginBottom: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forfeitButton: {
    backgroundColor: 'rgba(245, 87, 108, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  forfeitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  friendCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  friendStats: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  friendSquad: {
    fontSize: 12,
    color: '#aaa',
  },
  challengeButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  challengeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  waitingCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
    marginTop: 60,
  },
  waitingIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  waitingDesc: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  waitingStatus: {
    fontSize: 16,
    color: '#43e97b',
    textAlign: 'center',
    lineHeight: 24,
  },
  matchupCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  teamReady: {
    fontSize: 16,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  vs: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffa726',
    marginHorizontal: 20,
  },
  kickoffInfo: {
    backgroundColor: '#1a1f3a',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  kickoffInfoText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  startMatchButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  startMatchButtonDisabled: {
    background: 'linear-gradient(135deg, #2d3561 0%, #1a1f3a 100%)',
    opacity: 0.6,
  },
  startMatchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scoreBoard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  scoreBoardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreTeam: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  score: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffa726',
    marginHorizontal: 20,
  },
  substitutionSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  playerPosition: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffa726',
    width: 50,
  },
  playerRowName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  playerRowRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#43e97b',
    marginRight: 10,
  },
  subIcon: {
    fontSize: 16,
  },
  continueButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveScoreBoard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  minuteDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  minuteText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 10,
  },
  liveIndicator: {
    fontSize: 14,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  liveScoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTeam: {
    alignItems: 'center',
    maxWidth: '40%',
  },
  liveTeamName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
    textAlign: 'center',
    maxWidth: '100%',
  },
  liveScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveDash: {
    fontSize: 36,
    color: '#888',
    marginHorizontal: 20,
  },
  eventsContainer: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  noEvents: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  eventRow: {
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  eventText: {
    fontSize: 14,
    color: '#ffffff',
  },
  resultCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  resultText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  finalTeam: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  finalScore: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginHorizontal: 20,
  },
  pointsEarned: {
    fontSize: 18,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  practiceLabel: {
    fontSize: 16,
    color: '#ffa726',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  friendlyLabel: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  matchSummary: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  summaryEvent: {
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  summaryEventText: {
    fontSize: 14,
    color: '#ffffff',
  },
  newMatchButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  newMatchButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90vh',
    borderWidth: 1,
    borderColor: '#2d3561',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  benchList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  benchPlayerOption: {
    backgroundColor: '#252b54',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  benchPlayerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  benchPlayerDetails: {
    color: '#888',
    fontSize: 13,
  },
  benchPlayerRating: {
    color: '#43e97b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noBenchPlayers: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBenchText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noBenchSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: '#f5576c',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  miniFormationContainer: {
    backgroundColor: '#252b54',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
  },
  miniFormationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#43e97b',
    marginBottom: 10,
    textAlign: 'center',
  },
  miniFormation: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#1a4d2e',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  miniPlayer: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  miniPlayerOut: {
    backgroundColor: '#f5576c',
    borderColor: '#ff0000',
    borderWidth: 3,
  },
  miniPlayerText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  miniPlayerOutIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
    fontSize: 16,
  },
  benchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  benchPlayerInfo: {
    flex: 1,
  },
  matchReportCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  matchReportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  matchReportText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  strengthComparison: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#252b54',
    borderRadius: 15,
    padding: 15,
  },
  strengthItem: {
    alignItems: 'center',
    flex: 1,
  },
  strengthLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 5,
    textAlign: 'center',
  },
  strengthValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#43e97b',
  },
  strengthVs: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginHorizontal: 10,
  },
  aiMatchCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#667eea',
    background: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  aiIcon: {
    fontSize: 50,
    marginRight: 15,
  },
  aiInfo: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aiDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  aiButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  aiButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2d3561',
  },
  dividerText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 15,
  },
  infoCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  infoIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  infoDesc: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  prematchSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  tacticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  tacticCard: {
    flex: 1,
    backgroundColor: '#252b54',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tacticCardSelected: {
    borderColor: '#43e97b',
    backgroundColor: '#2d3561',
  },
  tacticText: {
    fontSize: 28,
    marginBottom: 8,
  },
  tacticTextSelected: {
    transform: 'scale(1.1)',
  },
  tacticLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 'bold',
  },
  tacticLabelSelected: {
    color: '#43e97b',
  },
  formationPitch: {
    backgroundColor: '#252b54',
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  formationNote: {
    fontSize: 16,
    color: '#43e97b',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  formationSubnote: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  prematchPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  formationButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  formationBtn: {
    backgroundColor: '#252b54',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formationBtnActive: {
    backgroundColor: '#2d3561',
    borderColor: '#43e97b',
  },
  formationBtnText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  formationBtnTextActive: {
    color: '#43e97b',
  },
  prematchFormationPitch: {
    position: 'relative',
    width: 350,
    height: 550,
    maxWidth: '100%',
    alignSelf: 'center',
    backgroundColor: '#2d5016',
    backgroundImage: 'repeating-linear-gradient(0deg, #2d5016 0px, #3a6b1f 40px, #2d5016 80px)',
    borderRadius: 15,
    marginTop: 10,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  prematchPlayer: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
  prematchPlayerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    background: 'linear-gradient(145deg, #667eea 0%, #764ba2 50%, #5a67d8 100%)',
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    boxShadow: '0 8px 16px rgba(102, 126, 234, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
    transform: 'perspective(100px) rotateX(5deg)',
    marginBottom: 2,
  },
  prematchPlayerName: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 10,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  prematchPlayerRating: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 1,
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(255, 255, 255, 0.3)',
  },
  readyStatusCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  readyStatusText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmButton: {
    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmButtonDisabled: {
    background: 'linear-gradient(135deg, #2d3561 0%, #1a1f3a 100%)',
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  inMatchTactics: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  tacticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  miniTacticBtn: {
    flex: 1,
    backgroundColor: '#252b54',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniTacticBtnActive: {
    borderColor: '#43e97b',
    backgroundColor: '#2d3561',
  },
  miniTacticText: {
    fontSize: 24,
  },
  subsSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  subsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  subsHint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  pauseBanner: {
    backgroundColor: '#f5576c',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff6b81',
  },
  pauseIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  pauseInfo: {
    flex: 1,
  },
  pauseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 3,
  },
  pauseCountdown: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  pauseSubtitle: {
    fontSize: 12,
    color: '#ffffff',
    fontStyle: 'italic',
    marginTop: 3,
  },
  pauseOverlay: {
    backgroundColor: 'rgba(26, 31, 58, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f5576c',
  },
  resumeStatusCard: {
    backgroundColor: '#252b54',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  resumeStatusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  resumeStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumeTeamStatus: {
    alignItems: 'center',
    flex: 1,
  },
  resumeTeamName: {
    fontSize: 13,
    color: '#888',
    marginBottom: 5,
  },
  resumeStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f5576c',
  },
  resumeStatusReady: {
    color: '#43e97b',
  },
  resumeButton: {
    backgroundColor: '#43e97b',
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  resumeButtonDisabled: {
    backgroundColor: '#888',
  },
  resumeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pauseContainer: {
    flexDirection: 'row',
  },
  pauseSubButtonDisabled: {
    backgroundColor: '#888',
    opacity: 0.5,
  },
  clearStuckMatchesButton: {
    backgroundColor: '#f5576c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  clearStuckMatchesText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  liveMatchCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#f5576c',
  },
  liveMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveMatchIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f5576c',
  },
  cancelLiveMatchButton: {
    backgroundColor: '#f5576c',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  cancelLiveMatchText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  matchAge: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  liveMatchMinute: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  liveMatchTeam: {
    flex: 1,
    alignItems: 'center',
  },
  liveMatchTeamName: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 5,
  },
  liveMatchScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  liveMatchVs: {
    fontSize: 12,
    color: '#888',
    marginHorizontal: 10,
  },
  watchButton: {
    backgroundColor: '#667eea',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  watchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  spectatorBanner: {
    backgroundColor: '#667eea',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spectatorIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  spectatorInfo: {
    flex: 1,
  },
  spectatorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 3,
  },
  spectatorDesc: {
    fontSize: 13,
    color: '#ffffff',
  },
  spectatorInfoCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  spectatorInfoText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 20,
  },
  watchersCard: {
    backgroundColor: 'rgba(26, 31, 58, 0.7)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(45, 53, 97, 0.5)',
  },
  watchersTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  watchersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  watcherChip: {
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.5)',
  },
  watcherName: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  squadsSection: {
    marginTop: 20,
  },
  squadsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  teamSquadSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  teamSquadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  spectatorPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3561',
  },
  spectatorPlayerName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  spectatorPlayerPos: {
    fontSize: 12,
    color: '#888',
    marginRight: 10,
    width: 40,
    textAlign: 'center',
  },
  spectatorPlayerRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#43e97b',
    width: 30,
    textAlign: 'right',
  },
  spectatorsSection: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  spectatorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  spectatorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  spectatorChip: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  spectatorChipText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  // Pitch visualization styles
  pitchContainer: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2d3561',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  pitch: {
    backgroundColor: '#2d7a3e',
    backgroundImage: 'repeating-linear-gradient(90deg, #2d7a3e 0px, #2d7a3e 40px, #247030 40px, #247030 80px)',
    borderRadius: 10,
    height: 500,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  pitchHalfLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ffffff',
    opacity: 0.5,
  },
  pitchCenterCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#ffffff',
    opacity: 0.5,
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  playerDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    borderWidth: 2,
    transition: 'left 0.3s ease-out, top 0.3s ease-out', // Smooth player movement, synced with ball
  },
  playerDotHome: {
    backgroundColor: '#667eea',
    borderColor: '#ffffff',
  },
  playerDotAway: {
    backgroundColor: '#f5576c',
    borderColor: '#ffffff',
  },
  playerWithBall: {
    borderWidth: 3,
    borderColor: '#FFD700',
    transform: [{ translateX: -16 }, { translateY: -16 }, { scale: 1.2 }],
    transition: 'border-width 0.2s ease-in-out, transform 0.2s ease-in-out', // Smooth border animation
  },
  playerDotText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playerNumber: {
    fontSize: 8,
    color: '#ffffff',
    marginTop: -2,
  },
  ball: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    background: 'radial-gradient(circle at 30% 30%, #ffffff, #e8e8e8 40%, #cccccc 70%, #999999)',
    borderWidth: 1.5,
    borderColor: '#333333',
    transform: [{ translateX: -8 }, { translateY: -8 }],
    zIndex: 1000,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.2)',
    transition: 'left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Smooth, natural transitions
  },
  shotBall: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    background: 'radial-gradient(circle at 30% 30%, #FFD700, #FFA500 50%, #FF8C00)',
    borderWidth: 2,
    borderColor: '#FF6B00',
    transform: [{ translateX: -9 }, { translateY: -9 }],
    zIndex: 1001,
    boxShadow: '0 0 12px rgba(255, 215, 0, 0.8), 0 3px 6px rgba(0,0,0,0.4)',
  },
  pitchCenterDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  goalTop: {
    position: 'absolute',
    top: 0,
    left: '35%',
    width: '30%',
    height: 30,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.15)',
    boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.4)',
  },
  goalBottom: {
    position: 'absolute',
    bottom: 0,
    left: '35%',
    width: '30%',
    height: 30,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.15)',
    boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.4)',
  },
  goalPost: {
    position: 'absolute',
    width: 5,
    height: '100%',
    backgroundColor: '#ffffff',
    left: '50%',
    transform: [{ translateX: -2.5 }],
    boxShadow: '0 0 4px rgba(255,255,255,0.6)',
  },
  goalNet: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundImage: `
      repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, transparent 1px, transparent 8px, rgba(255,255,255,0.1) 9px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, transparent 1px, transparent 8px, rgba(255,255,255,0.1) 9px)
    `,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  penaltyAreaTop: {
    position: 'absolute',
    top: 0,
    left: '25%',
    width: '50%',
    height: '15%',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  penaltyAreaBottom: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    width: '50%',
    height: '15%',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  pitchInfoOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  pitchInfoText: {
    fontSize: 12,
    color: '#43e97b',
    fontWeight: 'bold',
  },
  subsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pauseSubButton: {
    backgroundColor: '#f5576c',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 80,
  },
  pauseSubButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quickSubList: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  quickSubTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  quickSubPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252b54',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  quickSubPlayerPos: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
    width: 50,
  },
  quickSubPlayerName: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 10,
  },
  quickSubPlayerRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#43e97b',
    marginRight: 10,
  },
  quickSubIcon: {
    fontSize: 18,
  },
  quickSubCancel: {
    backgroundColor: '#2d3561',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  quickSubCancelText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmReadyButton: {
    backgroundColor: '#43e97b',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmReadyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  confirmReadyHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  readyConfirmedCard: {
    backgroundColor: '#1a3a2d',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#43e97b',
  },
  readyConfirmedIcon: {
    fontSize: 40,
    color: '#43e97b',
    marginBottom: 10,
  },
  readyConfirmedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#43e97b',
    marginBottom: 5,
  },
  readyConfirmedSubtext: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.8,
  },
  tacticsCard: {
    backgroundColor: '#1a1f3a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  tacticsCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  tacticsCardSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 15,
  },
  tacticsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  tacticButton: {
    flex: 1,
    backgroundColor: '#252b54',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2d3561',
  },
  tacticButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#2d3561',
  },
  tacticButtonIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  tacticButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  tacticButtonDesc: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  goalMomentOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20000,
    pointerEvents: 'none',
  },
  goalMomentContent: {
    alignItems: 'center',
  },
  goalMomentBig: {
    fontSize: 120,
    marginBottom: 20,
  },
  goalMomentTitle: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: 20,
    letterSpacing: 8,
  },
  goalMomentScorer: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 30,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  goalMomentTeamBadge: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    borderWidth: 3,
  },
  goalMomentHome: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderColor: '#667eea',
  },
  goalMomentAway: {
    background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
    borderColor: '#f5576c',
  },
  goalMomentTeamText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  goalCelebrationOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    pointerEvents: 'none', // Allow clicks to pass through after celebration
  },
  goalCelebrationText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#667eea',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 20,
  },
  goalCelebrationScorer: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  goalCelebrationEmoji: {
    fontSize: 60,
  },
});

export default Match;
