// Cross-platform alert utility that works on web and React Native

export const showAlert = (title, message, buttons = []) => {
  if (typeof window !== 'undefined' && window.alert) {
    // Web environment
    const fullMessage = message ? `${title}\n\n${message}` : title;
    window.alert(fullMessage);

    // Execute the first button's onPress callback if it exists
    if (buttons && buttons.length > 0 && buttons[0].onPress) {
      buttons[0].onPress();
    }
  } else {
    // React Native environment (fallback)
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, buttons);
  }
};

export const showConfirm = (title, message, onConfirm, onCancel) => {
  if (typeof window !== 'undefined' && window.confirm) {
    // Web environment
    const fullMessage = message ? `${title}\n\n${message}` : title;
    const result = window.confirm(fullMessage);

    if (result && onConfirm) {
      onConfirm();
    } else if (!result && onCancel) {
      onCancel();
    }
  } else {
    // React Native environment (fallback)
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'OK', onPress: onConfirm }
    ]);
  }
};
