import AuthLogin from '../authforms/AuthLogin';

// Updated Login Page Component
const Login = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md border border-blue-200 dark:border-blue-800">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-xl mb-4">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">HRMS</div>
        </div>

        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please login here
          </p>
        </div>

        {/* Auth Form */}
        <AuthLogin />
      </div>
    </div>
  );
};

export default Login;
