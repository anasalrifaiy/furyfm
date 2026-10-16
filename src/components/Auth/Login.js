import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AuthShell from './AuthShell';
import AuthField from './AuthField';
import { FiMail, FiLock } from '../../icons';

const Login = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const code = e?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('Wrong email or password');
      } else if (code.includes('network')) {
        setError('Network error, check your connection');
      } else if (code.includes('too-many-requests')) {
        setError('Too many attempts, try again later');
      } else {
        setError(e?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your club">
      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <AuthField
        Icon={FiMail}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AuthField
        Icon={FiLock}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
        <Text style={styles.switchText}>
          New here? <Text style={styles.switchLink}>Create an account</Text>
        </Text>
      </TouchableOpacity>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#5b6cf0',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  switchButton: { marginTop: 18, alignItems: 'center' },
  switchText: { color: '#9aa4d1', fontSize: 14 },
  switchLink: { color: '#a5b4fc', fontWeight: 'bold' },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
});

export default Login;
