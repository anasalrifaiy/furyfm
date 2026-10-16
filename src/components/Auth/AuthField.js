import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { FiEye, FiEyeOff } from '../../icons';

// Input with a leading icon and, for passwords, an eye button to show or hide the text
const AuthField = ({ Icon, secure, style, ...props }) => {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused, style]}>
      {Icon ? <Icon size={18} color={focused ? '#a5b4fc' : '#7b86b8'} style={styles.icon} /> : null}
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#6b7599"
        secureTextEntry={secure && !visible}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        underlineColorAndroid="transparent"
      />
      {secure ? (
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <FiEyeOff size={20} color="#a5b4fc" /> : <FiEye size={20} color="#7b86b8" />}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2140',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2a3566',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  wrapFocused: {
    borderColor: '#7c8cf8',
    backgroundColor: '#1e2750',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#f1f5ff',
    fontSize: 16,
    paddingVertical: 14,
  },
});

export default AuthField;
