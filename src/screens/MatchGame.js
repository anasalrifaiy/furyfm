import React from 'react';
import MatchGameNative from '../../components/MatchGame';

// Adapts the web screen's props to the native match component
const MatchGame = ({
  homeSquad,
  awaySquad,
  homeFormation,
  awayFormation,
  isHost,
  matchId,
  isPractice,
  homeClubName,
  awayClubName,
  onMatchEnd,
  onBack,
}) => (
  <MatchGameNative
    homeSquad={homeSquad}
    awaySquad={awaySquad}
    homeFormation={homeFormation || '4-3-3'}
    awayFormation={awayFormation || '4-3-3'}
    homeName={homeClubName}
    awayName={awayClubName}
    isHost={isHost}
    matchId={matchId}
    isPractice={isPractice}
    onExit={(hs, as, finished) => {
      if (finished) onMatchEnd && onMatchEnd(hs, as);
      else onBack && onBack();
    }}
  />
);

export default MatchGame;
