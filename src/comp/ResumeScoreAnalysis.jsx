import React, { useState, useRef, useEffect } from 'react';
import SuggestionPopup from './SuggestionPopup';
import { useNavigate } from 'react-router-dom';

const ResumeScoreAnalysis = () => {
  const [activeSection, setActiveSection] = useState('ats-parse');
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupContent, setPopupContent] = useState({
    title: '',
    aiSuggestion: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [scoreCategories, setScoreCategories] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [sectionContent, setSectionContent] = useState({});
  
  const navigate = useNavigate();
  
  // Refs for each section to enable scrolling
  const sectionRefs = useRef({});

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        
        // Get user email from cookies
        const cookies = document.cookie.split(';');
        const emailCookie = cookies.find(cookie => cookie.trim().startsWith('userEmail='));
        
        if (!emailCookie) {
          setError('User email not found. Please login again.');
          navigate('/login');
          return;
        }
        
        const email = emailCookie.split('=')[1];
        
        console.log('Fetching analysis with email:', email);
        
        // Make API call to analyze resume
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/analyze/resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No resume found. Please upload your resume first.');
            return;
          }
          throw new Error('Failed to analyze resume');
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        setAnalysisData({
          message: data.message,
          filename: data.filename,
          upload_date: data.upload_date
        });
        
        // Parse the analysis response which is returned as JSON
        try {
          // The analysis might be a JSON string or might have backtick delimiters
          let analysisText = data.analysis;
          console.log('Raw analysis text:', analysisText);
          
          // Check if the analysis is a JSON string wrapped in backticks
          if (analysisText && typeof analysisText === 'string') {
            if (analysisText.startsWith('```json') && analysisText.endsWith('```')) {
              // Remove the backticks and json tag
              analysisText = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              console.log('After removing backticks:', analysisText);
            }
            
            // Parse the JSON
            let parsedAnalysis;
            try {
              parsedAnalysis = JSON.parse(analysisText);
              console.log('Parsed analysis:', parsedAnalysis);
            } catch (jsonError) {
              console.error('JSON parse error:', jsonError);
              // Try to recover if it's not valid JSON but might be a string representation of an object
              try {
                // Sometimes the API returns stringified objects
                parsedAnalysis = eval(`(${analysisText})`);
                console.log('Recovered with eval:', parsedAnalysis);
              } catch (evalError) {
                console.error('Eval recovery failed:', evalError);
                throw jsonError; // Throw the original error
              }
            }
            
            // Extract the data from the parsed JSON
            const scoreCategories = parsedAnalysis.scoreCategories || [];
            const sectionContent = parsedAnalysis.sectionContent || {};
            
            console.log('Categories count:', scoreCategories.length);
            console.log('Sections count:', Object.keys(sectionContent).length);
            
            // If no categories or sections found, use fallback data for testing
            if (scoreCategories.length === 0 || Object.keys(sectionContent).length === 0) {
              console.warn('Using fallback data for testing - empty API response');
              
              // Sample test data
              const fallbackCategories = [
                { id: 'ats-format', category: 'ESSENTIALS', title: 'ATS & Format', score: '35%', icon: 'file-alt', iconColor: 'text-blue-500', scoreClass: 'bg-red-100 text-red-800' },
                { id: 'content-quality', category: 'ESSENTIALS', title: 'Content Quality', score: '70%', icon: 'check-circle', iconColor: 'text-green-500', scoreClass: 'bg-green-100 text-green-800' },
                { id: 'keywords', category: 'ESSENTIALS', title: 'Keywords Usage', score: '50%', icon: 'key', iconColor: 'text-yellow-500', scoreClass: 'bg-yellow-100 text-yellow-800' },
                { id: 'structure', category: 'LAYOUT', title: 'Structure', score: '75%', icon: 'th-large', iconColor: 'text-purple-500', scoreClass: 'bg-purple-100 text-purple-800' },
                { id: 'visual', category: 'LAYOUT', title: 'Visual Appeal', score: '80%', icon: 'eye', iconColor: 'text-indigo-500', scoreClass: 'bg-indigo-100 text-indigo-800' },
                { id: 'space', category: 'LAYOUT', title: 'Space Utilization', score: '85%', icon: 'expand', iconColor: 'text-blue-500', scoreClass: 'bg-blue-100 text-blue-800' },
                { id: 'grammar', category: 'LANGUAGE', title: 'Grammar & Spelling', score: '95%', icon: 'spell-check', iconColor: 'text-green-500', scoreClass: 'bg-green-100 text-green-800' },
                { id: 'action-verbs', category: 'LANGUAGE', title: 'Action Verbs', score: '60%', icon: 'bolt', iconColor: 'text-yellow-500', scoreClass: 'bg-yellow-100 text-yellow-800' }
              ];
              
              // Populate with at least one section for testing
              const fallbackSections = {
                'ats-format': {
                  title: 'ATS & Format',
                  design: 'warning',
                  layout: 'split',
                  icon: 'file-alt',
                  issues: '3 Issues',
      description: [
                    'Your resume may have issues with ATS compatibility due to formatting.',
                    'Consider simplifying the layout for better parsing by automated systems.'
                  ],
      scoreTitle: 'Needs Improvement',
                  scorePercent: '35%',
                  scoreColor: 'from-red-400 to-red-600',
      scoreDescription: [
                    'Use a single-column format for better ATS compatibility.',
                    'Remove images, charts, and complex tables that may confuse scanning software.',
                    'Use standard section headings that ATS systems recognize easily.'
                  ],
                  actionText: 'Get ATS Optimization Tips'
                }
              };
              
              // Use fallback data when API returns empty results
              setScoreCategories(scoreCategories.length === 0 ? fallbackCategories : scoreCategories);
              setSectionContent(Object.keys(sectionContent).length === 0 ? fallbackSections : sectionContent);
              
              // Create default suggestions
              const defaultAiSuggestions = {};
              const sectionsToUse = Object.keys(sectionContent).length === 0 ? fallbackSections : sectionContent;
              
              Object.keys(sectionsToUse).forEach(key => {
                const section = sectionsToUse[key];
                if (section && section.scoreDescription && Array.isArray(section.scoreDescription)) {
                  defaultAiSuggestions[key] = section.scoreDescription.join('\n\n');
                }
              });
              
              setAiSuggestions(defaultAiSuggestions);
            } else {
              // Use API data when available
              setScoreCategories(scoreCategories);
              setSectionContent(sectionContent);
              
              // Create AI suggestions
              const defaultAiSuggestions = {};
              
              Object.keys(sectionContent).forEach(key => {
                const section = sectionContent[key];
                if (section && section.scoreDescription && Array.isArray(section.scoreDescription)) {
                  defaultAiSuggestions[key] = section.scoreDescription.join('\n\n');
                }
              });
              
              setAiSuggestions(defaultAiSuggestions);
            }
          } else {
            console.error('Analysis text is not a string or is undefined:', analysisText);
            setError('Invalid analysis data format received from server.');
          }
        } catch (parseError) {
          console.error('Error parsing analysis data:', parseError);
          console.error('Analysis text:', data.analysis);
          setError('Error processing resume analysis results. Please try again later.');
        }
      } catch (err) {
        console.error('Error fetching analysis data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [navigate]);

  const handleCategoryClick = (categoryId) => {
    setActiveSection(categoryId);
    
    // Scroll to the section when a category is clicked
    if (sectionRefs.current[categoryId]) {
      sectionRefs.current[categoryId].scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const handleActionButtonClick = (section) => {
    setPopupContent({
      title: section.title,
      aiSuggestion: aiSuggestions[section.id] || "No AI suggestions available for this section."
    });
    setPopupOpen(true);
  };

  // Group categories by category type
  const groupedCategories = {};
  scoreCategories.forEach(category => {
    if (!groupedCategories[category.category]) {
      groupedCategories[category.category] = [];
    }
    groupedCategories[category.category].push(category);
  });

  // Calculate average score and total issues
  const calculateAverageScore = () => {
    if (scoreCategories.length === 0) return 0;
    
    const totalScore = scoreCategories.reduce((sum, category) => {
      // Extract numeric value from score (e.g., "35%" -> 35)
      const scoreValue = parseInt(category.score.replace('%', ''));
      return isNaN(scoreValue) ? sum : sum + scoreValue;
    }, 0);
    
    return Math.round(totalScore / scoreCategories.length);
  };
  
  const calculateTotalIssues = () => {
    return scoreCategories.reduce((sum, category) => {
      // If the category has issues count in the title or description
      const issuesMatch = category.title.match(/(\d+)\s*issues?/i) || 
                         (category.description && category.description.join(' ').match(/(\d+)\s*issues?/i));
      
      if (issuesMatch && issuesMatch[1]) {
        return sum + parseInt(issuesMatch[1]);
      }
      
      // Otherwise count each category as 1 issue if score is below 70%
      const scoreValue = parseInt(category.score.replace('%', ''));
      if (!isNaN(scoreValue) && scoreValue < 70) {
        return sum + 1;
      }
      
      return sum;
    }, 0);
  };
  
  const getScoreColorClass = (score) => {
    if (score >= 90) return "text-green-500"; 
    if (score >= 80) return "text-emerald-500";
    if (score >= 70) return "text-teal-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 50) return "text-purple-500";
    if (score >= 40) return "text-indigo-400";
    if (score >= 30) return "text-yellow-500";
    return "text-red-500";
  };
  
  const averageScore = calculateAverageScore();
  const totalIssues = calculateTotalIssues();
  const scoreColorClass = getScoreColorClass(averageScore);

  // Dynamic styles based on section design type
  const getSectionStyles = (designType) => {
    switch(designType) {
      case 'error':
        return {
          containerClass: 'bg-red-50 border-l-4 border-red-500',
          iconBgClass: 'bg-red-600',
          issuesClass: 'bg-red-100 text-red-700',
          actionBtnClass: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          containerClass: 'bg-orange-50 border-l-4 border-orange-500',
          iconBgClass: 'bg-orange-500',
          issuesClass: 'bg-orange-100 text-orange-700',
          actionBtnClass: 'bg-orange-500 hover:bg-orange-600'
        };
      case 'info':
        return {
          containerClass: 'bg-blue-50 border-l-4 border-blue-500',
          iconBgClass: 'bg-blue-600',
          issuesClass: 'bg-blue-100 text-blue-700',
          actionBtnClass: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'success':
        return {
          containerClass: 'bg-green-50 border-l-4 border-green-500',
          iconBgClass: 'bg-green-600',
          issuesClass: 'bg-green-100 text-green-700',
          actionBtnClass: 'bg-green-600 hover:bg-green-700'
        };
      default:
        return {
          containerClass: 'bg-gray-50',
          iconBgClass: 'bg-indigo-600',
          issuesClass: 'bg-gray-100 text-gray-700',
          actionBtnClass: 'bg-indigo-600 hover:bg-indigo-700'
        };
    }
  };
  
  // Render section content based on layout type
  const renderSectionContent = (section, styles, sectionId) => {
    switch(section.layout) {
      case 'split':
        return (
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div>
              <h3 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4 text-left">{section.title}</h3>
              <div className="space-y-4 mb-6">
                {section.description.map((paragraph, idx) => (
                  <p key={idx} className="text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                ))}
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mt-2 ${styles.issuesClass}`}>
                  {section.issues}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm text-left">
              <div className="relative h-3 bg-gray-200 rounded-full mb-6">
                <div 
                  className={`absolute top-0 left-0 h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                  style={{ width: section.scorePercent }}
                ></div>
                <div 
                  className="absolute -top-6 text-red-500" 
                  style={{ left: section.scorePercent, transform: 'translateX(-50%)' }}
                >
                  <i className="fas fa-map-marker-alt text-xl"></i>
                </div>
              </div>
              <h4 className="text-2xl font-bold text-gray-800 mb-3 text-left">{section.scoreTitle}</h4>
              <div className="space-y-3 mb-4">
                {section.scoreDescription.map((paragraph, idx) => (
                  <p key={idx} className="text-gray-600 text-left">{paragraph}</p>
                ))}
              </div>
              {section.actionText && (
                <a 
                  href="#" 
                  className={`inline-block text-white font-medium py-3 px-6 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleActionButtonClick({...section, id: sectionId});
                  }}
                >
                  {section.actionText}
                </a>
              )}
            </div>
          </div>
        );
        
      case 'card':
        return (
          <div className="text-left">
            <div className="flex items-center gap-4 mb-6">
              <div className={`${styles.iconBgClass} w-12 h-12 rounded-full flex items-center justify-center`}>
                <i className={`fas fa-${section.icon} text-white text-xl`}></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 text-left">{section.title}</h3>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${styles.issuesClass}`}>
                  {section.issues}
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {section.description.map((paragraph, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                </div>
              ))}
              
              {section.scoreDescription.map((paragraph, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-left">{paragraph}</p>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-200 rounded-full">
                  <div 
                    className={`h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                    style={{ width: section.scorePercent }}
                  ></div>
                </div>
                <span className="font-bold text-lg">{section.scorePercent}</span>
              </div>
              
              {section.actionText && (
                <a 
                  href="#" 
                  className={`inline-block text-white font-medium py-2 px-4 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleActionButtonClick({...section, id: sectionId});
                  }}
                >
                  {section.actionText}
                </a>
              )}
            </div>
          </div>
        );
        
      case 'banner':
        return (
          <div className="text-left">
            <div className={`${styles.containerClass} p-6 rounded-lg mb-6`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <i className={`fas fa-${section.icon} text-2xl`}></i>
                  <h3 className="text-xl font-bold text-left">{section.title}</h3>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-medium ${styles.issuesClass}`}>
                  {section.issues}
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {section.description.map((paragraph, idx) => (
                  <p key={idx} className="text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                ))}
              </div>
              
              <div className="text-left">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-bold text-gray-800 text-left">{section.scoreTitle}</h4>
                  <span className="text-2xl font-bold">{section.scorePercent}</span>
                </div>
                
                <div className="h-2 bg-gray-200 rounded-full mb-4">
                  <div 
                    className={`h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                    style={{ width: section.scorePercent }}
                  ></div>
                </div>
                
                <div className="space-y-3 mb-4">
                  {section.scoreDescription.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-600 text-left">{paragraph}</p>
                  ))}
                </div>
                
                {section.actionText && (
                  <a 
                    href="#" 
                    className={`inline-block text-white font-medium py-2 px-4 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleActionButtonClick({...section, id: sectionId});
                    }}
                  >
                    {section.actionText}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      
      case 'compact':
        return (
          <div className="flex flex-col md:flex-row gap-6 text-left">
            <div className={`${styles.iconBgClass} w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0`}>
              <i className={`fas fa-${section.icon} text-white text-2xl`}></i>
            </div>
            
            <div className="flex-grow text-left">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 text-left">{section.title}</h3>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${styles.issuesClass}`}>
                    {section.issues}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold block">{section.scorePercent}</span>
                  <span className="text-sm text-gray-500">{section.scoreTitle}</span>
                </div>
              </div>
              
              <div className="h-2 bg-gray-200 rounded-full mb-4 w-full">
                <div 
                  className={`h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                  style={{ width: section.scorePercent }}
                ></div>
              </div>
              
              <div className="space-y-2 mb-4">
                {section.description.map((paragraph, idx) => (
                  <p key={idx} className="text-gray-700 text-left text-sm" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                ))}
              </div>
              
              <hr className="my-3 border-gray-200" />
              
              <div className="flex justify-between items-center">
                <div className="space-y-1 text-left">
                  {section.scoreDescription.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-600 text-left text-sm">{paragraph}</p>
                  ))}
                </div>
                
                {section.actionText && (
                  <a 
                    href="#" 
                    className={`inline-block text-white font-medium py-2 px-4 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleActionButtonClick({...section, id: sectionId});
                    }}
                  >
                    {section.actionText}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
        
      case 'dashboard':
        return (
          <div className="text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 text-left">
                <i className={`fas fa-${section.icon} ${styles.iconBgClass} p-2 rounded-md text-white`}></i>
                {section.title}
              </h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${styles.issuesClass}`}>
                {section.issues}
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-5 shadow-sm col-span-2 text-left">
                <div className="mb-4">
                  {section.description.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-700 text-left mb-3" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                  ))}
                </div>
                
                {section.actionText && (
                  <div className="text-right">
                    <a 
                      href="#" 
                      className={`inline-block text-white font-medium py-2 px-4 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleActionButtonClick({...section, id: sectionId});
                      }}
                    >
                      {section.actionText}
                    </a>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm flex flex-col justify-between text-left">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center p-1 bg-gray-100 rounded-full w-24 h-24 mb-2">
                    <div className="inline-flex items-center justify-center rounded-full w-20 h-20 bg-gradient-to-b from-gray-50 to-white shadow-inner">
                      <span className="text-2xl font-bold">{section.scorePercent}</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 text-center">{section.scoreTitle}</h4>
                </div>
                
                <div className="space-y-2 text-left">
                  {section.scoreDescription.map((paragraph, idx) => (
                    <p key={idx} className="text-gray-600 text-sm text-left">{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'minimal':
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm text-left">
            <div className="flex items-center gap-3 mb-6">
              <div className={`${styles.iconBgClass} w-10 h-10 rounded-md flex items-center justify-center`}>
                <i className={`fas fa-${section.icon} text-white text-lg`}></i>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-800 text-left">{section.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                    <div 
                      className={`h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                      style={{ width: section.scorePercent }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{section.scorePercent}</span>
                </div>
              </div>
              <div className="ml-auto">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${styles.issuesClass}`}>
                  {section.issues}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 mb-6 pl-12 text-left">
              {section.description.map((paragraph, idx) => (
                <p key={idx} className="text-gray-700 text-left text-sm" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
              ))}
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h4 className="text-base font-bold text-gray-800 mb-3 text-left">{section.scoreTitle}</h4>
              <ul className="space-y-2 list-disc pl-5 mb-4 text-left">
                {section.scoreDescription.map((paragraph, idx) => (
                  <li key={idx} className="text-gray-600 text-sm text-left">{paragraph}</li>
                ))}
              </ul>
              
              {section.actionText && (
                <div className="text-right">
                  <a 
                    href="#" 
                    className={`inline-block text-white font-medium py-1.5 px-3 rounded transition text-xs ${styles.actionBtnClass}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleActionButtonClick({...section, id: sectionId});
                    }}
                  >
                    {section.actionText}
                  </a>
                </div>
              )}
            </div>
          </div>
        );
        
      case 'list':
        return (
          <div className="text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className={`${styles.iconBgClass} w-10 h-10 rounded-md flex items-center justify-center`}>
                <i className={`fas fa-${section.icon} text-white text-lg`}></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-left">{section.title}</h3>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{section.scorePercent}</span>
                  <div className="w-20 h-2 bg-gray-200 rounded-full">
                    <div 
                      className={`h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                      style={{ width: section.scorePercent }}
                    ></div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${styles.issuesClass}`}>
                  {section.issues}
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-4 text-left">
              {section.description.map((paragraph, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 border-b border-gray-100 text-left">
                  <i className="fas fa-info-circle text-gray-400 mt-1"></i>
                  <p className="text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                </div>
              ))}
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm mb-4 text-left">
              <h4 className="text-lg font-bold text-gray-800 mb-2 text-left">{section.scoreTitle}</h4>
              <div className="space-y-3 text-left">
                {section.scoreDescription.map((paragraph, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-left">
                    <i className="fas fa-exclamation-circle text-pink-500 mt-1"></i>
                    <p className="text-gray-600 text-left">{paragraph}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {section.actionText && (
              <div className="flex justify-end">
                <a 
                  href="#" 
                  className={`inline-block text-white font-medium py-2 px-4 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleActionButtonClick({...section, id: sectionId});
                  }}
                >
                  <i className="fas fa-arrow-right mr-2"></i> {section.actionText}
                </a>
              </div>
            )}
          </div>
        );
        
      default: // standard layout
        return (
          <div className="text-left">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`${styles.iconBgClass} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <i className={`fas fa-${section.icon} text-white text-xl`}></i>
                </div>
                <h3 className="text-xl font-bold text-gray-800 text-left">{section.title}</h3>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${styles.issuesClass}`}>
                {section.issues}
              </div>
            </div>
            
            <div className="space-y-4">
              {section.description.map((paragraph, idx) => (
                <p key={idx} className="text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: paragraph }}></p>
              ))}
              
              <div className="bg-white bg-opacity-70 rounded-lg p-6 mt-6 shadow-sm text-left">
                <div className="relative h-3 bg-gray-200 rounded-full mb-8">
                  <div 
                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${section.scoreColor} rounded-full`} 
                    style={{ width: section.scorePercent }}
                  ></div>
                  <div 
                    className="absolute -top-6 text-red-500" 
                    style={{ left: section.scorePercent, transform: 'translateX(-50%)' }}
                  >
                    <i className="fas fa-map-marker-alt text-xl"></i>
                  </div>
                </div>
                
                <div className="text-left">
                  <h4 className="text-2xl font-bold text-gray-800 mb-4 text-left">{section.scoreTitle}</h4>
                  <div className="space-y-3 mb-6">
                    {section.scoreDescription.map((paragraph, idx) => (
                      <p key={idx} className="text-gray-600 text-left">{paragraph}</p>
                    ))}
                  </div>
                  {section.actionText && (
                    <div className="text-left">
                      <a 
                        href="#" 
                        className={`inline-block text-white font-medium py-3 px-6 rounded-lg transition text-sm ${styles.actionBtnClass}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleActionButtonClick({...section, id: sectionId});
                        }}
                      >
                        {section.actionText}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-indigo-600 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Analyzing your resume...</h2>
          <p className="text-gray-500">This may take a moment as we thoroughly review your document.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-center">Error</h2>
          </div>
          <p className="text-gray-700 mb-6 text-center">{error}</p>
          <div className="flex justify-center">
            <button 
              onClick={() => navigate('/upload')} 
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Upload Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen overflow-auto">
      <div className="flex flex-col md:flex-row h-screen">
        {/* Left Sidebar/Navbar - Fixed position with max height */}
        <div className="md:w-80 bg-white shadow-lg h-screen overflow-auto sticky top-0">
          {/* Score Summary */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Score</h2>
            <div className={`text-4xl font-bold ${scoreColorClass} mb-1`}>
              {averageScore}/100
            </div>
            
          </div>

          {/* Navigation Categories - Scrollable */}
          <div className="p-4 overflow-auto">
            {Object.keys(groupedCategories).length > 0 ? (
              Object.keys(groupedCategories).map(category => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2 text-center">{category}</h3>
                <div className="space-y-2">
                  {groupedCategories[category].map(item => (
                    <div 
                      key={item.id}
                      className={`cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition-all ${activeSection === item.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                      onClick={() => handleCategoryClick(item.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-start gap-3">
                          <i className={`fas fa-${item.icon} ${item.iconColor} text-base mt-1`}></i>
                          <span className="text-gray-700 font-medium text-left">{item.title}</span>
                        </div>
                        <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${item.scoreClass}`}>
                          {item.score}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ))
            ) : (
              <div className="text-center p-4 text-gray-500">
                No categories available
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content Area - Scrollable with all sections displayed */}
        <div className="md:flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-8">
            {analysisData && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Resume Analysis</h2>
                <p className="text-gray-600 mb-4">File: {analysisData.filename}</p>
                <p className="text-gray-600">Uploaded: {new Date(analysisData.upload_date).toLocaleString()}</p>
              </div>
            )}
            
            {/* Display all sections at once with different layouts */}
            {Object.keys(sectionContent).length > 0 ? (
              Object.keys(sectionContent).map(sectionId => {
              const section = sectionContent[sectionId];
              const styles = getSectionStyles(section.design);
              
              return (
                <div 
                  key={sectionId} 
                  ref={el => sectionRefs.current[sectionId] = el} 
                  id={`section-${sectionId}`}
                  className={`rounded-xl shadow-lg p-6 ${styles.containerClass}`}
                >
                  {renderSectionContent(section, styles, sectionId)}
                </div>
              );
              })
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <p className="text-gray-600 mb-4">No analysis sections available.</p>
                <p className="text-gray-500">Check the console for API response details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Import SuggestionPopup from external file */}
      <SuggestionPopup 
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
        title={popupContent.title}
        aiSuggestion={popupContent.aiSuggestion}
      />
    </div>
  );
};

export default ResumeScoreAnalysis;