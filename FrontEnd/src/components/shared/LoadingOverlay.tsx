import React from 'react';
import { Spinner } from 'flowbite-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  submessage?: string;
  spinnerSize?: 'sm' | 'md' | 'lg' | 'xl';
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Processing...',
  submessage,
  spinnerSize = 'xl'
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center max-w-md mx-4">
        <Spinner size={spinnerSize} className="mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
          {message}
        </h3>
        {submessage && (
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
            {submessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;