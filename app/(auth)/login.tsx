import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, resetPassword, loading } = useAuth();

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!password.trim()) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    try {
      setError(null);
      if (!validateForm()) return;
      
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      if (errorMessage.includes('Email not confirmed')) {
        setError('Please check your email (including spam folder) and click the confirmation link to verify your account.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleForgotPassword = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }
      
      await resetPassword(email);
      setSuccess('Password reset instructions have been sent to your email');
      setPassword(''); // Clear password field
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800' }}
        style={styles.backgroundImage}
      />
      <View style={styles.content}>
        <Text style={styles.title}>FM FURY</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <TextInput
          style={[styles.input, !email.trim() && error && styles.inputError]}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
            setSuccess(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        
        <TextInput
          style={[styles.input, !password.trim() && error && styles.inputError]}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
            setSuccess(null);
          }}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.forgotPassword}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ff0000',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#ff0000',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  successContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  successText: {
    color: '#4CAF50',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#fff',
    fontFamily: 'Inter_400Regular',
  },
  footerLink: {
    color: '#4CAF50',
    fontFamily: 'Inter_600SemiBold',
  },
});