import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { GiSoccerBall } from '../../icons';

// Shared layout for the login and signup screens
const AuthShell = ({ title, subtitle, children }) => (
  <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      overScrollMode="never"
    >
      <View style={styles.logo}>
        <GiSoccerBall size={40} color="#ffffff" />
      </View>
      <Text style={styles.brand}>FURY FM</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.card}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0b1020' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  logo: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#5b6cf0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brand: {
    color: '#f1f5ff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 18,
  },
  title: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#9aa4d1', fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  card: {
    backgroundColor: '#141a33',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#232c57',
  },
});

export default AuthShell;
