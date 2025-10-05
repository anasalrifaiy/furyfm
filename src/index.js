import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import App from './App';

// Register the app for React Native Web
AppRegistry.registerComponent('FuryFM', () => App);

// Get the root element
const container = document.getElementById('root');
const root = createRoot(container);

// Render the app
root.render(<App />);