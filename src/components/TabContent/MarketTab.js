import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';

const MarketTab = ({ onNavigate }) => {
  const { t } = useLanguage();

  const marketItems = [
    { id: 'market', icon: '💰', title: t('transferMarket'), desc: t('transferMarketDesc'), gradient: 'secondary' },
    { id: 'bank', icon: '🏦', title: t('bank'), desc: t('bankDesc'), gradient: 'secondary' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Market</Text>
        <Text style={styles.headerSubtitle}>Buy, sell, and manage finances</Text>
      </View>

      <View style={styles.menuGrid}>
        {marketItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, styles[`${item.gradient}Card`]]}
            onPress={() => onNavigate(item.id)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 80,
  },
  menuCard: {
    width: '48%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  secondaryCard: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  menuIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
    textAlign: 'center',
  },
  menuDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});

export default MarketTab;
