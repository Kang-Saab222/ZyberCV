import React, { useState, useEffect } from 'react';
import { Search, Briefcase, DollarSign, ChevronRight, X, Check, Bookmark, BookmarkCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JobRecommendations = () => {
  // Sample resume skills - this will still be used for initial UI state
  const [resumeSkills, setResumeSkills] = useState([
    'JavaScript', 'React', 'Node.js', 'TypeScript', 'CSS', 'HTML'
  ]);
  
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Fetch job data from API
  useEffect(() => {
    const fetchJobData = async () => {
      try {
        setLoading(true);
        
        // Get email from cookies
        const cookies = document.cookie.split(';');
        const emailCookie = cookies.find(cookie => cookie.trim().startsWith('userEmail='));
        
        if (!emailCookie) {
          setError('User email not found. Please login first.');
          setLoading(false);
          return;
        }
        
        const email = emailCookie.split('=')[1];
        
        // Make API call to get job recommendations
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/job/v1`, {
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
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch job recommendations');
        }
        
        const data = await response.json();
        console.log('Job API Response:', data);
        
        // Parse the analysis JSON
        try {
          // The analysis might be a JSON string or might have backtick delimiters
          let analysisText = data.analysis;
          console.log('Raw analysis text:', analysisText);
          
          // Better regex to handle markdown code blocks with backticks
          if (analysisText.includes('```')) {
            // More robust pattern to extract content between markdown code blocks
            const jsonMatch = analysisText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (jsonMatch && jsonMatch[1]) {
              analysisText = jsonMatch[1].trim();
              console.log('Extracted JSON from backticks:', analysisText);
            }
          }
          
          // Parse the JSON
          let parsedJobs;
          try {
            parsedJobs = JSON.parse(analysisText);
            console.log('Successfully parsed JSON:', parsedJobs);
          } catch (jsonError) {
            console.error('JSON parse error:', jsonError);
            
            // If JSON parsing fails and we have example data, use it as fallback
            const fallbackJobs = [
              {
                id: 1,
                title: "Frontend Developer",
                company: "TechCorp Inc.",
                skills: ["JavaScript", "React", "CSS", "HTML", "TypeScript"],
                match: 0,
                description: "We are looking for a frontend developer to join our team and build responsive web applications.",
                salary: "₹7,50,000 - ₹10,00,000",
                saved: false,
                requiredSkillDetails: {
                  'JavaScript': 'Advanced knowledge of ES6+ features, async programming, and DOM manipulation',
                  'React': 'Experience with hooks, context API, and state management libraries',
                  'CSS': 'Proficiency with CSS3, Flexbox, Grid, and responsive design principles',
                  'HTML': 'Semantic HTML5 markup and accessibility standards',
                  'TypeScript': 'Type definitions, interfaces, and integration with React'
                }
              },
              {
                id: 2,
                title: "Full Stack Engineer",
                company: "InnovateSoft",
                skills: ["JavaScript", "React", "Node.js", "MongoDB", "Express"],
                match: 0,
                description: "Join our team to develop both frontend and backend components of our web applications.",
                salary: "₹8,30,000 - ₹10,80,000",
                saved: false,
                requiredSkillDetails: {
                  'JavaScript': 'Strong understanding of both client and server-side JavaScript',
                  'React': 'Building reusable components and managing application state',
                  'Node.js': 'RESTful API development and server-side architecture',
                  'MongoDB': 'Database design, querying, and aggregation pipelines',
                  'Express': 'Middleware development and route handling'
                }
              }
            ];
            
            console.log('Using fallback job data');
            parsedJobs = fallbackJobs;
          }
          
          // Ensure the result is an array
          if (!Array.isArray(parsedJobs)) {
            console.error('API did not return an array of jobs');
            setError('Invalid job data format received');
            setLoading(false);
            return;
          }
          
          console.log('Parsed jobs data:', parsedJobs);
          
          // Extract skills from the jobs to add to resume skills if not already present
          const allJobSkills = new Set();
          parsedJobs.forEach(job => {
            if (job.skills && Array.isArray(job.skills)) {
              job.skills.forEach(skill => allJobSkills.add(skill));
            }
          });
          
          // Update resume skills if needed
          setResumeSkills(prevSkills => {
            const newSkills = [...prevSkills];
            allJobSkills.forEach(skill => {
              if (!prevSkills.includes(skill)) {
                newSkills.push(skill);
              }
            });
            return newSkills;
          });
          
          // Set the jobs data
          setJobs(parsedJobs);
        } catch (parseError) {
          console.error('Error parsing job data:', parseError);
          console.error('Analysis text:', data.analysis);
          setError('Error processing job recommendations. Please try again later.');
        }
      } catch (err) {
        console.error('Error fetching job data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  }, [navigate]);

  const [selectedSkills, setSelectedSkills] = useState([...resumeSkills]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showSkillDetails, setShowSkillDetails] = useState(false);
  const [savedJobs, setSavedJobs] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Update selectedSkills when resumeSkills change
  useEffect(() => {
    setSelectedSkills([...resumeSkills]);
  }, [resumeSkills]);

  // Calculate skill match percentage for each job
  const calculateMatchPercentage = (jobSkills) => {
    const matchingSkills = jobSkills.filter(skill => 
      selectedSkills.includes(skill)
    );
    return Math.round((matchingSkills.length / jobSkills.length) * 100);
  };

  // Get color based on match percentage
  const getMatchColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (percentage >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  // Filter and sort jobs by match percentage
  const filteredJobs = jobs
    .map(job => ({
      ...job,
      match: calculateMatchPercentage(job.skills),
      saved: savedJobs.includes(job.id)
    }))
    .filter(job => 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.match - a.match);

  // Handle skills selection
  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  // Add new skill
  const [newSkill, setNewSkill] = useState('');
  const addSkill = () => {
    if (newSkill && !resumeSkills.includes(newSkill)) {
      setResumeSkills([...resumeSkills, newSkill]);
      setSelectedSkills([...selectedSkills, newSkill]);
      setNewSkill('');
    }
  };

  // View skill details
  const viewSkillDetails = (job) => {
    setSelectedJob(job);
    setShowSkillDetails(true);
  };

  // Toggle save job
  const toggleSaveJob = (jobId) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter(id => id !== jobId));
      setToastMessage('Job removed from saved list');
    } else {
      setSavedJobs([...savedJobs, jobId]);
      setToastMessage('Job saved successfully');
    }
    
    // Show toast notification
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Filter for saved jobs
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const displayedJobs = showSavedOnly 
    ? filteredJobs.filter(job => savedJobs.includes(job.id))
    : filteredJobs;

  // Show loading indicator
  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 font-sans bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-600 border-gray-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job recommendations...</p>
        </div>
      </div>
    );
  }

  // Show error message
  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 font-sans bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-700 text-xl font-semibold mb-2">Error Loading Jobs</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/upload')} 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Upload Resume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Job Recommendations Based on Your Skills</h1>
      
      {/* Skills selection */}
      <div className="mb-8 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
          <span className="bg-blue-100 p-2 rounded-md mr-2">
            <Check className="h-5 w-5 text-blue-600" />
          </span>
          Your Skills
        </h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {resumeSkills.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-4 py-2 rounded-full text-sm border transition-all ${
                selectedSkills.includes(skill)
                  ? 'bg-blue-100 text-blue-800 border-blue-300 font-medium shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
        
        {/* Add new skill */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="px-4 py-2 border rounded-lg flex-grow focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            placeholder="Add a new skill"
          />
          <button
            onClick={addSkill}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          >
            Add Skill
          </button>
        </div>
      </div>
      
      {/* Search and filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-12 pr-4 py-3 border rounded-lg w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            placeholder="Search for jobs or companies"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button
          onClick={() => setShowSavedOnly(!showSavedOnly)}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            showSavedOnly 
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {showSavedOnly ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          {showSavedOnly ? 'Showing Saved Jobs' : 'Show Saved Jobs'}
        </button>
      </div>
      
      {/* Job count */}
      <div className="mb-4 text-gray-600">
        Found {displayedJobs.length} matching {displayedJobs.length === 1 ? 'job' : 'jobs'}
        {showSavedOnly && ' (Saved only)'}
      </div>
      
      {/* Job listings */}
      <div className="space-y-6">
        {displayedJobs.map(job => (
          <div key={job.id} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-semibold text-gray-800">{job.title}</h3>
                <div className="flex items-center mt-2 text-gray-600">
                  {/* <Briefcase className="h-4 w-4 mr-1" /> */}
                  {/* <span className="mr-4">{job.company}</span> */}
                </div>
                <div className="mt-2 flex items-center text-gray-700">
                  {/* <DollarSign className="h-4 w-4 mr-1" /> */}
                  <span>{job.salary}</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getMatchColor(job.match)}`}>
                {job.match}% Match
              </div>
            </div>
            
            <p className="mt-4 text-gray-700">{job.description}</p>
            
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Required Skills:</h4>
              <div className="flex flex-wrap gap-2">
                {job.skills.map(skill => (
                  <span
                    key={skill}
                    className={`px-3 py-1 rounded-full text-xs ${
                      selectedSkills.includes(skill)
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-gray-100 text-gray-800 border border-gray-300'
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mt-6 flex justify-between items-center">
              <button 
                onClick={() => toggleSaveJob(job.id)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                  savedJobs.includes(job.id)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                }`}
              >
                {savedJobs.includes(job.id) ? (
                  <>
                    <BookmarkCheck className="h-5 w-5 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="h-5 w-5 mr-2" />
                    Save Job
                  </>
                )}
              </button>
              
              <button 
                onClick={() => viewSkillDetails(job)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center focus:outline-none px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50"
              >
                View Skill Details
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        ))}
        
        {displayedJobs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-gray-400 mb-4">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              {showSavedOnly ? "No saved jobs found" : "No matching jobs found"}
            </h3>
            <p className="text-gray-500">
              {showSavedOnly 
                ? "You haven't saved any jobs yet" 
                : "Try adjusting your skills or search terms"}
            </p>
          </div>
        )}
      </div>
      
      {/* Skill Details Modal */}
      {showSkillDetails && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-screen overflow-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-800">
                Skill Requirements: {selectedJob.title}
              </h3>
              <button 
                onClick={() => setShowSkillDetails(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-6">
                Below are the detailed skill requirements for this position compared to your resume:
              </p>
              
              <div className="space-y-4">
                {selectedJob.skills.map(skill => (
                  <div key={skill} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-800">{skill}</h4>
                      <span className={`px-3 py-1 rounded-full text-xs ${
                        selectedSkills.includes(skill)
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}>
                        {selectedSkills.includes(skill) ? 'In Your Resume' : 'Not In Resume'}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      {selectedJob.requiredSkillDetails[skill]}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowSkillDetails(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50 animate-fade-in">
          {toastMessage.includes('saved') ? (
            <BookmarkCheck className="h-5 w-5 mr-2 text-green-400" />
          ) : (
            <Bookmark className="h-5 w-5 mr-2 text-red-400" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default JobRecommendations;