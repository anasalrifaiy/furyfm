import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AuthShell from './AuthShell';
import AuthField from './AuthField';
import { FiMail, FiLock, FiUser } from '../../icons';

const Signup = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [managerName, setManagerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signup } = useAuth();

  const handleSignup = async () => {
    setError('');
    setSuccess('');
    if (!email.trim() || !password || !managerName.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, managerName.trim());
      setSuccess('Account created! You now have $900M to build your squad.');
    } catch (e) {
      const code = e?.code || '';
      if (code.includes('email-already-in-use')) setError('This email is already registered');
      else if (code.includes('invalid-email')) setError('Invalid email address');
      else if (code.includes('weak-password')) setError('Password must be at least 6 characters');
      else if (code.includes('network')) setError('Network error, check your connection');
      else setError(e?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Join Fury FM" subtitle="Create your manager account">
      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={styles.success}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      <AuthField Icon={FiUser} placeholder="Manager name" value={managerName} onChangeText={setManagerName} />
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
        placeholder="Password (min 6 characters)"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        onSubmitEditing={handleSignup}
      />

      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchLink}>Login</Text>
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
  success: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: '#22c55e',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  successText: { color: '#86efac', fontSize: 14, textAlign: 'center' },
});

export default Signup;
