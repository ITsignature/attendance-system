import React, { useState } from 'react';
import { Card, Button, TextInput, Label, Alert, Badge } from 'flowbite-react';
import { HiEye, HiEyeOff, HiInformationCircle, HiShieldCheck } from 'react-icons/hi';
import { useDynamicRBAC } from './rbacSystem';
import { useNavigate } from 'react-router-dom';


const AdminLoginPage: React.FC = () => {
 const [email, setEmail] = useState(''); // REMOVE default demo email
   const [password, setPassword] = useState(''); // REMOVE default demo password
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [remainingAttempts, setRemainingAttempts] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
     const [showPassword, setShowPassword] = useState(false);
   
   const { login } = useDynamicRBAC();
   const navigate = useNavigate();
 
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
         // Redirect to dashboard on successful login
         navigate('/dashboard');
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
 
  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  // const getRoleInfo = (roleId: string) => {
  //   return roles.find(role => role.id === roleId);
  // };

  // const getClientInfo = (clientId: string) => {
  //   return clients.find(client => client.id === clientId);
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Main Login Card */}
        <Card className="shadow-2xl border-0">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl mb-4 shadow-lg">
              <HiShieldCheck className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Admin Portal
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              HR Management System
            </p>
          </div>

          {/* Demo Info Alert */}
          <Alert color="info" icon={HiInformationCircle} className="mb-6">
            <div>
              <span className="font-medium">Demo Environment</span>
              <p className="text-xs mt-1">
                Use the demo credentials below or click "Show Demo Users" for quick access.
              </p>
            </div>
          </Alert>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" value="Email Address" />
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your admin email"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password" value="Password" />
              <div className="relative mt-1">
                <TextInput
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <HiEyeOff size={20} /> : <HiEye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <Alert color="failure">
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              gradientDuoTone="purpleToBlue"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In to Admin Portal'
              )}
            </Button>
          </form>

          {/* Demo Access */}
          {/* <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center mb-4">
              <Button
                color="green"
                outline
                onClick={() => setShowDemoUsers(!showDemoUsers)}
                className="w-full"
              >
                {showDemoUsers ? 'Hide' : 'Show'} Demo Users
              </Button>
            </div>

            {showDemoUsers && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Quick Demo Access:
                </h3>
                {demoCredentials.map((demo, index) => (
                  <Card key={index} className="bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div 
                      className="flex items-center justify-between"
                      onClick={() => handleDemoLogin(demo.email, demo.password)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {demo.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {demo.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {demo.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge color="purple" size="xs">{demo.role}</Badge>
                          <Badge color="blue" size="xs">{demo.client}</Badge>
                          <Badge 
                            color={demo.access === 'Full Access' ? 'red' : 'yellow'} 
                            size="xs"
                          >
                            {demo.access}
                          </Badge>
                        </div>
                      </div>
                      <Button size="xs" gradientDuoTone="purpleToBlue">
                        Login
                      </Button>
                    </div>
                  </Card>
                ))}
                
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                  Password for all demo accounts: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">demo123</code>
                </div>
              </div>
            )}
          </div> */}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            <p>Secure admin access for HR management</p>
            <p className="mt-1">Multi-tenant RBAC system</p>
          </div>
        </Card>

        {/* Features Info */}
        <Card className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">
            Admin Portal Features:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Role & Permission Management
              </div>
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Admin User Management
              </div>
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Multi-tenant Support
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Dynamic Permission System
              </div>
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Real-time Access Control
              </div>
              <div className="flex items-center text-purple-800 dark:text-purple-300">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Comprehensive Audit Trail
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminLoginPage;