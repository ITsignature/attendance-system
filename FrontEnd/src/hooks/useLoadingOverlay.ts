import { useState } from 'react';

interface UseLoadingOverlayReturn {
  isLoading: boolean;
  showLoading: (message?: string, submessage?: string) => void;
  hideLoading: () => void;
  message: string;
  submessage: string;
}

export const useLoadingOverlay = (): UseLoadingOverlayReturn => {
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

  return {
    isLoading,
    showLoading,
    hideLoading,
    message,
    submessage
  };
};  