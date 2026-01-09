import React, { useState,useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Label, TextInput, Alert } from 'flowbite-react';
import { useDynamicRBAC } from './rbacSystem';


const AdminLogin = () => {
  const [email, setEmail] = useState(''); // REMOVE default demo email
  const [password, setPassword] = useState(''); // REMOVE default demo password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  
  const { login } = useDynamicRBAC();
  const navigate = useNavigate();

  
  /**
   * Handles form submission and performs login attempt
   * 
   * @param e Form event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');
    setRemainingAttempts(null);

    try {
      const success = await login(email, password);

      console.log('Login success:', success);


      if (success) {
        // Get user data from localStorage to check role
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);

          // Redirect based on role
          if (user.roleName === 'Employee') {
            navigate('/employee-portal/dashboard');
          } else {
            navigate('/dashboard');
          }
        } else {
          // Fallback to dashboard if user data not found
          navigate('/dashboard');
        }
      } else {
        setError('Invalid email or password. Only admin users can access this system.');
      }
    } catch (error: any) {
      console.error('Login error:', error);

      
      // Handle specific error responses from backend
      if (error.response?.data) {
        const errorData = error.response.data;
        setError(errorData.message || 'Login failed');

        
        // Show remaining attempts if account is being locked
        if (errorData.remainingAttempts !== undefined) {
          setRemainingAttempts(errorData.remainingAttempts);
        }
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access restricted to authorized administrators only
          </p>
        </div>

        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert color="failure">
                <span className="font-medium">Login Failed:</span> {error}
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <div className="mt-1 text-sm">
                    Remaining attempts: {remainingAttempts}
                  </div>
                )}
                {remainingAttempts === 0 && (
                  <div className="mt-1 text-sm font-medium">
                    Account will be temporarily locked after next failed attempt.
                  </div>
                )}
              </Alert>
            )}

            {/* Email Field */}
            <div>
              <Label htmlFor="email" value="Email Address" />
              <TextInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>

            {/* Password Field */}
            <div>
              <Label htmlFor="password" value="Password" />
              <TextInput
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in to Admin Panel'
              )}
            </Button>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Security Notice
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Only authorized admin users can access this system</li>
                    <li>Multiple failed attempts will temporarily lock your account</li>
                    <li>Contact your system administrator if you need access</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
/*******  b6fec2dd-82c1-45d0-84e3-e374eeb803fd  *******/

export default AdminLogin;