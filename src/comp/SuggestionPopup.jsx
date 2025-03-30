import React from 'react';

const SuggestionPopup = ({ isOpen, onClose, title, aiSuggestion }) => {
  const handleCopyAiResponse = () => {
    navigator.clipboard.writeText(aiSuggestion);
    alert('AI suggestion copied to clipboard!');
  };
  
  if (!isOpen) return null;
  
  // Sample content for "Your Content" section - this would normally come from props
  const yourContent = "This is your custom content for this section. It provides personalized advice based on your resume's specific needs. You can customize this content for each section to provide tailored guidance to the user.";
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">AI Suggestion</h3>
            <div className="bg-gray-50 p-4 rounded-lg text-left text-gray-700 mb-2 whitespace-pre-line">
              {aiSuggestion}
            </div>
            <button 
              onClick={handleCopyAiResponse}
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition text-sm"
            >
              <i className="fas fa-copy mr-2"></i> Copy AI Suggestion
            </button>
          </div>
          
          {/* <div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Your Content</h3>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-left text-gray-700">
              {yourContent}
            </div>
          </div> */}
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestionPopup; 