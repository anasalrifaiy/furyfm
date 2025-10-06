# 🔥 Fury FM - Advanced Football Manager

A modern, realistic football manager game built with React Native Web and Firebase. Manage your squad, trade players with other managers, and compete on the global leaderboard!

## Features

### 🎮 Core Gameplay
- **200 Realistic Players** from top 5 European leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)
- **$200M Starting Budget** to build your dream squad
- **Player Prices** ranging from $5M to $80M in USD
- **Negotiable Transfers** with dynamic pricing system

### 👥 Squad Management
- View and organize your squad by position
- Sell players back to the market
- Track player stats: age, position, nationality, overall rating
- Monitor your squad value

### ⚽ Formation System
- Multiple formations: 4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 3-4-3
- Drag-and-drop player assignment
- Visual tactical pitch display
- Save and load your preferred lineup

### 💰 Transfer Market
- Search players by name, club, position, or league
- Filter by position and league
- Make offers with negotiable prices
- Realistic acceptance/rejection system (based on offer amount)

### 🤝 Social Features
- **Friends System**: Search and add other managers
- **Leaderboard**: Compete globally based on points, squad value, or wins
- **Manager Profiles**: View other managers' squads and stats
- **Notifications**: Stay updated on friend requests and trade offers

### 🔄 Player Trading
- Make offers on players from other managers' squads
- Receive and manage incoming trade offers
- Counter-offer system (coming soon)
- Real-time notifications

## Tech Stack

- **Frontend**: React Native Web
- **Backend**: Firebase (Authentication, Realtime Database, Firestore)
- **Bundler**: Webpack
- **Styling**: StyleSheet (React Native)

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd FuryFM
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:8080`

### Building for Production

```bash
npm run build
```

## Project Structure

```
FuryFM/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── Auth/
│   │       ├── Login.js
│   │       └── Signup.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── data/
│   │   └── players.js (200 realistic players)
│   ├── screens/
│   │   ├── TransferMarket.js
│   │   ├── Squad.js
│   │   ├── Formation.js
│   │   ├── Friends.js
│   │   ├── Leaderboard.js
│   │   ├── Notifications.js
│   │   └── ManagerProfile.js
│   ├── App.js
│   ├── firebase.js
│   └── index.js
├── package.json
└── webpack.config.js
```

## Firebase Configuration

The app uses the following Firebase services:
- **Authentication**: Email/Password sign-in
- **Realtime Database**: Player market, trade offers
- **Firestore**: Manager profiles, squads, friends

Your Firebase config is already set up in `src/firebase.js`.

## Game Mechanics

### Starting the Game
1. Create an account with email/password
2. Choose your manager name
3. Receive $200M starting budget

### Building Your Squad
1. Browse the Transfer Market (200+ players available)
2. Filter by position, league, or search by name
3. Make offers (negotiable pricing)
4. Offers accepted if >= 90% of asking price (or 50% chance if lower)

### Managing Your Team
1. View your squad organized by position (GK, Defenders, Midfielders, Forwards)
2. Set your formation and lineup
3. Sell players back to the market when needed

### Social Interaction
1. Search for other managers by name
2. Add friends to your network
3. View their squads and make trade offers
4. Compete on the leaderboard

### Trading System
1. View another manager's squad
2. Make an offer on their players
3. They receive a notification
4. They can accept, reject, or counter (counter-offers coming soon)

## Roadmap

### Phase 1 (✅ Completed)
- Authentication system
- 200 realistic players
- Transfer market with negotiable prices
- Squad management
- Formation system
- Friends system
- Leaderboard
- Notifications
- Manager profiles
- Player-to-player trading

### Phase 2 (Coming Soon)
- Counter-offer system
- Match simulation
- League system
- Tactics and strategies
- Player training and development
- Injuries and fitness
- Contract negotiations
- Youth academy

### Phase 3 (Future)
- Mobile apps (iOS & Android)
- Real-time multiplayer matches
- Tournaments and cups
- Manager achievements
- Advanced analytics
- Custom leagues

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please open an issue on GitHub.

---

**Enjoy managing your squad! 🔥⚽**
