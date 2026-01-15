import React from 'react';

/**
 * Modern Loader Component
 * Used across the web admin application for consistent loading states
 */
const ModernLoader = ({ size = 'lg', message = 'Loading...', fullScreen = true }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
    xl: 'h-32 w-32'
  };

  const containerClasses = fullScreen 
    ? 'fixed inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-sm z-40'
    : 'flex flex-col items-center justify-center py-12';

  return (
    <div className={containerClasses}>
      {/* Modern Spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} rounded-full border-4 border-gray-200 absolute inset-0`}></div>
        
        {/* Animated gradient spinner */}
        <div
          className={`${sizeClasses[size]} rounded-full border-4 border-transparent border-t-blue-700 border-r-blue-400 animate-spin`}
          style={{
            boxShadow: '0 0 20px rgba(13, 148, 136, 0.3)'
          }}
        ></div>
      </div>

      {/* Loading message */}
      <div className="mt-8 text-center">
        <p className="text-lg font-medium text-gray-700">{message}</p>
        <div className="flex justify-center gap-1 mt-3">
          <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default ModernLoader;
