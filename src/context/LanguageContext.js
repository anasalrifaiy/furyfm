import React, { createContext, useState, useContext, useEffect } from 'react';
import { getTranslation } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [direction, setDirection] = useState('ltr');

  useEffect(() => {
    // Load saved language preference
    const savedLang = localStorage.getItem('preferredLanguage') || 'en';
    setLanguage(savedLang);
    setDirection(savedLang === 'ar' ? 'rtl' : 'ltr');

    // Apply direction to document
    document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = savedLang;
  }, []);

  const switchLanguage = (lang) => {
    setLanguage(lang);
    setDirection(lang === 'ar' ? 'rtl' : 'ltr');
    localStorage.setItem('preferredLanguage', lang);

    // Apply direction to document
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const t = (key) => getTranslation(language, key);

  const value = {
    language,
    direction,
    switchLanguage,
    t,
    isRTL: language === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
