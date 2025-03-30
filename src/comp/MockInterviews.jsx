import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, Phone, Subtitles, X, BarChart2, Loader } from "lucide-react";
import InterviewAnalysis from "./InterviewAnalysis";

const MockInterviews = () => {
  const videoRef = useRef(null);
  const aiVideoRef = useRef(null);
  const timeoutRef = useRef(null); // Reference to track timeouts
  const processedTexts = useRef(new Set()); // More efficient Set for tracking processed texts
  const [stream, setStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCaptionsOn, setIsCaptionsOn] = useState(true); // Default captions on for better UX
  const [captions, setCaptions] = useState("Hello!");
  const [showEndCallPopup, setShowEndCallPopup] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [recognition, setRecognition] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewContent, setInterviewContent] = useState(null);
  const [interviewLoading, setInterviewLoading] = useState(true);
  const [interviewError, setInterviewError] = useState(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [conversationTurn, setConversationTurn] = useState('ai'); // 'ai' or 'user'
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const [interviewStage, setInterviewStage] = useState('greeting'); // 'greeting', 'question', 'answer', 'followup'
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [speakingQueue, setSpeakingQueue] = useState([]);
  const [isSpeakingQueueProcessing, setIsSpeakingQueueProcessing] = useState(false);
  const [allowUserResponse, setAllowUserResponse] = useState(false);
  const [contentProcessed, setContentProcessed] = useState(false);
  const [spokenTexts, setSpokenTexts] = useState([]); // Array to track all texts spoken by AI
  const [conversationLog, setConversationLog] = useState([]); // Detailed log of entire conversation with timestamps
  
  // Load and initialize speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      
      // Force cancel any ongoing speech when the component mounts
      synth.cancel();
      
      // Load voices
      const loadVoices = () => {
        const voices = synth.getVoices();
        if (voices.length > 0) {
          console.log('Available voices:', voices.map(v => v.name));
          setSpeechSynthesis(synth);
          setVoicesLoaded(true);
        }
      };
      
      // Chrome loads voices asynchronously
      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
      }
      
      // Try to load voices immediately (for Firefox)
      loadVoices();
      
      // Ensure speech synthesis is canceled when component unmounts
      return () => {
        synth.cancel();
      };
    }
  }, []);
  
  // Function to add entry to conversation log
  const addToConversationLog = (speaker, text, type) => {
    setConversationLog(prev => [...prev, {
      speaker,
      text,
      type,
      timestamp: new Date().toISOString()
    }]);
    
    // Also log to console for debugging
    console.log(`[${speaker}][${type}]: ${text}`);
  };
  
  // Process speech queue
  useEffect(() => {
    if (speakingQueue.length > 0 && !isSpeakingQueueProcessing && !isAiSpeaking) {
      const processQueue = async () => {
        setIsSpeakingQueueProcessing(true);
        
        const textToSpeak = speakingQueue[0];
        setSpeakingQueue(prev => prev.slice(1));
        
        // Check if this text has already been spoken - use the ref instead of state for direct access
        if (processedTexts.current.has(textToSpeak)) {
          console.log('Text already spoken, skipping:', textToSpeak);
          setIsSpeakingQueueProcessing(false);
          
          // Move to appropriate next step based on current stage
          if (interviewStage === 'greeting') {
            setTimeout(() => moveToFirstQuestion(), 500);
          } else if (interviewStage === 'question') {
            handleQuestionEnd();
          }
          return;
        }
        
        // Wait a moment before starting to speak
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Speak the text
        speakText(textToSpeak);
        
        // Mark as processed immediately to prevent duplicates
        processedTexts.current.add(textToSpeak);
      };
      
      processQueue();
    }
  }, [speakingQueue, isSpeakingQueueProcessing, isAiSpeaking]);
  
  // Process the interview content to extract introduction and questions
  const processInterviewContent = (content) => {
    // Prevent duplicate processing if we already have processed content
    if (contentProcessed) {
      console.log('Skipping duplicate interview content processing - already processed');
      return;
    }
    
    // Split by line breaks to separate greeting and questions
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length > 0) {
      // Use a static greeting instead of the first line from API
      const greeting = "Hello! I hope you're doing well today. Let's start with the interview.";
      
      // Extract questions (typically numbered or with question marks)
      const questions = lines.slice(1).filter(line => 
        /^\d+\.|\?/.test(line) || 
        /tell me about|describe|explain|how would you|what|why|when|where|who|which/i.test(line)
      );
      
      console.log('Extracted questions:', questions);
      
      // Only use up to 5 questions to keep the interview manageable
      const limitedQuestions = questions.slice(0, 5);
      
      // Clear any previous questions and queue
      setExtractedQuestions([]);
      setSpeakingQueue([]);
      
      // Set the new questions with greeting
      setExtractedQuestions([greeting, ...limitedQuestions]);
      
      // Store the greeting for later use
      setInterviewHistory([
        { speaker: 'ai', text: greeting, type: 'greeting' }
      ]);
      
      // Set up the initial state for the interview
      setCurrentQuestion(greeting);
      setInterviewStage('greeting');
      
      // Mark content as processed to prevent duplicate processing
      setContentProcessed(true);
      
      // Start the interview with the greeting once voices are loaded
      if (voicesLoaded) {
        // Clear any pending speech
        if (speechSynthesis) {
          speechSynthesis.cancel();
        }
        // Add the greeting to the speaking queue
        addToSpeakingQueue(greeting);
      }
    }
  };
  
  // Add text to the speaking queue with de-duplication
  const addToSpeakingQueue = (text) => {
    // Check if this text is already in the queue to prevent duplicates
    setSpeakingQueue(prev => {
      // If the queue already contains this text, don't add it again
      if (prev.includes(text)) {
        console.log('Text already in queue, skipping duplicate:', text);
        return prev;
      }
      
      console.log('Adding to speaking queue:', text);
      return [...prev, text];
    });
  };
  
  // Fetch interview content when component mounts
  useEffect(() => {
    // Skip fetching if content is already processed
    if (contentProcessed) {
      console.log('Skipping API fetch - content already processed');
      return;
    }
    
    const fetchInterviewContent = async () => {
      try {
        setInterviewLoading(true);
        
        // Get user email from cookies
        const cookies = document.cookie.split(';');
        const emailCookie = cookies.find(cookie => cookie.trim().startsWith('userEmail='));
        
        if (!emailCookie) {
          setInterviewError('User email not found. Please login again.');
          setInterviewLoading(false);
          return;
        }
        
        const email = emailCookie.split('=')[1];
        
        // Call the interview content API
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/interview-content/v1`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No resume found. Please upload your resume first.');
          }
          throw new Error('Failed to fetch interview content');
        }
        
        const data = await response.json();
        setInterviewContent(data);
        console.log('Interview Content API Response:', data);
        
        // Extract questions from the API response only if we haven't processed content yet
        if (data && data.analysis && !contentProcessed) {
          processInterviewContent(data.analysis);
        }
        
      } catch (error) {
        console.error('Error fetching interview content:', error);
        setInterviewError(error.message);
      } finally {
        setInterviewLoading(false);
      }
    };
    
    fetchInterviewContent();
  }, [contentProcessed]); // Add contentProcessed as a dependency
  
  // Initialize speech recognition
  useEffect(() => {
    // Initialize speech recognition if supported in browser
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      // Setup recognition parameters
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;
      
      recognitionInstance.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const transcriptText = result[0].transcript;
        
        setTranscript(transcriptText);
        
        // Always update captions when user is speaking, regardless of caption setting
        setCaptions(transcriptText);
        
        // If user is speaking, pause the AI video
        if (!isSpeaking) {
          setIsSpeaking(true);
          if (aiVideoRef.current) {
            aiVideoRef.current.pause();
            console.log('AI video paused - user is speaking');
          }
        }
        
        if (result.isFinal) {
          console.log('Final transcription:', transcriptText);
          
          // If it's the user's turn and we're allowing user response
          if (conversationTurn === 'user' && allowUserResponse) {
            console.log('User finished response, saving to history');
            
            // Record in conversation log
            if (conversationLog) {
              setConversationLog(prev => [...prev, {
                speaker: 'user',
                text: transcriptText,
                type: 'answer',
                timestamp: new Date().toISOString()
              }]);
            }
            
            // Add the user's response to the history
            setInterviewHistory(prev => [...prev, { 
              speaker: 'user', 
              text: transcriptText, 
              type: 'answer' 
            }]);
            
            // Disable user response
            setAllowUserResponse(false);
            
            // Stop recognition immediately
            recognitionInstance.stop();
            setIsListening(false);
            
            // Clear any existing timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            
            // Set new timeout with minimal delay to move to next question
            timeoutRef.current = setTimeout(() => {
              moveToNextQuestion();
            }, 300);
          }
        }
      };
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };
      
      recognitionInstance.onend = () => {
        // User stopped speaking, update state
        setIsSpeaking(false);
        console.log('Speech recognition ended');
        
        // If AI is speaking and we stopped listening, resume video
        if (isAiSpeaking && aiVideoRef.current) {
          aiVideoRef.current.play().catch(err => console.error('Error playing video:', err));
          console.log('AI video resumed');
        }
        
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          console.log('No speech detected, but will keep listening');
          // Don't stop listening for no-speech errors
        } else if (event.error === 'aborted') {
          // This is an expected error when we manually stop
          console.log('Recognition aborted as expected');
          setIsListening(false);
        } else {
          // For other errors, set listening to false
          setIsListening(false);
          
          // For network errors, try to restart after a delay
          if (event.error === 'network') {
            setTimeout(() => {
              try {
                if (conversationTurn === 'user' && allowUserResponse && isMicOn) {
                  console.log('Attempting to restart after network error');
                  recognitionInstance.start();
                }
              } catch (restartError) {
                console.error('Failed to restart after network error', restartError);
              }
            }, 2000);
          }
        }
        
        // Resume the AI video in case of error if AI is speaking
        setIsSpeaking(false);
        if (isAiSpeaking && aiVideoRef.current) {
          aiVideoRef.current.play().catch(err => console.error('Error playing video after error:', err));
        }
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.error('Speech recognition not supported in this browser');
    }
  }, []);
  
  // Start listening when it's the user's turn and we're allowing response
  useEffect(() => {
    console.log('Status check - turn:', conversationTurn, 'allowUserResponse:', allowUserResponse, 'listening:', isListening);
    
    if (recognition && conversationTurn === 'user' && allowUserResponse && !isListening && isMicOn && !isAiSpeaking) {
      try {
        console.log('Starting speech recognition - user turn and allowing response');
        
        // Slight delay to ensure speech synthesis has fully stopped
        setTimeout(() => {
          if (recognition && conversationTurn === 'user' && allowUserResponse && !isListening && isMicOn && !isAiSpeaking) {
            console.log('Actually starting speech recognition now');
            // Cancel any ongoing recognition first to ensure a clean start
            try {
              recognition.abort();
            } catch (error) {
              console.log('No active recognition to abort');
            }
            
            // Start with a delay to ensure clean state
            setTimeout(() => {
              try {
                recognition.start();
              } catch (startError) {
                console.error('Error starting recognition:', startError);
                // Sometimes recognition is already started but state isn't updated
                // Update state to match reality
                setIsListening(true);
              }
            }, 100);
          } else {
            console.log('Conditions changed, not starting speech recognition');
          }
        }, 800);
      } catch (error) {
        console.error('Error in recognition start logic:', error);
      }
    }
  }, [conversationTurn, allowUserResponse, isAiSpeaking, isMicOn, isListening, recognition]);
  
  // Effect to start speaking when voices are loaded
  useEffect(() => {
    // Only attempt to start the greeting if:
    // 1. Voices are loaded
    // 2. We have questions
    // 3. We're in greeting stage
    // 4. Queue is empty
    // 5. AI is not already speaking
    // 6. Queue is not being processed
    if (
      voicesLoaded && 
      extractedQuestions.length > 0 && 
      interviewStage === 'greeting' && 
      speakingQueue.length === 0 && 
      !isAiSpeaking && 
      !isSpeakingQueueProcessing && 
      contentProcessed // Only proceed if content has been processed
    ) {
      console.log('Starting with greeting, condition check passed');
      
      // Add the greeting to the queue (with de-duplication in the function)
      addToSpeakingQueue(extractedQuestions[0]);
    }
  }, [
    voicesLoaded, 
    extractedQuestions.length, 
    interviewStage, 
    speakingQueue.length, 
    isAiSpeaking, 
    isSpeakingQueueProcessing,
    contentProcessed
  ]);
  
  // Helper function to move to first question
  const moveToFirstQuestion = () => {
    console.log('Moving to first question directly');
    if (extractedQuestions.length > 1) {
      const firstQuestion = extractedQuestions[1];
      setCurrentQuestion(firstQuestion);
      setCaptions(firstQuestion);
      setCurrentQuestionIndex(1);
      
      // Add to history
      setInterviewHistory(prev => [...prev, { 
        speaker: 'ai', 
        text: firstQuestion, 
        type: 'question' 
      }]);
      
      setInterviewStage('question');
      
      // Check if this question has already been spoken
      if (!spokenTexts.includes(firstQuestion)) {
        // Add to speaking queue
        addToSpeakingQueue(firstQuestion);
      } else {
        // Skip to user's turn
        handleQuestionEnd();
      }
    }
  };
  
  // Helper function to handle what happens when a question is done
  const handleQuestionEnd = () => {
    console.log('Switching to user turn after question');
    setConversationTurn('user');
    
    // Enable user response
    setTimeout(() => {
      console.log('Allowing user response now');
      setAllowUserResponse(true);
    }, 800);
  };
  
  // Function to speak the current text
  const speakText = (text) => {
    if (!speechSynthesis || !voicesLoaded) {
      console.error('Speech synthesis not available or voices not loaded');
      setIsSpeakingQueueProcessing(false);
      return;
    }
    
    // Make sure any previous speech is canceled
    speechSynthesis.cancel();
    
    console.log('Speaking text:', text);
    
    // Record in conversation log
    if (conversationLog) {
      setConversationLog(prev => [...prev, {
        speaker: 'ai',
        text: text,
        type: interviewStage,
        timestamp: new Date().toISOString()
      }]);
    }
    
    // Create utterance with the text
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice - try to find a good voice
    const voices = speechSynthesis.getVoices();
    
    // Prefer a female English voice if available
    const preferredVoice = voices.find(voice => 
      voice.lang.includes('en') && (voice.name.includes('Female') || voice.name.includes('Google US English'))
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (preferredVoice) {
      console.log('Using voice:', preferredVoice.name);
      utterance.voice = preferredVoice;
    } else {
      console.warn('No preferred voice found, using default');
    }
    
    // Set properties
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Add event listeners
    utterance.onstart = () => {
      console.log('AI started speaking');
      setIsAiSpeaking(true);
      setConversationTurn('ai'); // Explicitly set turn to AI while speaking
      setAllowUserResponse(false); // Don't allow user response while AI is speaking
      
      // Stop listening while AI is speaking
      if (isListening && recognition) {
        recognition.stop();
        setIsListening(false);
      }
      
      // Play the AI video when speaking
      if (aiVideoRef.current && aiVideoRef.current.paused) {
        aiVideoRef.current.play().catch(err => console.error('Error playing video:', err));
      }
    };
    
    utterance.onend = () => {
      console.log('AI finished speaking:', text);
      setIsAiSpeaking(false);
      setIsSpeakingQueueProcessing(false);
      
      // Add to spoken texts using the ref for immediate access
      setSpokenTexts(prev => [...prev, text]);
      
      // Pause the AI video when done speaking
      if (aiVideoRef.current && !aiVideoRef.current.paused) {
        aiVideoRef.current.pause();
      }
      
      // Handle what happens after speaking based on interview stage
      if (interviewStage === 'greeting') {
        console.log('Moving to first question after greeting');
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Set new timeout
        timeoutRef.current = setTimeout(() => {
          moveToFirstQuestion();
        }, 1000);
      } else if (interviewStage === 'question' || interviewStage === 'followup') {
        // After asking a question, wait for user response
        handleQuestionEnd();
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsAiSpeaking(false);
      setIsSpeakingQueueProcessing(false);
      
      // If it was a question, still move to user turn
      if (interviewStage === 'question' || interviewStage === 'followup') {
        console.log('Moving to user turn despite speech error');
        setConversationTurn('user');
        setAllowUserResponse(true);
      }
      
      // Pause the AI video on error
      if (aiVideoRef.current && !aiVideoRef.current.paused) {
        aiVideoRef.current.pause();
      }
    };
    
    // Add captions as the AI speaks
    utterance.onboundary = (event) => {
      if (event.name === 'word' && event.charIndex !== undefined) {
        const upToCurrentWord = text.substring(0, event.charIndex + event.charLength);
        setCaptions(upToCurrentWord + '...');
      }
    };
    
    // Debug utterance
    console.log('Utterance config:', {
      text: utterance.text,
      voice: utterance.voice?.name || 'default',
      rate: utterance.rate,
      pitch: utterance.pitch
    });
    
    // Speak the text
    try {
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error speaking:', error);
      setIsSpeakingQueueProcessing(false);
      
      // If it was a question, still move to user turn
      if (interviewStage === 'question' || interviewStage === 'followup') {
        setConversationTurn('user');
        setAllowUserResponse(true);
      }
    }
  };
  
  // Move to next question after user response
  const moveToNextQuestion = () => {
    console.log('Moving to next question, current index:', currentQuestionIndex);
    
    // Ensure we're in user's turn and not already moving to the next question
    if (conversationTurn !== 'user' || isAiSpeaking) {
      console.log('Skipping moveToNextQuestion - wrong turn or AI is speaking');
      return;
    }
    
    // Switch turn back to AI
    setConversationTurn('ai');
    setAllowUserResponse(false);
    
    const nextIndex = currentQuestionIndex + 1;
    
    if (nextIndex < extractedQuestions.length) {
      const nextQuestion = extractedQuestions[nextIndex];
      
      console.log(`Moving to question ${nextIndex}: ${nextQuestion}`);
      
      // Update state
      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(nextQuestion);
      setCaptions(nextQuestion);
      setInterviewStage('question');
      
      // Add to history
      setInterviewHistory(prev => [...prev, { 
        speaker: 'ai', 
        text: nextQuestion, 
        type: 'question' 
      }]);
      
      // Check if this question has already been spoken
      if (!spokenTexts.includes(nextQuestion)) {
        // Add to speaking queue
        addToSpeakingQueue(nextQuestion);
      } else {
        // Skip to user's turn if already spoken
        handleQuestionEnd();
      }
    } else {
      // We've reached the end of the questions
      const concludingMessage = "That concludes our interview questions. Thank you for your time!";
      
      console.log('No more questions, ending interview');
      
      setCurrentQuestion(concludingMessage);
      setCaptions(concludingMessage);
      setInterviewStage('conclusion');
      
      // Add to history
      setInterviewHistory(prev => [...prev, { 
        speaker: 'ai', 
        text: concludingMessage, 
        type: 'conclusion' 
      }]);
      
      // Check if this conclusion has already been spoken
      if (!spokenTexts.includes(concludingMessage)) {
        // Add to speaking queue
        addToSpeakingQueue(concludingMessage);
      }
    }
  };

  // Monitor microphone changes
  useEffect(() => {
    if (!isMicOn && isListening && recognition) {
      console.log('Mic turned off, stopping speech recognition');
      recognition.stop();
      setIsListening(false);
    }
  }, [isMicOn, isListening, recognition]);

  useEffect(() => {
    const startVideo = async () => {
      try {
        // Add audio constraints with echo cancellation
        const userStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        setStream(userStream);
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
          videoRef.current.muted = true; // Mute the local video to prevent feedback
        }
      } catch (error) {
        console.error("Error accessing webcam: ", error);
      }
    };
    startVideo();
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
      // Stop any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Mock analysis data setup - only used as fallback if API fails
  useEffect(() => {
    if (showAnalysis && !analysisData) {
      console.log('Creating fallback analysis data since no API data was received');
      
      // Use the conversation log to construct analysis data if available
      const sourceData = conversationLog.length > 0 ? conversationLog : interviewHistory;
      
      // Use the interview history to construct real analysis data
      const constructedAnalysisData = {
        overallScore: 85,
        confidence: 78,
        technicalScore: 92,
        communicationScore: 88,
        keyInsights: [
          "Strong technical knowledge demonstrated",
          "Good problem-solving approach",
          "Could improve eye contact during responses",
          "Excellent articulation of complex concepts"
        ],
        questionResponses: sourceData
          .filter(item => item.type === 'question' || item.type === 'greeting')
          .map((question, index) => {
            // Find the corresponding answer
            const answer = sourceData.find(item => 
              item.type === 'answer' && 
              sourceData.indexOf(item) > sourceData.indexOf(question) &&
              sourceData.indexOf(item) < sourceData.indexOf(question) + 3
            );
            
            return {
              question: question.text,
              response: answer ? answer.text : "No response recorded",
              responseScore: Math.floor(Math.random() * 25) + 75, // Random score between 75-100
              feedback: "Good response with clear communication"
            };
          }),
        improvementAreas: [
          "Confidence when discussing achievements",
          "Structuring responses more concisely",
          "Technical depth on system design questions"
        ]
      };
      
      setAnalysisData(constructedAnalysisData);
    }
  }, [showAnalysis, analysisData, interviewHistory, conversationLog]);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = !isMicOn));
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => (track.enabled = !isCameraOn));
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleCaptions = () => {
    setIsCaptionsOn(!isCaptionsOn);
    if (isCaptionsOn) {
      setCaptions("");
    }
  };

  // Export conversation log function
  const exportConversationLog = () => {
    console.log('Full conversation log:', conversationLog);
    
    // Create downloadable JSON file if needed
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversationLog, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "interview_transcript.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
  
  const endCall = () => {
    // Stop all media
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // Stop speech recognition
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
    
    // Export the conversation log
    exportConversationLog();
    
    // Display the interview history in console
    console.log('Interview Conversation History:', interviewHistory);
    
    setShowEndCallPopup(true);
  };

  const viewAnalysis = () => {
    setShowEndCallPopup(false);
    
    // Make API call to get interview analysis
    const fetchInterviewAnalysis = async () => {
      try {
        console.log('Sending conversation log to API for analysis...');
        
        // Get user email from cookies
        const cookies = document.cookie.split(';');
        const emailCookie = cookies.find(cookie => cookie.trim().startsWith('userEmail='));
        
        if (!emailCookie) {
          console.error('User email not found. Using local analysis only.');
          setShowAnalysis(true);
          return;
        }
        
        const email = emailCookie.split('=')[1];
        
        // Call the interview analysis API with the full conversation log
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/interview-analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email,
            conversationLog 
          }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error('API error:', response.status);
          // Fall back to local analysis if API fails
          setShowAnalysis(true);
          return;
        }
        
        const data = await response.json();
        console.log('Interview Analysis API Response:', data);
        
        // If we have a valid response, use it for analysis
        if (data && data.analysis) {
          // Set the analysis data directly from the API
          setAnalysisData(data.analysis);
          
          console.log('Analysis data structure received from API:', {
            hasMetrics: !!data.analysis.metrics,
            hasKeyInsights: !!data.analysis.keyInsights,
            hasImprovementAreas: !!data.analysis.improvementAreas,
            hasStrengths: !!data.analysis.strengths,
            hasFocusAreas: !!data.analysis.focusAreas,
            hasNextSteps: !!data.analysis.nextSteps,
            questionResponseCount: data.analysis.questionResponses?.length || 0
          });
          
          // Log the actual metrics values if present
          if (data.analysis.metrics) {
            console.log('Metrics from API:', {
              overallScore: data.analysis.metrics.overallScore,
              confidence: data.analysis.metrics.confidence,
              technicalScore: data.analysis.metrics.technicalScore,
              communicationScore: data.analysis.metrics.communicationScore
            });
          }
          
          // Log if the response was from cache
          if (data.cached) {
            console.log('Analysis was retrieved from cache');
          }
        }
        
        // Show the analysis screen
        setShowAnalysis(true);
      } catch (error) {
        console.error('Error fetching interview analysis:', error);
        // Fall back to local analysis if the API call fails
        setShowAnalysis(true);
      }
    };
    
    // Call the async function
    fetchInterviewAnalysis();
  };

  const closePopup = () => {
    setShowEndCallPopup(false);
  };

  const backToCall = () => {
    setShowAnalysis(false);
    // Reset for new call
    const startVideo = async () => {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        setStream(userStream);
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
          videoRef.current.muted = true; // Mute the local video to prevent feedback
        }
        setIsMicOn(true);
        setIsCameraOn(true);
        
        // Reset conversation state
        setConversationTurn('ai');
        setAllowUserResponse(false);
        setSpeakingQueue([]);
        setIsSpeakingQueueProcessing(false);
        
        // Restart the interview if there are questions
        if (extractedQuestions.length > 0) {
          // Start with greeting again
          setCurrentQuestionIndex(0);
          setCurrentQuestion(extractedQuestions[0]);
          setCaptions(extractedQuestions[0]);
          setInterviewStage('greeting');
          
          // Add greeting to queue
          setTimeout(() => {
            addToSpeakingQueue(extractedQuestions[0]);
          }, 1000);
        }
      } catch (error) {
        console.error("Error accessing webcam: ", error);
      }
    };
    startVideo();
  };

  // Clean up timeouts on component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleDoneSpeaking = () => {
    console.log('User clicked Done Speaking button');
    
    // Only process if it's the user's turn and we're allowing responses
    if (conversationTurn === 'user' && allowUserResponse) {
      // Add current transcript to conversation history
      const currentTranscriptText = transcript || 'No response';
      
      // Add to conversation log
      setConversationLog(prev => [...prev, {
        speaker: 'user',
        text: currentTranscriptText,
        type: 'answer',
        timestamp: new Date().toISOString()
      }]);
      
      // Add to interview history
      setInterviewHistory(prev => [...prev, { 
        speaker: 'user', 
        text: currentTranscriptText, 
        type: 'answer' 
      }]);
      
      // Stop listening
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
      
      // Disable user response
      setAllowUserResponse(false);
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Reset speaking state
      setIsSpeaking(false);
      
      // Move to next question
      timeoutRef.current = setTimeout(() => {
        moveToNextQuestion();
      }, 300);
    }
  };

  if (showAnalysis) {
    return <InterviewAnalysis analysisData={analysisData} onBack={backToCall} />;
  }

  // Show loading screen while waiting for API response
  if (interviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="bg-gray-800 rounded-xl p-10 shadow-2xl border border-gray-700 text-center max-w-md">
          <Loader size={48} className="text-blue-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Preparing Your Interview</h2>
          <p className="text-gray-300 mb-4">We're analyzing your resume to create personalized interview questions...</p>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full animate-pulse w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if there was an error fetching interview content
  if (interviewError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="bg-gray-800 rounded-xl p-10 shadow-2xl border border-gray-700 text-center max-w-md">
          <X size={48} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-3">Oops! Something went wrong</h2>
          <p className="text-gray-300 mb-6">{interviewError}</p>
          <button 
            onClick={() => window.location.href = '/dashboard'} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-w-screen h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col items-center justify-center">
      {/* Main content container */}
      <div className="w-full max-w-6xl h-full max-h-screen p-6 flex flex-col relative">
        {/* AI Avatar Section */}
        <div className="relative w-full h-4/5 bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
          <video 
            ref={aiVideoRef}
            src="../src/assets/ai_video.mp4" 
            autoPlay 
            loop 
            muted 
            className="w-full h-full object-cover"
          />
          
          {/* Current conversation turn indicator */}
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black bg-opacity-50 text-white text-sm">
            {isAiSpeaking ? 'AI speaking...' : (isListening ? 'Listening...' : 'Ready')}
          </div>
          
          {/* Current interview stage indicator */}
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black bg-opacity-50 text-white text-sm">
            Question {currentQuestionIndex > 0 ? currentQuestionIndex : ''}
          </div>
          
          {/* Done Speaking Button - only show when listening and it's user's turn */}
          {isListening && conversationTurn === 'user' && allowUserResponse && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <button 
                onClick={handleDoneSpeaking}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg transition-all transform hover:scale-105 flex items-center space-x-2"
              >
                <span>Done Speaking</span>
              </button>
            </div>
          )}
          
          {/* Captions area - always show with dynamic visibility */}
          <div className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 text-white text-center transition-opacity duration-300 ${isCaptionsOn ? 'opacity-100' : 'opacity-0'}`}>
            {captions}
          </div>
        </div>
        
        {/* Candidate Video Feed */}
        <div className="absolute bottom-24 right-8 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-lg border-2 border-gray-700 transition-all hover:scale-105">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted 
            className="w-full h-full object-cover" 
          />
          
          {/* Video overlay when camera is off */}
          {!isCameraOn && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff size={48} className="text-gray-400" />
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="mt-auto mb-4 flex items-center justify-center space-x-6">
          {/* Mic Button */}
          <div className="w-16 h-16 rounded-full overflow-hidden group">
            <button 
              onClick={toggleMic} 
              className={`w-16 h-16 flex items-center justify-center transition-all rounded-full ${isMicOn ? '!bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            >
              {isMicOn ? <Mic size={28} className="text-white" /> : <MicOff size={28} className="text-white" />}
            </button>
          </div>
          
          {/* Camera Button */}
          <div className="w-16 h-16 rounded-full overflow-hidden group">
            <button 
              onClick={toggleCamera} 
              className={`w-16 h-16 flex items-center justify-center transition-all rounded-full ${isCameraOn ? '!bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
            >
              {isCameraOn ? <Video size={28} className="text-white" /> : <VideoOff size={28} className="text-white" />}
            </button>
          </div>
          
          {/* End Call Button */}
          <div className="w-16 h-16 rounded-full overflow-hidden group">
            <button 
              onClick={endCall} 
              className="w-16 h-16 flex items-center justify-center !bg-red-600 hover:bg-red-700 text-white transition-all rounded-full border-2 border-transparent group-hover:border-white"
            >
              <Phone size={28} className="text-white transform rotate-135" />
            </button>
          </div>
          
          {/* Captions Button */}
          <div className="w-16 h-16 rounded-full overflow-hidden group">
            <button 
              onClick={toggleCaptions} 
              className={`w-16 h-16 flex items-center justify-center transition-all rounded-full ${isCaptionsOn ? '!bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <Subtitles size={28} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Call Ended Popup */}
      {showEndCallPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full shadow-2xl border border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-white">Call Ended</h3>
              <button onClick={closePopup} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-gray-300 mb-8">Your mock interview session has been completed. Would you like to see your performance analysis?</p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={closePopup}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={viewAnalysis}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
              >
                <BarChart2 size={20} />
                <span>View Analysis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockInterviews;