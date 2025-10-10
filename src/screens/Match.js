import React, { useState, useEffect } from 'react';
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
  const [pauseCountdown, setPauseCountdown] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);

  useEffect(() => {
    if (managerProfile) {
      loadFriends();
    }
  }, [managerProfile]);

  // Load active match when activeMatchId changes
  useEffect(() => {
    if (activeMatchId) {
      loadActiveMatch(activeMatchId);
    }
  }, [activeMatchId]);

  const loadActiveMatch = async (matchId) => {
    const matchRef = ref(database, `matches/${matchId}`);
    const snapshot = await get(matchRef);

    if (snapshot.exists()) {
      const matchData = snapshot.val();
      const amHome = matchData.homeManager.uid === currentUser.uid;
      setIsHome(amHome);
      setCurrentMatch(matchData);
      setMatchState(matchData.state);
    }
  };

  // Listen for match updates when in a match
  useEffect(() => {
    if (!currentMatch?.id) return;

    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const unsubscribe = onValue(matchRef, (snapshot) => {
      if (snapshot.exists()) {
        const matchData = snapshot.val();
        const previousState = matchState;

        // Update match state based on Firebase data
        setMatchState(matchData.state);
        setHomeScore(matchData.homeScore || 0);
        setAwayScore(matchData.awayScore || 0);
        setMinute(matchData.minute || 0);
        setEvents(matchData.events || []);
        setCurrentMatch(matchData);

        // Detect state change to 'playing' - start simulation if home manager
        if (matchData.state === 'playing' && previousState === 'ready' && isHome) {
          console.log('Match state changed to playing - starting simulation');
          simulateMatch(matchData);
        }

        // Detect second half start
        if (matchData.state === 'playing' && previousState === 'halftime' && isHome && matchData.secondHalfStarted) {
          console.log('Second half starting - resuming simulation');
          simulateSecondHalf();
        }

        // Check if match is finished
        if (matchData.state === 'finished' && matchState !== 'finished') {
          handleMatchFinished(matchData);
        }
      }
    });

    return () => off(matchRef);
  }, [currentMatch?.id, matchState, isHome]);

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
        // Auto-resume match when countdown ends
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        update(matchRef, {
          paused: false,
          pausedBy: null,
          pauseReason: null,
          pauseEndTime: null
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentMatch?.paused, currentMatch?.pauseEndTime, currentMatch?.id]);

  // Load all live matches for spectator mode
  useEffect(() => {
    if (!currentUser) return;

    const matchesRef = ref(database, 'matches');

    const unsubscribe = onValue(matchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allMatches = [];
        snapshot.forEach(childSnapshot => {
          const match = childSnapshot.val();
          // Only show matches that are:
          // 1. Currently playing or at halftime (truly live)
          // 2. Not involving the current user (exclude own matches)
          if (
            (match.state === 'playing' || match.state === 'halftime') &&
            match.homeManager?.uid !== currentUser.uid &&
            match.awayManager?.uid !== currentUser.uid
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
    const matchesRef = ref(database, 'matches');
    const newMatchRef = push(matchesRef);
    const matchId = newMatchRef.key;

    const matchData = {
      id: matchId,
      homeManager: {
        uid: currentUser.uid,
        name: managerProfile.managerName,
        squad: myStarting,
        ready: false
      },
      awayManager: {
        uid: opponent.uid,
        name: opponent.managerName,
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

    setCurrentMatch(matchData);
    setIsHome(true);
    setMatchState('waiting');

    // Mark myself as ready
    await update(ref(database, `matches/${matchId}/homeManager`), { ready: true });

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

    // Create practice match (doesn't go to database, just local)
    const matchData = {
      id: `practice_${Date.now()}`,
      isPractice: true, // Mark as practice match
      homeManager: {
        uid: currentUser.uid,
        name: managerProfile.managerName,
        squad: myStarting,
        ready: true
      },
      awayManager: {
        uid: 'ai_alkawaya_pro',
        name: 'Alkawaya Pro',
        squad: aiSquad,
        ready: true
      },
      state: 'ready',
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      events: [],
      createdAt: Date.now()
    };

    setCurrentMatch(matchData);
    setIsHome(true);
    setMatchState('ready');
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

  const acceptMatchChallenge = async (matchId) => {
    const matchRef = ref(database, `matches/${matchId}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
      showAlert('Error', 'Match not found.');
      return;
    }

    const matchData = snapshot.val();

    // Determine if I'm home or away
    const amHome = matchData.homeManager.uid === currentUser.uid;
    setIsHome(amHome);
    setCurrentMatch(matchData);
    setMatchState('waiting');

    // Mark myself as ready
    const myPath = amHome ? 'homeManager' : 'awayManager';
    await update(ref(database, `matches/${matchId}/${myPath}`), { ready: true });

    // Check if both are ready
    const updatedSnapshot = await get(matchRef);
    const updatedMatch = updatedSnapshot.val();

    if (updatedMatch.homeManager.ready && updatedMatch.awayManager.ready) {
      // Go to pre-match setup instead of starting immediately
      await update(ref(database, `matches/${matchId}`), { state: 'prematch' });
    }
  };

  const markReadyToKickoff = async () => {
    if (!currentMatch) return;

    // For practice matches, just start immediately (no Firebase)
    if (currentMatch.isPractice) {
      setCurrentMatch({
        ...currentMatch,
        state: 'playing',
        homeKickoffReady: true,
        awayKickoffReady: true,
        startedAt: Date.now(),
        minute: 0,
        second: 0
      });
      setMatchState('playing');
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

    const homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    const awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);
    const totalStrength = homeStrength + awayStrength;

    const homeChance = (homeStrength / totalStrength) * 0.55 + 0.05;
    const awayChance = (awayStrength / totalStrength) * 0.55;

    let currentSecond = 0;
    let localHomeScore = 0;
    let localAwayScore = 0;
    let localEvents = [];
    let localGoalscorers = {};

    const interval = setInterval(() => {
      currentSecond++;
      const matchMinute = Math.floor(currentSecond / (120 / 90)); // 120 seconds = 90 minutes

      setMinute(matchMinute);

      // Goal chance
      const goalRoll = Math.random();
      if (goalRoll < 0.04) {
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;

        // Realistic goal scoring - weight by position
        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const midfielders = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(p.position));
        const defenders = team.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();
        if (scorerRoll < 0.70 && attackers.length > 0) {
          scorer = attackers[Math.floor(Math.random() * attackers.length)];
        } else if (scorerRoll < 0.95 && midfielders.length > 0) {
          scorer = midfielders[Math.floor(Math.random() * midfielders.length)];
        } else if (defenders.length > 0) {
          scorer = defenders[Math.floor(Math.random() * defenders.length)];
        } else {
          const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        if (isHomeGoal) {
          localHomeScore++;
          setHomeScore(localHomeScore);
        } else {
          localAwayScore++;
          setAwayScore(localAwayScore);
        }

        const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;
        localEvents = [eventText, ...localEvents];
        setEvents(localEvents);

        // Track goalscorer for XP
        if (!localGoalscorers[scorer.id]) {
          localGoalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
        }
        localGoalscorers[scorer.id].goals++;

        console.log('GOAL!', eventText);
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
          goalscorers: localGoalscorers
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

    // Generate match report
    let matchReport = '';
    if (finalHomeScore > finalAwayScore) {
      matchReport = `${currentMatch.homeManager.name} won ${finalHomeScore}-${finalAwayScore} in practice. `;
      if (homeStrength > awayStrength + 3) {
        matchReport += 'Good warm-up against weaker opposition.';
      } else {
        matchReport += 'Excellent practice session with good results.';
      }
    } else if (finalAwayScore > finalHomeScore) {
      matchReport = `Alkawaya Pro won ${finalAwayScore}-${finalHomeScore}. A tough practice match - room for improvement.`;
    } else {
      matchReport = `Practice match ended ${finalHomeScore}-${finalHomeScore}. Good training session.`;
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

    // Award XP to goalscorers (only benefit of practice matches)
    for (const scorerId in goalscorers) {
      const scorerData = goalscorers[scorerId];
      const managerId = scorerData.managerId;

      // Only award XP to the human player's squad
      if (managerId === currentUser.uid) {
        const xpEarned = scorerData.goals * 50;

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
          console.log(`Awarded ${xpEarned} XP to player ${scorerData.playerId} from practice match`);
        }
      }
    }

    showAlert('Practice Match Complete', 'Your goalscorers earned XP! No points or budget affected.');
  };

  const simulateMatch = async (matchData) => {
    const match = matchData || currentMatch;
    if (!match) {
      console.error('No match data available for simulation');
      return;
    }

    console.log('Starting match simulation for match:', match.id);
    const matchRef = ref(database, `matches/${match.id}`);

    // Calculate team strengths
    const homeStrength = calculateTeamStrength(match.homeManager.squad);
    const awayStrength = calculateTeamStrength(match.awayManager.squad);

    console.log('Team strengths - Home:', homeStrength, 'Away:', awayStrength);

    if (homeStrength === 0 || awayStrength === 0) {
      console.error('Squad strength is 0, cannot simulate match');
      return;
    }

    const totalStrength = homeStrength + awayStrength;

    // Home advantage bonus
    const homeChance = (homeStrength / totalStrength) * 0.55 + 0.05;
    const awayChance = (awayStrength / totalStrength) * 0.55;

    let currentSecond = 0;

    console.log('Setting up match interval...');
    const interval = setInterval(async () => {
      try {
        // Check if match is paused
        const currentData = (await get(matchRef)).val();
        if (currentData.paused) {
          console.log('Match is paused, skipping simulation tick');
          return;
        }

        currentSecond++;
        // Convert seconds to match minutes (120 seconds = 90 minutes)
        const matchMinute = Math.floor(currentSecond / (120 / 90));

        console.log(`Match second ${currentSecond}, minute ${matchMinute}`);

        // Goal chance based on team strength (4% per minute scaled by strength)
        const goalRoll = Math.random();

        if (goalRoll < 0.04) {
          const teamRoll = Math.random();
          const isHomeGoal = teamRoll < homeChance;
          const team = isHomeGoal ? match.homeManager : match.awayManager;

          // Realistic goal scoring - weight by position
          const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
          const midfielders = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(p.position));
          const defenders = team.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));

          let scorer;
          const scorerRoll = Math.random();
          if (scorerRoll < 0.70 && attackers.length > 0) {
            // 70% chance for attackers
            scorer = attackers[Math.floor(Math.random() * attackers.length)];
          } else if (scorerRoll < 0.95 && midfielders.length > 0) {
            // 25% chance for midfielders
            scorer = midfielders[Math.floor(Math.random() * midfielders.length)];
          } else if (defenders.length > 0) {
            // 5% chance for defenders (headers from set pieces)
            scorer = defenders[Math.floor(Math.random() * defenders.length)];
          } else {
            // Fallback to any outfield player (excluding GK)
            const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
            scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
          }

          const currentData = (await get(matchRef)).val();
          const newScore = isHomeGoal
            ? { homeScore: (currentData.homeScore || 0) + 1 }
            : { awayScore: (currentData.awayScore || 0) + 1 };

          await update(matchRef, newScore);

          const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;

          // Track goalscorer for XP rewards
          const goalscorers = (await get(matchRef)).val().goalscorers || {};
          if (!goalscorers[scorer.id]) {
            goalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
          }
          goalscorers[scorer.id].goals++;

          // Get current events and prepend new one
          const updatedData = (await get(matchRef)).val();
          const newEvents = [eventText, ...(updatedData.events || [])];
          await update(matchRef, { events: newEvents, goalscorers });

          console.log('GOAL!', eventText);
        }

        // Update minute in Firebase
        await update(matchRef, { minute: matchMinute, second: currentSecond });

        // Half time at 60 seconds (45 match minutes)
        if (currentSecond === 60) {
          console.log('Half time reached');
          clearInterval(interval);
          await update(matchRef, { state: 'halftime' });
        }

        // Full time at 120 seconds (90 match minutes)
        if (currentSecond === 120) {
          console.log('Full time reached');
          clearInterval(interval);
          await finishMatch();
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
      await update(matchRef, {
        state: 'playing',
        secondHalfStarted: true
      });
      // The listener will detect the state change and start simulation
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

    const interval = setInterval(() => {
      currentSecond++;
      const matchMinute = Math.floor(currentSecond / (120 / 90)); // 120 seconds = 90 minutes

      setMinute(matchMinute);

      // Goal chance
      const goalRoll = Math.random();
      if (goalRoll < 0.04) {
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;

        // Realistic goal scoring - weight by position
        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const midfielders = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(p.position));
        const defenders = team.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();
        if (scorerRoll < 0.70 && attackers.length > 0) {
          scorer = attackers[Math.floor(Math.random() * attackers.length)];
        } else if (scorerRoll < 0.95 && midfielders.length > 0) {
          scorer = midfielders[Math.floor(Math.random() * midfielders.length)];
        } else if (defenders.length > 0) {
          scorer = defenders[Math.floor(Math.random() * defenders.length)];
        } else {
          const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        if (isHomeGoal) {
          localHomeScore++;
          setHomeScore(localHomeScore);
        } else {
          localAwayScore++;
          setAwayScore(localAwayScore);
        }

        const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;
        localEvents = [eventText, ...localEvents];
        setEvents(localEvents);

        // Track goalscorer for XP
        if (!localGoalscorers[scorer.id]) {
          localGoalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
        }
        localGoalscorers[scorer.id].goals++;

        console.log('GOAL!', eventText);
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

    console.log('Starting second half simulation');
    const matchRef = ref(database, `matches/${currentMatch.id}`);

    // Calculate team strengths
    const homeStrength = calculateTeamStrength(currentMatch.homeManager.squad);
    const awayStrength = calculateTeamStrength(currentMatch.awayManager.squad);
    const totalStrength = homeStrength + awayStrength;

    // Home advantage bonus
    const homeChance = (homeStrength / totalStrength) * 0.55 + 0.05;
    const awayChance = (awayStrength / totalStrength) * 0.55;

    const interval = setInterval(async () => {
      const currentData = (await get(matchRef)).val();

      // Check if match is paused
      if (currentData.paused) {
        console.log('Match is paused, skipping simulation tick');
        return;
      }

      const currentSecond = (currentData.second || 60) + 1;
      const matchMinute = Math.floor(currentSecond / (120 / 90));

      console.log(`Second half - second ${currentSecond}, minute ${matchMinute}`);

      // Goal chance based on team strength (4% per minute scaled by strength)
      const goalRoll = Math.random();

      if (goalRoll < 0.04) {
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;

        // Realistic goal scoring - weight by position
        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW'].includes(p.position));
        const midfielders = team.squad.filter(p => ['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(p.position));
        const defenders = team.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position));

        let scorer;
        const scorerRoll = Math.random();
        if (scorerRoll < 0.70 && attackers.length > 0) {
          scorer = attackers[Math.floor(Math.random() * attackers.length)];
        } else if (scorerRoll < 0.95 && midfielders.length > 0) {
          scorer = midfielders[Math.floor(Math.random() * midfielders.length)];
        } else if (defenders.length > 0) {
          scorer = defenders[Math.floor(Math.random() * defenders.length)];
        } else {
          const outfieldPlayers = team.squad.filter(p => p.position !== 'GK');
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        const newScore = isHomeGoal
          ? { homeScore: currentData.homeScore + 1 }
          : { awayScore: currentData.awayScore + 1 };

        await update(matchRef, newScore);

        const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;

        // Track goalscorer for XP rewards
        const goalscorers = currentData.goalscorers || {};
        if (!goalscorers[scorer.id]) {
          goalscorers[scorer.id] = { playerId: scorer.id, managerId: team.uid, goals: 0 };
        }
        goalscorers[scorer.id].goals++;

        const newEvents = [eventText, ...(currentData.events || [])];
        await update(matchRef, { events: newEvents, goalscorers });

        console.log('GOAL!', eventText);
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
    if (!currentMatch) return;

    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const matchData = (await get(matchRef)).val();

    await update(matchRef, {
      state: 'finished',
      finishedAt: Date.now()
    });

    // Only process stats once per manager
    if (!matchData.statsProcessed) {
      await update(matchRef, { statsProcessed: true });
      await updateMatchStats(matchData);
    }
  };

  const updateMatchStats = async (matchData) => {
    const finalHomeScore = matchData.homeScore || 0;
    const finalAwayScore = matchData.awayScore || 0;

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

    // Create match history record
    const matchHistory = {
      id: matchData.id,
      homeManager: {
        uid: matchData.homeManager.uid,
        name: matchData.homeManager.name
      },
      awayManager: {
        uid: matchData.awayManager.uid,
        name: matchData.awayManager.name
      },
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      homeStrength: homeStrength.toFixed(1),
      awayStrength: awayStrength.toFixed(1),
      events: matchData.events || [],
      matchReport: matchReport,
      playedAt: Date.now()
    };

    // Save match to both managers' history
    await push(ref(database, `managers/${matchData.homeManager.uid}/matchHistory`), matchHistory);
    await push(ref(database, `managers/${matchData.awayManager.uid}/matchHistory`), matchHistory);

    // Update home manager stats
    const homeManagerRef = ref(database, `managers/${matchData.homeManager.uid}`);
    const homeSnapshot = await get(homeManagerRef);
    if (homeSnapshot.exists()) {
      const homeData = homeSnapshot.val();
      let homeUpdate = {
        wins: homeData.wins || 0,
        draws: homeData.draws || 0,
        losses: homeData.losses || 0,
        points: homeData.points || 0
      };

      if (finalHomeScore > finalAwayScore) {
        homeUpdate.wins++;
        homeUpdate.points += 3;
      } else if (finalHomeScore < finalAwayScore) {
        homeUpdate.losses++;
      } else {
        homeUpdate.draws++;
        homeUpdate.points += 1;
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
        points: awayData.points || 0
      };

      if (finalAwayScore > finalHomeScore) {
        awayUpdate.wins++;
        awayUpdate.points += 3;
      } else if (finalAwayScore < finalHomeScore) {
        awayUpdate.losses++;
      } else {
        awayUpdate.draws++;
        awayUpdate.points += 1;
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

    // Award XP to goalscorers (50 XP per goal)
    const goalscorers = matchData.goalscorers || {};
    for (const scorerId in goalscorers) {
      const scorerData = goalscorers[scorerId];
      const managerId = scorerData.managerId;
      const xpEarned = scorerData.goals * 50;

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
  };

  const handleMatchFinished = (matchData) => {
    // Already handled by updateMatchStats
  };

  const startSubstitution = (player, index) => {
    setSubstitutionMode({ playerOut: player, playerOutIndex: index });
  };

  const makeSubstitution = async (playerIn) => {
    if (!currentMatch || !substitutionMode) return;

    const myTeam = isHome ? 'homeManager' : 'awayManager';
    const mySquad = isHome ? currentMatch.homeManager.squad : currentMatch.awayManager.squad;

    // Substitute
    const newSquad = [...mySquad];
    newSquad[substitutionMode.playerOutIndex] = playerIn;

    // Update in Firebase
    const matchRef = ref(database, `matches/${currentMatch.id}/${myTeam}`);
    await update(matchRef, { squad: newSquad });

    const newEvent = `${minute}' 🔄 ${isHome ? currentMatch.homeManager.name : currentMatch.awayManager.name}: ${playerIn.name} replaces ${substitutionMode.playerOut.name}`;
    const currentEvents = (await get(ref(database, `matches/${currentMatch.id}`))).val().events || [];
    await update(ref(database, `matches/${currentMatch.id}`), {
      events: [newEvent, ...currentEvents]
    });

    setSubstitutionMode(null);
    showAlert('Substitution Made', `${playerIn.name} is now on the pitch.`);
  };

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
          <Text style={styles.title}>Match - Challenge a Friend</Text>
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

              {liveMatches.map(match => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.liveMatchCard}
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
                  </View>
                  <View style={styles.liveMatchTeams}>
                    <View style={styles.liveMatchTeam}>
                      <Text style={styles.liveMatchTeamName}>{match.homeManager.managerName}</Text>
                      <Text style={styles.liveMatchScore}>{match.homeScore || 0}</Text>
                    </View>
                    <Text style={styles.liveMatchVs}>vs</Text>
                    <View style={styles.liveMatchTeam}>
                      <Text style={styles.liveMatchScore}>{match.awayScore || 0}</Text>
                      <Text style={styles.liveMatchTeamName}>{match.awayManager.managerName}</Text>
                    </View>
                  </View>
                  <View style={styles.watchButton}>
                    <Text style={styles.watchButtonText}>👁️ Watch</Text>
                  </View>
                </TouchableOpacity>
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

  // Waiting for opponent
  if (matchState === 'waiting') {
    const opponent = isHome ? currentMatch.awayManager : currentMatch.homeManager;
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
          <Text style={styles.title}>Waiting...</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.waitingTitle}>Waiting for Opponent</Text>
            <Text style={styles.waitingDesc}>
              {opponent.name} {opponentReady ? 'is ready!' : 'hasn\'t accepted yet...'}
            </Text>
            <Text style={styles.waitingStatus}>
              You: ✓ Ready {'\n'}
              {opponent.name}: {opponentReady ? '✓ Ready' : '⏳ Waiting...'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Pre-match setup - adjust formation and tactics
  if (matchState === 'prematch') {
    const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
    const mySquad = myTeam.squad;
    const myFormation = myTeam.formation || '4-3-3';
    const myPrematchReady = isHome ? currentMatch.homePrematchReady : currentMatch.awayPrematchReady;
    const opponentPrematchReady = isHome ? currentMatch.awayPrematchReady : currentMatch.homePrematchReady;

    const confirmPrematch = async () => {
      if (!currentMatch.isPractice) {
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        const readyField = isHome ? 'homePrematchReady' : 'awayPrematchReady';
        const tacticField = isHome ? 'homeTactic' : 'awayTactic';

        await update(matchRef, {
          [readyField]: true,
          [tacticField]: selectedTactic
        });

        // Check if both ready
        const updatedSnapshot = await get(matchRef);
        const updatedMatch = updatedSnapshot.val();

        if (updatedMatch.homePrematchReady && updatedMatch.awayPrematchReady) {
          await update(matchRef, { state: 'ready' });
        }
      } else {
        // Practice match - go directly to ready
        setCurrentMatch({
          ...currentMatch,
          state: 'ready',
          homePrematchReady: true,
          awayPrematchReady: true,
          homeTactic: selectedTactic
        });
        setMatchState('ready');
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

          {/* Formation Display */}
          <View style={styles.prematchSection}>
            <Text style={styles.sectionTitle}>Your Formation: {myFormation}</Text>
            <View style={styles.formationPitch}>
              <Text style={styles.formationNote}>
                ⚽ Playing in {myFormation} formation
              </Text>
              <Text style={styles.formationSubnote}>
                You can change your formation in the Formation screen before matches
              </Text>
            </View>
          </View>

          {/* Starting XI */}
          <View style={styles.prematchSection}>
            <Text style={styles.sectionTitle}>Starting XI</Text>
            {mySquad.map((player, index) => (
              <View key={player.id} style={styles.prematchPlayerRow}>
                <Text style={styles.playerPosition}>{player.position}</Text>
                <Text style={styles.playerRowName}>{player.name}</Text>
                <Text style={styles.playerRowRating}>⭐ {player.overall}</Text>
              </View>
            ))}
          </View>

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
    const opponent = isHome ? currentMatch.awayManager : currentMatch.homeManager;
    const myKickoffReady = isHome ? currentMatch.homeKickoffReady : currentMatch.awayKickoffReady;
    const opponentKickoffReady = isHome ? currentMatch.awayKickoffReady : currentMatch.homeKickoffReady;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Match Ready!</Text>
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

          <View style={styles.kickoffInfo}>
            <Text style={styles.kickoffInfoText}>
              Both managers must click "Start Match" to begin
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
    const myTeam = isHome ? currentMatch.homeManager : currentMatch.awayManager;
    const mySquad = myTeam.squad;
    const myTactic = isHome ? (currentMatch.homeTactic || 'Balanced') : (currentMatch.awayTactic || 'Balanced');

    const changeTactic = async (newTactic) => {
      setSelectedTactic(newTactic);
      if (!currentMatch.isPractice) {
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        const tacticField = isHome ? 'homeTactic' : 'awayTactic';
        await update(matchRef, { [tacticField]: newTactic });
      }
    };

    const requestSubstitution = async (playerOut, playerOutIndex) => {
      if (substitutionsUsed >= 2) {
        showAlert('No Substitutions Left', 'You have used all 2 substitutions.');
        return;
      }
      setSubstitutionMode({ playerOut, playerOutIndex });
    };

    const getPositionCoordinates = (position) => {
      // Returns {x: 0-100%, y: 0-100%} for pitch positioning
      const positionMap = {
        // Goalkeeper
        'GK': { x: 50, y: 95 },
        // Defenders
        'LB': { x: 20, y: 80 }, 'LWB': { x: 15, y: 75 },
        'CB': { x: 50, y: 80 }, 'RB': { x: 80, y: 80 }, 'RWB': { x: 85, y: 75 },
        // Midfielders
        'CDM': { x: 50, y: 65 }, 'LM': { x: 20, y: 55 }, 'CM': { x: 50, y: 50 },
        'RM': { x: 80, y: 55 }, 'CAM': { x: 50, y: 35 },
        // Attackers
        'LW': { x: 20, y: 20 }, 'ST': { x: 50, y: 15 }, 'RW': { x: 80, y: 20 },
      };
      return positionMap[position] || { x: 50, y: 50 };
    };

    const renderPitch = (homeSquad, awaySquad) => {
      return (
        <View style={styles.pitchContainer}>
          <View style={styles.pitch}>
            {/* Pitch markings */}
            <View style={styles.pitchHalfLine} />
            <View style={styles.pitchCenterCircle} />

            {/* Home Team (bottom) */}
            {homeSquad.map((player, idx) => {
              const coords = getPositionCoordinates(player.position);
              return (
                <View
                  key={`home-${idx}`}
                  style={[
                    styles.playerDot,
                    styles.playerDotHome,
                    { left: `${coords.x}%`, top: `${coords.y}%` }
                  ]}
                >
                  <Text style={styles.playerDotText}>{player.position}</Text>
                </View>
              );
            })}

            {/* Away Team (top) - mirrored */}
            {awaySquad.map((player, idx) => {
              const coords = getPositionCoordinates(player.position);
              const mirrored = { x: 100 - coords.x, y: 100 - coords.y };
              return (
                <View
                  key={`away-${idx}`}
                  style={[
                    styles.playerDot,
                    styles.playerDotAway,
                    { left: `${mirrored.x}%`, top: `${mirrored.y}%` }
                  ]}
                >
                  <Text style={styles.playerDotText}>{player.position}</Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    };

    const confirmSubstitution = async (playerIn) => {
      if (!substitutionMode) return;

      const newSquad = [...mySquad];
      newSquad[substitutionMode.playerOutIndex] = playerIn;

      if (!currentMatch.isPractice) {
        const matchRef = ref(database, `matches/${currentMatch.id}`);
        const teamPath = isHome ? 'homeManager' : 'awayManager';
        await update(ref(database, `matches/${currentMatch.id}/${teamPath}`), { squad: newSquad });

        // Pause match for 20 seconds
        const pauseEndTime = Date.now() + 20000;
        await update(matchRef, {
          paused: true,
          pausedBy: currentUser.uid,
          pauseReason: 'substitution',
          pauseEndTime: pauseEndTime
        });

        // Add substitution event
        const eventText = `${minute}' 🔄 SUB: ${playerIn.name} replaces ${substitutionMode.playerOut.name}`;
        const currentData = (await get(matchRef)).val();
        const newEvents = [eventText, ...(currentData.events || [])];
        await update(matchRef, { events: newEvents });
      }

      setSubstitutionsUsed(substitutionsUsed + 1);
      setSubstitutionMode(null);
      setPauseCountdown(20);
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Match in Progress</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.liveScoreBoard}>
            <View style={styles.minuteDisplay}>
              <Text style={styles.minuteText}>{minute}'</Text>
              <Text style={styles.liveIndicator}>● LIVE</Text>
            </View>
            <View style={styles.liveScoreRow}>
              <View style={styles.liveTeam}>
                <Text style={styles.liveTeamName}>{currentMatch.homeManager.name}</Text>
                <Text style={styles.liveScore}>{homeScore}</Text>
              </View>
              <Text style={styles.liveDash}>-</Text>
              <View style={styles.liveTeam}>
                <Text style={styles.liveScore}>{awayScore}</Text>
                <Text style={styles.liveTeamName}>{currentMatch.awayManager.name}</Text>
              </View>
            </View>
          </View>

          {/* Pitch Visualization */}
          {renderPitch(currentMatch.homeManager.squad, currentMatch.awayManager.squad)}

          {/* Pause Countdown Banner */}
          {pauseCountdown > 0 && (
            <View style={styles.pauseBanner}>
              <Text style={styles.pauseIcon}>⏸️</Text>
              <View style={styles.pauseInfo}>
                <Text style={styles.pauseTitle}>Match Paused - Substitution</Text>
                <Text style={styles.pauseCountdown}>Resuming in {pauseCountdown} seconds</Text>
              </View>
            </View>
          )}

          {/* In-Match Tactics Switcher */}
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

          {/* Substitutions */}
          <View style={styles.subsSection}>
            <Text style={styles.subsTitle}>
              Substitutions: {substitutionsUsed}/2 used
            </Text>
            {substitutionsUsed < 2 && (
              <Text style={styles.subsHint}>Tap a player to substitute</Text>
            )}
          </View>

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

        {/* Substitution Modal */}
        {substitutionMode && (
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Substitute {substitutionMode.playerOut.name}
              </Text>
              <Text style={styles.modalSubtitle}>
                Choose replacement from bench:
              </Text>

              <ScrollView style={styles.benchList}>
                {(managerProfile.squad || [])
                  .filter(p => !mySquad.some(fp => fp.id === p.id))
                  .map(player => (
                    <TouchableOpacity
                      key={player.id}
                      style={styles.benchPlayerOption}
                      onPress={() => confirmSubstitution(player)}
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

          <View style={styles.liveScoreBoard}>
            <View style={styles.minuteDisplay}>
              <Text style={styles.minuteText}>{minute}'</Text>
              <Text style={styles.liveIndicator}>● LIVE</Text>
            </View>
            <View style={styles.liveScoreRow}>
              <View style={styles.liveTeam}>
                <Text style={styles.liveTeamName}>{currentMatch.homeManager.managerName}</Text>
                <Text style={styles.liveScore}>{homeScore}</Text>
              </View>
              <Text style={styles.liveDash}>-</Text>
              <View style={styles.liveTeam}>
                <Text style={styles.liveScore}>{awayScore}</Text>
                <Text style={styles.liveTeamName}>{currentMatch.awayManager.managerName}</Text>
              </View>
            </View>
          </View>

          {/* Pitch Visualization */}
          {currentMatch.homeManager.squad && currentMatch.awayManager.squad && (
            <View style={styles.pitchContainer}>
              <View style={styles.pitch}>
                {/* Pitch markings */}
                <View style={styles.pitchHalfLine} />
                <View style={styles.pitchCenterCircle} />

                {/* Home Team (bottom) */}
                {currentMatch.homeManager.squad.map((player, idx) => {
                  const positionMap = {
                    'GK': { x: 50, y: 95 },
                    'LB': { x: 20, y: 80 }, 'LWB': { x: 15, y: 75 },
                    'CB': { x: 50, y: 80 }, 'RB': { x: 80, y: 80 }, 'RWB': { x: 85, y: 75 },
                    'CDM': { x: 50, y: 65 }, 'LM': { x: 20, y: 55 }, 'CM': { x: 50, y: 50 },
                    'RM': { x: 80, y: 55 }, 'CAM': { x: 50, y: 35 },
                    'LW': { x: 20, y: 20 }, 'ST': { x: 50, y: 15 }, 'RW': { x: 80, y: 20 },
                  };
                  const coords = positionMap[player.position] || { x: 50, y: 50 };
                  return (
                    <View
                      key={`home-${idx}`}
                      style={[
                        styles.playerDot,
                        styles.playerDotHome,
                        { left: `${coords.x}%`, top: `${coords.y}%` }
                      ]}
                    >
                      <Text style={styles.playerDotText}>{player.position}</Text>
                    </View>
                  );
                })}

                {/* Away Team (top) - mirrored */}
                {currentMatch.awayManager.squad.map((player, idx) => {
                  const positionMap = {
                    'GK': { x: 50, y: 95 },
                    'LB': { x: 20, y: 80 }, 'LWB': { x: 15, y: 75 },
                    'CB': { x: 50, y: 80 }, 'RB': { x: 80, y: 80 }, 'RWB': { x: 85, y: 75 },
                    'CDM': { x: 50, y: 65 }, 'LM': { x: 20, y: 55 }, 'CM': { x: 50, y: 50 },
                    'RM': { x: 80, y: 55 }, 'CAM': { x: 50, y: 35 },
                    'LW': { x: 20, y: 20 }, 'ST': { x: 50, y: 15 }, 'RW': { x: 80, y: 20 },
                  };
                  const coords = positionMap[player.position] || { x: 50, y: 50 };
                  const mirrored = { x: 100 - coords.x, y: 100 - coords.y };
                  return (
                    <View
                      key={`away-${idx}`}
                      style={[
                        styles.playerDot,
                        styles.playerDotAway,
                        { left: `${mirrored.x}%`, top: `${mirrored.y}%` }
                      ]}
                    >
                      <Text style={styles.playerDotText}>{player.position}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

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
            <Text style={styles.pointsEarned}>
              Points earned: {result === 'WIN' ? '+3' : result === 'DRAW' ? '+1' : '0'}
            </Text>
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
  },
  liveTeamName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
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
  },
  pitch: {
    backgroundColor: '#1b5e20',
    borderRadius: 10,
    height: 400,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#ffffff',
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
  },
  playerDotHome: {
    backgroundColor: '#667eea',
    borderColor: '#ffffff',
  },
  playerDotAway: {
    backgroundColor: '#f5576c',
    borderColor: '#ffffff',
  },
  playerDotText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default Match;
