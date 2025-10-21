import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const BottomNavigation = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'team', icon: '👥', label: 'Team' },
    { id: 'match', icon: '⚽', label: 'Match' },
    { id: 'market', icon: '💰', label: 'Market' },
    { id: 'social', icon: '🏆', label: 'Social' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, currentTab === tab.id && styles.activeTab]}
          onPress={() => onTabChange(tab.id)}
        >
          <Text style={[styles.icon, currentTab === tab.id && styles.activeIcon]}>
            {tab.icon}
          </Text>
          <Text style={[styles.label, currentTab === tab.id && styles.activeLabel]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1a1f3a',
    borderTopWidth: 1,
    borderTopColor: '#2d3561',
    paddingBottom: 10,
    paddingTop: 10,
    elevation: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  activeIcon: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#667eea',
    fontWeight: 'bold',
  },
});

export default BottomNavigation;
