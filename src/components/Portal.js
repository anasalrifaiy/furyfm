import React from 'react';
import { Modal } from 'react-native';

// Native replacement for the web portal: overlays render inside a full-screen transparent Modal
const Portal = ({ children }) => (
  <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
    {children}
  </Modal>
);

export default Portal;
