import React, { useState, useEffect } from 'react';
import { Camera, Eye, EyeOff, Mail } from 'lucide-react';

const LoginSignupForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Simulating framer-motion with CSS transitions and React state
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const toggleForm = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setIsVisible(true);
      setError(null);
    }, 300);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (!isLogin) {
        // Signup logic
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords don't match");
        }
        
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to create account');
        }
        
        console.log('User created successfully:', data);
        // Automatically switch to login after successful signup
        toggleForm();
      } else {
        // Login logic
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Invalid email or password');
        }
        
        console.log('Login successful:', data);
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Save user email in cookies for 7 days
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        document.cookie = `userEmail=${data.user.email}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`;
        
        // Redirect or update UI based on successful login
        window.location.href = '/dashboard'; // Or use React Router navigation
      }
    } catch (err) {
      setError(err.message);
      console.error('Form submission error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Floating particles for the background
  const [particles, setParticles] = useState([]);
  
  useEffect(() => {
    const particlesCount = 15;
    const newParticles = Array.from({ length: particlesCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 10 + 5,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-blue-800 to-purple-800 overflow-hidden">
      {/* Floating particles in the background */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-white opacity-10 transition-all duration-1000"
          style={{ 
            width: `${particle.size}px`, 
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `float ${particle.duration}s infinite ease-in-out ${particle.delay}s`
          }}
        />
      ))}
      
      <div className="flex items-center justify-center w-full h-full p-4">
        <div className="bg-gray-900 bg-opacity-60 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row w-full h-full md:h-auto md:max-h-screen md:max-w-4xl">
          
          {/* Image Section - Covers half screen on desktop, top third on mobile */}
          <div className="w-full md:w-1/2 h-1/3 md:h-full relative overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 transform ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
            >
              <img 
                src="https://images.unsplash.com/photo-1534723328310-e82dad3ee43f?q=80&w=1936&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" 
                alt="AI visualization" 
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900 to-transparent opacity-70"></div>
              <div className="absolute bottom-0 left-0 p-8 text-white">
                <h2 
                  className={`text-2xl font-bold mb-2 transition-all duration-700 delay-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                >
                  AI-Powered Platform
                </h2>
                <p
                  className={`text-sm text-gray-200 transition-all duration-700 delay-700 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                >
                  Unlock the future with our artificial intelligence tools designed to enhance your workflow.
                </p>
              </div>
            </div>
          </div>
          
          {/* Form Section - More compact */}
          <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col justify-center relative bg-gradient-to-br from-gray-900 to-gray-800 h-2/3 md:h-full">
            <div
              className={`mb-4 text-left transition-all duration-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            >
              <h1 className="text-2xl font-bold text-teal-400 mb-1">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h1>
              <p className="text-gray-300 text-xs">
                {isLogin 
                  ? "Sign in to access your AI tools and dashboard" 
                  : "Join us and explore the power of artificial intelligence"
                }
              </p>
            </div>
            
            {error && (
              <div className="bg-red-900 bg-opacity-20 border border-red-500 text-red-400 px-3 py-2 rounded-lg mb-3 text-sm">
                {error}
              </div>
            )}
            
            <form
              className={`space-y-3 text-left transition-all duration-500 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}
              onSubmit={handleSubmit}
            >
              {!isLogin && (
                <div className="space-y-1">
                  <label htmlFor="name" className="text-gray-200 text-xs font-medium block">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 transition-all text-sm"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-1">
                <label htmlFor="email" className="text-gray-200 text-xs font-medium block text-left">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 transition-all text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label htmlFor="password" className="text-gray-200 text-xs font-medium block text-left">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 transition-all pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              {!isLogin && (
                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="text-gray-200 text-xs font-medium block text-left">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 bg-opacity-70 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500 transition-all text-sm"
                    />
                  </div>
                </div>
              )}
              
              {isLogin && (
                <div className="flex justify-end">
                  <a
                    href="#"
                    className="text-xs text-teal-400 hover:text-teal-300 transition-transform hover:scale-105"
                  >
                    Forgot password?
                  </a>
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 px-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-103 active:scale-97 text-sm mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-xl'}`}
              >
                {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
              </button>
            </form>
            
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                
              </div>
              
      
            </div>
            
            <div 
              className={`mt-4 text-center transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              <p className="text-gray-300 text-xs">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={toggleForm}
                  className="ml-1 text-teal-400 hover:text-teal-300 font-medium transition-transform hover:scale-105"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-15px) translateX(15px);
          }
          50% {
            transform: translateY(-25px) translateX(-10px);
          }
          75% {
            transform: translateY(-10px) translateX(-15px);
          }
        }
      `}</style>
    </div>
  );
};

export default LoginSignupForm;