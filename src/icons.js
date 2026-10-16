import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const feather = (name) => ({ size = 24, color = '#000', style }) => (
  <Feather name={name} size={size} color={color} style={style} />
);

export const FiAlertTriangle = feather('alert-triangle');
export const FiBell = feather('bell');
export const FiChevronRight = feather('chevron-right');
export const FiGlobe = feather('globe');
export const FiInfo = feather('info');
export const FiLogOut = feather('log-out');
export const FiShoppingCart = feather('shopping-cart');
export const FiUser = feather('user');
export const FiUsers = feather('users');
export const FiEye = feather('eye');
export const FiEyeOff = feather('eye-off');
export const FiMail = feather('mail');
export const FiLock = feather('lock');
export const FiX = feather('x');
export const FiZap = feather('zap');
export const FiHome = feather('home');
export const FiAward = feather('award');
export const FiHeart = feather('heart');
export const FiRefreshCw = feather('refresh-cw');
export const FiCreditCard = feather('credit-card');
export const FiTarget = feather('target');
export const FiClock = feather('clock');
export const FiBarChart2 = feather('bar-chart-2');
export const FiGrid = feather('grid');
export const FiActivity = feather('activity');
export const FiBriefcase = feather('briefcase');

export const GiSoccerBall = ({ size = 24, color = '#000', style }) => (
  <MaterialCommunityIcons name="soccer" size={size} color={color} style={style} />
);
