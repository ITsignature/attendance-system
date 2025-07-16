
import React, { useState } from 'react';
import { Button, Checkbox, Label, TextInput, Modal } from "flowbite-react";
import { useNavigate } from 'react-router';

// Type definitions
interface SuccessModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText: string;
}

// Success Modal Component
const SuccessModal: React.FC<SuccessModalProps> = ({ show, onClose, title, message, buttonText }) => {
  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Body>
        <div className="text-center p-6">
          {/* Success Icon */}
          <div className="mx-auto mb-4">
            <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
              <div className="text-4xl">🎉</div>
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {message}
          </p>
          
          <Button 
            onClick={onClose}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3"
          >
            {buttonText}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

// Updated AuthLogin Component
const AuthLogin: React.FC = () => {
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [showOTP, setShowOTP] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('robertallen@example.com');
  const [password, setPassword] = useState<string>('');
  const [otpValues, setOtpValues] = useState<string[]>(['5', '0']);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const navigate = useNavigate();
  
  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('Login submitted');
    navigate('/dashboard');
    // Add login logic here
  };

  const handleForgotPassword = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowForgotPassword(false);
    setShowOTP(true);
  };

  const handleOTPSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowOTP(false);
    setShowSuccess(true);
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value.length <= 1 && /^[0-9]*$/.test(value)) {
      const newOtpValues = [...otpValues];
      newOtpValues[index] = value;
      setOtpValues(newOtpValues);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setShowForgotPassword(false);
    setShowOTP(false);
    // Reset to login form
  };

  if (showForgotPassword) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button 
          onClick={() => setShowForgotPassword(false)}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <span className="mr-2">←</span> Back
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Forgot Password
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Enter your registered email address, we'll send you a code to reset your password.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reset-email" value="Email Address" className="mb-2 block text-sm font-medium" />
            <TextInput
              id="reset-email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="robertallen@example.com"
              required
              className="w-full"
            />
          </div>

          <Button 
            onClick={handleForgotPassword}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg"
          >
            Send OTP
          </Button>
        </div>
      </div>
    );
  }

  if (showOTP) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button 
          onClick={() => {setShowOTP(false); setShowForgotPassword(true);}}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <span className="mr-2">←</span> Back
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Enter OTP
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            We have share a code of your registered email address<br />
            <span className="font-medium">{email}</span>
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center space-x-4">
            {otpValues.map((value, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOTPChange(index, e.target.value)}
                maxLength={1}
                className="w-16 h-16 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            ))}
          </div>

          <Button 
            onClick={handleOTPSubmit}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg"
          >
            Verify
          </Button>
        </div>
      </div>
    );
  }

  // Default Login Form
  return (
    <>
      <div className="space-y-4">
        <div>
          <Label htmlFor="login-email" value="Email Address" className="mb-2 block text-sm font-medium" />
          <TextInput
            id="login-email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="robertallen@example.com"
            required
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="login-password" value="Password" className="mb-2 block text-sm font-medium" />
          <div className="relative">
            <TextInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              👁️
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Checkbox 
              id="remember" 
              checked={rememberMe}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
              className="mr-2" 
            />
            <Label htmlFor="remember" className="text-sm">
              Remember Me
            </Label>
          </div>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            Forgot Password?
          </button>
        </div>

        <Button 
          onClick={handleSubmit}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg"
        >
          Login
        </Button>
      </div>

      {/* Success Modal */}
      <SuccessModal
        show={showSuccess}
        onClose={handleSuccessClose}
        title="Password Update Successfully"
        message="Your password has been update successfully"
        buttonText="Back to Login"
      />
    </>
  );
};

export default AuthLogin;