import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MockInterviews from "./comp/MockInterviews";
import ResumeAnalyzer from "./comp/ResumeAnalyzer"; 
import JobRecommendations from './comp/JobRecommendations'
import ResumeScoreAnalysis from './comp/ResumeScoreAnalysis'
import ResumeUploader from './comp/ResumeUploader';
import LoginSignupForm from './comp/AuthForm';


function App() {
  const [count, setCount] = useState(0)

  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<ResumeAnalyzer />} />
        <Route path="/interview" element={<MockInterviews />} />
        <Route path="/job" element={<JobRecommendations/>}/>
        <Route path="/score" element={<ResumeScoreAnalysis/>}/>
        <Route path="/upload" element={<ResumeUploader/>}/>
        <Route path="/login" element={<LoginSignupForm/>}/>
      </Routes>
    </Router>
  )
}

export default App
