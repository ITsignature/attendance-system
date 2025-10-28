import React, { createContext, useContext, useState, ReactNode } from 'react';
import LoadingOverlay from '../components/shared/LoadingOverlay';

interface LoadingContextType {
  showLoading: (message?: string, submessage?: string) => void;
  hideLoading: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Processing...');
  const [submessage, setSubmessage] = useState('');

  const showLoading = (msg?: string, submsg?: string) => {
    setMessage(msg || 'Processing...');
    setSubmessage(submsg || '');
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ showLoading, hideLoading, isLoading }}>
      {children}
      <LoadingOverlay 
        isVisible={isLoading} 
        message={message} 
        submessage={submessage} 
      />
    </LoadingContext.Provider>
  );
};

export const useGlobalLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useGlobalLoading must be used within a LoadingProvider');
  }
  return context;
};