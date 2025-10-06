import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const Signup = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [managerName, setManagerName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const handleSignup = async () => {
    console.log('Signup button clicked');

    if (!email || !password || !managerName) {
      const message = 'Please fill in all fields';
      console.error('Validation error:', message);
      alert(message);
      return;
    }

    if (password.length < 6) {
      const message = 'Password must be at least 6 characters';
      console.error('Validation error:', message);
      alert(message);
      return;
    }

    console.log('Attempting signup for:', email, 'Manager:', managerName);
    setLoading(true);
    try {
      const result = await signup(email, password, managerName);
      console.log('Signup successful:', result);
      alert('Success! Account created! You now have $200M to build your squad.');
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup Failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Fury FM</Text>
      <Text style={styles.subtitle}>Create your manager account</Text>

      <TextInput
        style={styles.input}
        placeholder="Manager Name"
        placeholderTextColor="#888"
        value={managerName}
        onChangeText={setManagerName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters)"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitch} style={styles.switchButton}>
        <Text style={styles.switchText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0a0e27',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#1a1f3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d3561',
  },
  button: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#667eea',
    fontSize: 14,
  },
});

export default Signup;
