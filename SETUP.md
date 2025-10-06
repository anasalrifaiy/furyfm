# Fury FM - Setup Guide

## Quick Start

Your Fury FM application is ready to go! 🎉

### Current Status
✅ All features implemented
✅ Firebase configured
✅ 200 realistic players loaded
✅ Development server running at http://localhost:3000

### What's Included

1. **Authentication System**
   - Email/Password signup and login
   - Each manager gets $200M starting budget
   - Secure Firebase authentication

2. **200 Realistic Players**
   - 50 from Premier League
   - 50 from La Liga
   - 40 from Serie A
   - 35 from Bundesliga
   - 25 from Ligue 1
   - Prices range from $5M to $80M USD
   - Real player names, positions, ratings

3. **Transfer Market**
   - Browse all available players
   - Filter by position and league
   - Search by player name or club
   - Make negotiable offers
   - Dynamic acceptance system

4. **Squad Management**
   - View players by position (GK, Defenders, Midfielders, Forwards)
   - Check player details
   - Sell players back to market
   - Track squad value

5. **Formation Screen**
   - 5 different formations (4-3-3, 4-4-2, 3-5-2, 4-2-3-1, 3-4-3)
   - Visual pitch with player positions
   - Drag-and-drop player assignment
   - Save your lineup

6. **Friends System**
   - Search managers by name
   - Add/remove friends
   - View friends list
   - Click on friend to view their profile

7. **Leaderboard**
   - Global rankings
   - Sort by Points, Squad Value, or Wins
   - View any manager's profile
   - Add managers directly from leaderboard

8. **Notifications**
   - Friend request notifications
   - Trade offer notifications
   - Real-time updates
   - Mark as read/unread

9. **Manager Profiles**
   - View any manager's squad
   - See their statistics
   - Make trade offers on their players
   - View match record

10. **Player-to-Player Trading**
    - Make offers on players from other managers
    - Receive notifications of incoming offers
    - Negotiable pricing system

## Running the Application

### Development Mode
```bash
npm start
```
Access at: http://localhost:3000

### Build for Production
```bash
npm run build
```
Output will be in `/dist` folder

## Firebase Setup

Your Firebase project is already configured:
- **Project ID**: fury-fm
- **Database**: Europe West 1
- **Services**: Authentication, Realtime Database, Firestore, Analytics

### Firebase Console
Access your Firebase console at:
https://console.firebase.google.com/project/fury-fm

## Testing the Application

1. **Create an Account**
   - Go to http://localhost:3000
   - Click "Sign up"
   - Enter manager name, email, and password
   - You'll receive $200M budget

2. **Buy Your First Player**
   - Go to Transfer Market
   - Browse or search for players
   - Click "Make Offer" on a player
   - Enter your offer amount (try offering 90%+ of asking price)
   - Submit the offer

3. **Build Your Squad**
   - Continue buying players
   - Go to "My Squad" to view your team
   - Organize by position

4. **Set Your Formation**
   - Go to Formation screen
   - Choose a formation (e.g., 4-3-3)
   - Tap empty positions to assign players
   - Save your formation

5. **Add Friends**
   - Go to Friends
   - Search for other managers
   - Add them as friends
   - View their profiles

6. **Trade with Managers**
   - View another manager's profile (from Friends or Leaderboard)
   - Click "Make Offer" on their players
   - They'll receive a notification
   - Negotiate prices

## Database Structure

```
fury-fm/
├── managers/
│   └── {userId}/
│       ├── managerName
│       ├── email
│       ├── budget
│       ├── squad[]
│       ├── friends[]
│       ├── notifications[]
│       ├── wins
│       ├── draws
│       ├── losses
│       └── points
├── market/
│   └── {playerId}/
│       ├── name
│       ├── age
│       ├── position
│       ├── club
│       ├── price
│       ├── onMarket
│       └── ownerId
└── tradeOffers/
    └── {offerId}/
        ├── from
        ├── to
        ├── player
        ├── offerAmount
        └── status
```

## Next Steps for Mobile (iOS/Android)

To create native mobile apps later:

1. Install Expo CLI:
```bash
npm install -g expo-cli
```

2. Initialize Expo project:
```bash
expo init FuryFM-Mobile
```

3. Copy the `src` folder contents to the new project

4. Update Firebase config for mobile

5. Build for iOS/Android:
```bash
expo build:ios
expo build:android
```

## Deployment Options

### Web Deployment
- **Firebase Hosting**: `firebase deploy`
- **Vercel**: Connect your GitHub repo
- **Netlify**: Deploy from GitHub
- **GitHub Pages**: Use `gh-pages` branch

### Database Rules (Important!)
Before deploying to production, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    "managers": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    },
    "market": {
      ".read": true,
      ".write": "auth != null"
    },
    "tradeOffers": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## Troubleshooting

### Server won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm start
```

### Firebase connection issues
- Check your internet connection
- Verify Firebase config in `src/firebase.js`
- Check Firebase console for project status

### Build errors
```bash
# Clear webpack cache
rm -rf dist
npm run build
```

## Features Coming Soon

- ✨ Counter-offer system for trades
- ⚽ Match simulation
- 🏆 League system
- 📊 Advanced statistics
- 💪 Player training and development
- 🏥 Injuries and fitness system
- 📝 Contract negotiations

## Support

- GitHub Issues: [Create an issue]
- Email: [Your email]
- Discord: [Your server]

---

**Happy Managing! 🔥⚽**

Built with ❤️ using React Native Web and Firebase
