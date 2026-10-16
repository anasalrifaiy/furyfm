import { Alert } from 'react-native';

export const showAlert = (title, message, buttons = []) => {
  Alert.alert(title, message || undefined, buttons && buttons.length ? buttons : undefined);
};

export const showConfirm = (title, message, onConfirm, onCancel) => {
  Alert.alert(title, message || undefined, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'OK', onPress: onConfirm },
  ]);
};

// Promise-based confirm: resolves true when the user taps OK
export const confirmAsync = (message, title = 'Confirm') =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'OK', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
