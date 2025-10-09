import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get, update, push, set, onValue, off } from 'firebase/database';
import { showAlert } from '../utils/alert';

const Match = ({ onBack, activeMatchId }) => {
  const { currentUser, managerProfile, updateManagerProfile } = useAuth();
  const [friends, setFriends] = useState([]);
  const [matchState, setMatchState] = useState('select'); // 'select', 'waiting', 'ready', 'playing', 'halftime', 'finished'
  const [currentMatch, setCurrentMatch] = useState(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState([]);
  const [isHome, setIsHome] = useState(true);
  const [substitutionMode, setSubstitutionMode] = useState(null); // { playerOut: player, playerOutIndex: number }

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

        // Check if match is finished
        if (matchData.state === 'finished' && matchState !== 'finished') {
          handleMatchFinished(matchData);
        }
      }
    });

    return () => off(matchRef);
  }, [currentMatch?.id, matchState, isHome]);

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
      // Start match
      await update(ref(database, `matches/${matchId}`), { state: 'ready' });
    }
  };

  const markReadyToKickoff = async () => {
    if (!currentMatch) return;

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
      currentSecond++;
      // Convert seconds to match minutes (180 seconds = 90 minutes)
      const matchMinute = Math.floor(currentSecond / 2);

      console.log(`Match second ${currentSecond}, minute ${matchMinute}`);

      try {
        // Goal chance based on team strength (4% per minute scaled by strength)
        const goalRoll = Math.random();

        if (goalRoll < 0.04) {
          const teamRoll = Math.random();
          const isHomeGoal = teamRoll < homeChance;
          const team = isHomeGoal ? match.homeManager : match.awayManager;

          // More likely to score with attacking players
          const attackers = team.squad.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position));
          const scorer = attackers.length > 0 && Math.random() > 0.3
            ? attackers[Math.floor(Math.random() * attackers.length)]
            : team.squad[Math.floor(Math.random() * team.squad.length)];

          const currentData = (await get(matchRef)).val();
          const newScore = isHomeGoal
            ? { homeScore: (currentData.homeScore || 0) + 1 }
            : { awayScore: (currentData.awayScore || 0) + 1 };

          await update(matchRef, newScore);

          const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;

          // Get current events and prepend new one
          const updatedData = (await get(matchRef)).val();
          const newEvents = [eventText, ...(updatedData.events || [])];
          await update(matchRef, { events: newEvents });

          console.log('GOAL!', eventText);
        }

        // Update minute in Firebase
        await update(matchRef, { minute: matchMinute, second: currentSecond });

        // Half time at 90 seconds (45 match minutes)
        if (currentSecond === 90) {
          console.log('Half time reached');
          clearInterval(interval);
          await update(matchRef, { state: 'halftime' });
        }

        // Full time at 180 seconds (90 match minutes)
        if (currentSecond === 180) {
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

    const matchRef = ref(database, `matches/${currentMatch.id}`);
    const matchData = (await get(matchRef)).val();

    // Check if second half already started
    if (matchData.secondHalfStarted) {
      // Just update state to playing for this user
      setMatchState('playing');
      return;
    }

    // Mark second half as started
    await update(matchRef, {
      state: 'playing',
      secondHalfStarted: true
    });

    // Only home manager continues simulation
    if (isHome) {
      simulateSecondHalf();
    }
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
      const currentSecond = (currentData.second || 90) + 1;
      const matchMinute = Math.floor(currentSecond / 2);

      console.log(`Second half - second ${currentSecond}, minute ${matchMinute}`);

      // Goal chance based on team strength (4% per minute scaled by strength)
      const goalRoll = Math.random();

      if (goalRoll < 0.04) {
        const teamRoll = Math.random();
        const isHomeGoal = teamRoll < homeChance;
        const team = isHomeGoal ? currentMatch.homeManager : currentMatch.awayManager;

        // More likely to score with attacking players
        const attackers = team.squad.filter(p => ['ST', 'LW', 'RW', 'CAM'].includes(p.position));
        const scorer = attackers.length > 0 && Math.random() > 0.3
          ? attackers[Math.floor(Math.random() * attackers.length)]
          : team.squad[Math.floor(Math.random() * team.squad.length)];

        const newScore = isHomeGoal
          ? { homeScore: currentData.homeScore + 1 }
          : { awayScore: currentData.awayScore + 1 };

        await update(matchRef, newScore);

        const eventText = `${matchMinute}' ⚽ GOAL! ${scorer.name} (${scorer.overall}) scores for ${team.name}!`;
        const newEvents = [eventText, ...(currentData.events || [])];
        await update(matchRef, { events: newEvents });

        console.log('GOAL!', eventText);
      }

      // Update minute and second
      await update(matchRef, { minute: matchMinute, second: currentSecond });

      // Full time at 180 seconds (90 match minutes)
      if (currentSecond >= 180) {
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

          <TouchableOpacity style={styles.continueButton} onPress={resumeFromHalftime}>
            <Text style={styles.continueButtonText}>Continue to 2nd Half</Text>
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
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Match in Progress</Text>
        </View>

        <View style={styles.content}>
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

          <ScrollView style={styles.eventsContainer}>
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
          </ScrollView>
        </View>
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
});

export default Match;
