import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(children, modalRoot);
};

export default Portal;
