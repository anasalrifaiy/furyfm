import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FiHome, FiUsers, FiShoppingCart, FiGlobe } from 'react-icons/fi';
import { GiSoccerBall } from 'react-icons/gi';

const TABS = [
  { id: 'home',   Icon: FiHome,         label: 'Home'   },
  { id: 'team',   Icon: FiUsers,        label: 'Team'   },
  { id: 'match',  Icon: GiSoccerBall,   label: 'Match'  },
  { id: 'market', Icon: FiShoppingCart, label: 'Market' },
  { id: 'social', Icon: FiGlobe,        label: 'Social' },
];

const ACCENT   = '#7c6ff7';
const INACTIVE = 'rgba(255,255,255,0.38)';

const BottomNavigation = ({ currentTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {TABS.map(({ id, Icon, label }) => {
        const isActive = currentTab === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.tab}
            onPress={() => onTabChange(id)}
            activeOpacity={0.7}
          >
            {isActive && <View style={styles.activeBar} />}
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Icon size={22} color={isActive ? ACCENT : INACTIVE} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
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
    backgroundColor: 'rgba(10, 14, 39, 0.97)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 111, 247, 0.2)',
    paddingBottom: 16,
    paddingTop: 6,
    elevation: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: -6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  iconWrap: {
    width: 46,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 2,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(124, 111, 247, 0.15)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  label: {
    fontSize: 10,
    color: INACTIVE,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: ACCENT,
    fontWeight: '700',
  },
});

export default BottomNavigation;
