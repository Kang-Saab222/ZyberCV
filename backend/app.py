from flask import Flask, request, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import json
import base64
from datetime import datetime
from google import genai
from google.genai import types
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for all routes and all origins
CORS(app, supports_credentials=True)

app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///auth.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create response cache directory if it doesn't exist
RESPONSE_CACHE_FOLDER = 'response_cache'
os.makedirs(RESPONSE_CACHE_FOLDER, exist_ok=True)

# Initialize Gemini API
GEMINI_API_KEY = "AIzaSyAeJX_mxk7a8mtv4CTTZHh7KYUYdcvEtH8"
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

# Initialize SQLAlchemy
db = SQLAlchemy(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# User model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with resume files
    resume_files = db.relationship('ResumeFile', backref='user', lazy=True)
    
    # Relationship with interview responses
    interview_responses = db.relationship('InterviewResponse', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Resume File model
class ResumeFile(db.Model):
    __tablename__ = 'resume_file'  # Explicitly define table name
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationship with resume responses
    responses = db.relationship('ResumeResponse', backref='resume_file', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'upload_date': self.upload_date.isoformat() if self.upload_date else None,
            'user_id': self.user_id
        }

# Resume Response model to store API responses
class ResumeResponse(db.Model):
    __tablename__ = 'resume_response'
    
    id = db.Column(db.Integer, primary_key=True)
    resume_file_id = db.Column(db.Integer, db.ForeignKey('resume_file.id'), nullable=False)
    response_file = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'resume_file_id': self.resume_file_id,
            'response_file': self.response_file,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Interview Response model to store interview analysis
class InterviewResponse(db.Model):
    __tablename__ = 'interview_response'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    conversation_hash = db.Column(db.String(64), nullable=False)
    response_file = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'conversation_hash': self.conversation_hash,
            'response_file': self.response_file,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create DB tables
# with app.app_context():
#     # Drop all tables and recreate them
#     db.drop_all()
#     db.create_all()
#     print("Database tables have been recreated.")

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data or 'name' not in data:
        return jsonify({'error': 'Name, email and password are required'}), 400
    
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    # Check if user already exists
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    try:
        # Create new user
        user = User(name=name, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        # Log in the new user
        login_user(user)
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if user and user.check_password(password):
        login_user(user)
        return jsonify({
            'message': 'Login successful',
            'email': user.email,
            'user': user.to_dict()
        }), 200
    else:
        return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/me', methods=['POST'])
def get_user():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200

@app.route('/upload/resume', methods=['POST'])
def upload_resume():
    # Get email from form data
    email = request.form.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    
    # If user does not select file, browser also
    # submit an empty part without filename
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Secure the filename to prevent any security issues
        original_filename = secure_filename(file.filename)
        
        # Add timestamp to prevent filename conflicts
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp}_{original_filename}"
        
        # Save the file to the upload folder
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Create a new record in the database
        resume_file = ResumeFile(
            filename=filename,
            user_id=user.id
        )
        
        db.session.add(resume_file)
        db.session.commit()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file': resume_file.to_dict()
        }), 201
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/user/resumes', methods=['POST'])
def get_user_resumes():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    resumes = ResumeFile.query.filter_by(user_id=user.id).order_by(ResumeFile.upload_date.desc()).all()
    return jsonify({
        'resumes': [resume.to_dict() for resume in resumes]
    }), 200

@app.route('/analyze/resume', methods=['POST'])
def analyze_resume():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get the latest resume
    latest_resume = ResumeFile.query.filter_by(user_id=user.id).order_by(ResumeFile.upload_date.desc()).first()
    
    if not latest_resume:
        return jsonify({'error': 'No resume found for this user'}), 404
    
    # Get the file path
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], latest_resume.filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Resume file not found'}), 404
    
    try:
        # Initialize Gemini client using the correct API format
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        
        # Read the text content of the resume if it's a text file
        # client.files.upload(file=file_path)
        files = [
        # Please ensure that the file is available in local system working direrctory or change the file path.
        client.files.upload(file=file_path),
    ]
        # resume_text = ""
        # if file_path.lower().endswith('.txt'):
        #     with open(file_path, 'r', encoding='utf-8') as f:
        #         resume_text = f.read()
        # else:
        #     # For non-text files, we'll just mention the file type
        #     resume_text = f"[Resume file: {os.path.basename(file_path)}]"
        
        # Define the model
        model = "gemini-2.0-flash"
        
        # Prepare the prompt
        analysis_prompt = """
        Analyze this resume and provide feedback in JSON format with the following structure:
        also dont include the ```json from start and end ```(important dont include it)
       const scoreCategories = [
{
id: 'ats-parse',
title: 'ATS & Format',
icon: 'file-alt',
iconColor: 'text-red-500',
score: '--%',
scoreClass: 'bg-red-100 text-red-600',
category: 'ESSENTIALS',
issues: number
},
{
id: 'impact',
title: 'Content Quality',
icon: 'chart-line',
iconColor: 'text-orange-500',
score: '--%',
scoreClass: 'bg-orange-100 text-orange-600',
category: 'ESSENTIALS',
issues: number
},
{
id: 'keywords',
title: 'Keywords Usage',
icon: 'key',
iconColor: 'text-yellow-500',
score: '--%',
scoreClass: 'bg-yellow-100 text-yellow-600',
category: 'ESSENTIALS',
issues: number
},
{
id: 'sections',
title: 'Structure',
icon: 'layer-group',
iconColor: 'text-blue-500',
score: '--%',
scoreClass: 'bg-blue-100 text-blue-600',
category: 'LAYOUT',
issues: number
},
{
id: 'style',
title: 'Visual Appeal',
icon: 'paint-brush',
iconColor: 'text-green-500',
score: '--%',
scoreClass: 'bg-green-100 text-green-600',
category: 'LAYOUT',
issues: number
},
{
id: 'space',
title: 'Space Utilization',
icon: 'expand',
iconColor: 'text-indigo-500',
score: '--%',
scoreClass: 'bg-indigo-100 text-indigo-600',
category: 'LAYOUT',
issues: number
},
{
id: 'grammar',
title: 'Grammar & Spelling',
icon: 'spell-check',
iconColor: 'text-purple-500',
score: '--%',
scoreClass: 'bg-purple-100 text-purple-600',
category: 'LANGUAGE',
issues: number
},
{
id: 'action-verbs',
title: 'Action Verbs',
icon: 'bolt',
iconColor: 'text-pink-500',
score: '--%',
scoreClass: 'bg-pink-100 text-pink-600',
category: 'LANGUAGE',
issues: number
}
];
const sectionContent = {
'ats-parse': {
title: 'ATS & FORMAT ANALYSIS',
icon: 'robot',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '28%',
scoreColor: 'from-red-500 to-red-400',
scoreTitle: 'Critical Issues Detected',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "error", // Custom design indicator
layout: "standard" // Layout style
},
'impact': {
title: 'CONTENT QUALITY',
icon: 'chart-line',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '65%',
scoreColor: 'from-orange-400 to-yellow-300',
scoreTitle: 'Room for Improvement',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "warning", // Custom design indicator
layout: "split" // Layout style
},
'sections': {
title: 'STRUCTURE ANALYSIS',
icon: 'layer-group',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '67%',
scoreColor: 'from-blue-400 to-blue-300',
scoreTitle: 'Almost There!',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "info", // Custom design indicator
layout: "card" // Layout style
},
'style': {
title: 'VISUAL APPEAL',
icon: 'paint-brush',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '75%',
scoreColor: 'from-green-400 to-green-500',
scoreTitle: 'Good Design',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "success", // Custom design indicator
layout: "banner" // Layout style
},
'keywords': {
title: 'KEYWORDS ANALYSIS',
icon: 'key',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '42%',
scoreColor: 'from-yellow-400 to-yellow-300',
scoreTitle: 'Needs Improvement',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "warning", // Custom design indicator
layout: "compact" // Layout style
},
'space': {
title: 'SPACE UTILIZATION',
icon: 'expand',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '80%',
scoreColor: 'from-indigo-400 to-indigo-300',
scoreTitle: 'Good Space Usage',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "info", // Custom design indicator
layout: "dashboard" // Layout style
},
'grammar': {
title: 'GRAMMAR & SPELLING',
icon: 'spell-check',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '90%',
scoreColor: 'from-purple-400 to-purple-300',
scoreTitle: 'Nearly Perfect',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "success", // Custom design indicator
layout: "minimal" // Layout style
},
'action-verbs': {
title: 'ACTION VERBS',
icon: 'bolt',
issues: '__ ISSUES FOUND',
description: [
"some text",
"some text"
],
scorePercent: '50%',
scoreColor: 'from-pink-400 to-pink-300',
scoreTitle: 'Needs Attention',
scoreDescription: [
"some text",
"some text"
],
actionText: "some text",
design: "warning", // Custom design indicator
layout: "list" // Layout style
}
};
        """

        ppt= "give the text content of the resume"
        
        # Create the content structure
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=files[0].uri,
                        mime_type=files[0].mime_type,
                    ),
                    types.Part.from_text(text=f"{analysis_prompt}\n\n donot give same response for same resume, provide new response with new text but same structure, alos provide suggestion in some text, with the same structure by comparing the resume original text and the new better text that can be used to improve the resume, if the provided file is not a resume, then give extermly bad and worse response"),
                ],
            ),
        ]
        
        # Set response configuration
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        print("response")
        
        #in response.text, remove the ```json from start and end ```
        # response.text = response.text.replace("```json", "").replace("```", "")
        print(response.text)
        # Return the response
        return jsonify({
            'message': 'Resume analyzed successfully',
            'analysis': response.text,
            'filename': latest_resume.filename,
            'upload_date': latest_resume.upload_date.isoformat()
        }), 200
        #print the response
        
    
    except Exception as e:
        return jsonify({'error': f'Error analyzing resume: {str(e)}'}), 500



@app.route('/dashboard/v1', methods=['POST'])
def dashboard_v1():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get the latest resume
    latest_resume = ResumeFile.query.filter_by(user_id=user.id).order_by(ResumeFile.upload_date.desc()).first()
    
    if not latest_resume:
        return jsonify({'error': 'No resume found for this user'}), 404
    
    # Check if we have a cached response for this resume
    existing_response = ResumeResponse.query.filter_by(resume_file_id=latest_resume.id).first()
    
    if existing_response:
        # If response exists, load it from the file
        response_file_path = os.path.join(RESPONSE_CACHE_FOLDER, existing_response.response_file)
        
        if os.path.exists(response_file_path):
            try:
                with open(response_file_path, 'r', encoding='utf-8') as f:
                    cached_response = f.read()
                
                return jsonify({
                    'message': 'Resume analysis retrieved from cache',
                    'analysis': cached_response,
                    'filename': latest_resume.filename,
                    'upload_date': latest_resume.upload_date.isoformat(),
                    'cached': True
                }), 200
            except Exception as e:
                # If there's an error reading the cache, we'll regenerate
                print(f"Error reading cached response: {str(e)}")
    
    # If we get here, we need to generate a new response
    # Get the file path
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], latest_resume.filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Resume file not found'}), 404
    
    try:
        # Initialize Gemini client using the correct API format
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        
        # Upload the file to Gemini
        files = [
            client.files.upload(file=file_path),
        ]
        
        # Define the model
        model = "gemini-2.0-flash"
        
        # Prepare the prompt
        analysis_prompt = """
        Analyze this resume and provide feedback in JSON format with the following structure:
        const resumeData = {
    candidate: {
      name: userData?.name || "Jane Smith",
      currentRole: "Senior Frontend Developer",
      yearsExperience: 7,
      education: "Master's in Computer Science",
      location: "San Francisco, CA",
      email: userData?.email || "jane.smith@example.com",
      phone: "(555) 123-4567",
      linkedin: "linkedin.com/in/janesmith",
      photoUrl: "/api/placeholder/80/80"
    },
    skillsAnalysis: {
      technical: [
        { name: "React", level: 90 },
        { name: "JavaScript", level: 95 },
        { name: "TypeScript", level: 85 },
        { name: "Node.js", level: 70 },
        { name: "CSS/SCSS", level: 80 },
        { name: "HTML5", level: 90 },
        { name: "Redux", level: 75 }
      ],
      soft: [
        { name: "Communication", level: 85 },
        { name: "Team Leadership", level: 75 },
        { name: "Problem Solving", level: 90 },
        { name: "Project Management", level: 80 },
        { name: "Agile/Scrum", level: 85 }
      ],
      jobMatchPercentage: 87
    },
    experienceInsights: {
      domains: [
        { name: "Frontend Development", years: 7 },
        { name: "UI/UX Design", years: 3 },
        { name: "Team Leadership", years: 2 },
        { name: "Backend Development", years: 1 }
      ],
      educationRelevance: 90,
      roles: [
        { title: "Senior Frontend Developer", company: "TechCorp Inc.", duration: "2021-Present" },
        { title: "Frontend Developer", company: "WebSolutions LLC", duration: "2018-2021" },
        { title: "Junior Developer", company: "StartupXYZ", duration: "2016-2018" }
      ]
    },
    improvements: [
      { date: "2025-03-28 10:30 AM", fileName: "Resume_V1.1.pdf", improvementPercent: 10, notes: "Added quantifiable achievements" },
      { date: "2025-03-27 03:15 PM", fileName: "Resume_V1.0.pdf", improvementPercent: 8, notes: "Improved skills section" },
      { date: "2025-03-26 01:45 PM", fileName: "Resume_V0.9.pdf", improvementPercent: 12, notes: "Enhanced job descriptions" }
    ],
    marketAnalysis: {
      salaryRange: { min: 120000, max: 160000, average: 140000 },
      demandScore: 85,
      competitiveAdvantage: [
        { skill: "React", advantage: "High" },
        { skill: "TypeScript", advantage: "Medium" },
        { skill: "Team Leadership", advantage: "High" }
      ]
    }
  };

        """

        ppt= "give the text content of the resume"
        
        # Create the content structure
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=files[0].uri,
                        mime_type=files[0].mime_type,
                    ),
                    types.Part.from_text(text=f"{analysis_prompt}\n\n donot give same response for same resume, provide new response with new text but same structure,do not write extra text, just write the json response,then give extermly bad and worse response"),
                ],
            ),
        ]
        
        # Set response configuration
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        
        # Save the response to a file
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        response_filename = f"{timestamp}_{latest_resume.id}.json"
        response_file_path = os.path.join(RESPONSE_CACHE_FOLDER, response_filename)
        
        with open(response_file_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        # Save the response metadata to the database
        if existing_response:
            # Update existing response
            old_file_path = os.path.join(RESPONSE_CACHE_FOLDER, existing_response.response_file)
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                except:
                    pass
            existing_response.response_file = response_filename
            existing_response.created_at = datetime.utcnow()
        else:
            # Create new response record
            resume_response = ResumeResponse(
                resume_file_id=latest_resume.id,
                response_file=response_filename
            )
            db.session.add(resume_response)
        
        db.session.commit()
        
        # Return the response
        return jsonify({
            'message': 'Resume analyzed successfully',
            'analysis': response.text,
            'filename': latest_resume.filename,
            'upload_date': latest_resume.upload_date.isoformat(),
            'cached': False
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error analyzing resume: {str(e)}'}), 500



@app.route('/job/v1', methods=['POST'])
def job_v1():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get the latest resume
    latest_resume = ResumeFile.query.filter_by(user_id=user.id).order_by(ResumeFile.upload_date.desc()).first()
    
    if not latest_resume:
        return jsonify({'error': 'No resume found for this user'}), 404
    
    # Get the file path
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], latest_resume.filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Resume file not found'}), 404
    
    try:
        # Initialize Gemini client using the correct API format
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        
        # Read the text content of the resume if it's a text file
        # client.files.upload(file=file_path)
        files = [
        # Please ensure that the file is available in local system working direrctory or change the file path.
        client.files.upload(file=file_path),
    ]
        # resume_text = ""
        # if file_path.lower().endswith('.txt'):
        #     with open(file_path, 'r', encoding='utf-8') as f:
        #         resume_text = f.read()
        # else:
        #     # For non-text files, we'll just mention the file type
        #     resume_text = f"[Resume file: {os.path.basename(file_path)}]"
        
        # Define the model
        model = "gemini-2.0-flash"
        
        # Prepare the prompt
        analysis_prompt = """
        give the job suggestions in the same structure, if the provided file is not a resume, then give extermly bad and worse response, do not give any other text, just give the json response
                [ 
    {
      id: 1,
      title: 'Frontend Developer',
      company: 'TechCorp Inc.',
      skills: ['JavaScript', 'React', 'CSS', 'HTML', 'TypeScript'],
      match: 0,
      description: 'We are looking for a frontend developer to join our team and build responsive web applications.',
      salary: '₹7,50,000 - ₹10,00,000',
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
      title: 'Full Stack Engineer',
      company: 'InnovateSoft',
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express'],
      match: 0,
      description: 'Join our team to develop both frontend and backend components of our web applications.',
      salary: '₹8,30,000 - ₹10,80,000',
      saved: false,
      requiredSkillDetails: {
        'JavaScript': 'Strong understanding of both client and server-side JavaScript',
        'React': 'Building reusable components and managing application state',
        'Node.js': 'RESTful API development and server-side architecture',
        'MongoDB': 'Database design, querying, and aggregation pipelines',
        'Express': 'Middleware development and route handling'
      }
    },
    {
      id: 3,
      title: 'React Native Developer',
      company: 'MobileFirst Co.',
      skills: ['React Native', 'JavaScript', 'TypeScript', 'Redux'],
      match: 0,
      description: 'Help us build cross-platform mobile applications using React Native.',
      salary: '₹7,90,000 - ₹10,40,000',
      saved: false,
      requiredSkillDetails: {
        'React Native': 'Experience with native modules and mobile-specific UI/UX patterns',
        'JavaScript': 'ES6+ features and asynchronous programming patterns',
        'TypeScript': 'Type safety in React Native applications',
        'Redux': 'State management for complex mobile applications'
      }
    }
    7...more job suggestions
  ]
        """

        ppt= "give the text content of the resume"
        
        # Create the content structure
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=files[0].uri,
                        mime_type=files[0].mime_type,
                    ),
                    types.Part.from_text(text=f"{analysis_prompt}\n\n donot give same response for same resume, provide new response with new text but same structure, alos provide suggestion in some text, with the same structure by comparing the resume original text and the new better text that can be used to improve the resume, if the provided file is not a resume, then give extermly bad and worse response"),
                ],
            ),
        ]
        
        # Set response configuration
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        print("response")
        
        #in response.text, remove the ```json from start and end ```
        # response.text = response.text.replace("```json", "").replace("```", "")
        print(response.text)
        # Return the response
        return jsonify({
            'message': 'Resume analyzed successfully',
            'analysis': response.text,
            'filename': latest_resume.filename,
            'upload_date': latest_resume.upload_date.isoformat()
        }), 200
        #print the response
        
    
    except Exception as e:
        return jsonify({'error': f'Error analyzing resume: {str(e)}'}), 500




@app.route('/interview-content/v1', methods=['POST'])
def interview_content_v1():
    data = request.get_json()
    
    if not data or 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400
    
    email = data.get('email')
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get the latest resume
    latest_resume = ResumeFile.query.filter_by(user_id=user.id).order_by(ResumeFile.upload_date.desc()).first()
    
    if not latest_resume:
        return jsonify({'error': 'No resume found for this user'}), 404
    
    # Get the file path
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], latest_resume.filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'Resume file not found'}), 404
    
    try:
        # Initialize Gemini client using the correct API format
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        
        # Read the text content of the resume if it's a text file
        # client.files.upload(file=file_path)
        files = [
        # Please ensure that the file is available in local system working direrctory or change the file path.
        client.files.upload(file=file_path),
    ]
        # resume_text = ""
        # if file_path.lower().endswith('.txt'):
        #     with open(file_path, 'r', encoding='utf-8') as f:
        #         resume_text = f.read()
        # else:
        #     # For non-text files, we'll just mention the file type
        #     resume_text = f"[Resume file: {os.path.basename(file_path)}]"
        
        # Define the model
        model = "gemini-2.0-flash"
        
        # Prepare the prompt
        analysis_prompt = """
        plz provide the interview questions after reading the resume, provide related questions, first greet the user with name and then provide the interview questions, if the provided file is not a resume, then give extermly bad and worse response
        """

        ppt= "give the text content of the resume"
        
        # Create the content structure
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=files[0].uri,
                        mime_type=files[0].mime_type,
                    ),
                    types.Part.from_text(text=f"{analysis_prompt}\n\n donot give same response for same resume, provide new response with new text but same structure,make sure each question length is max 15 words, if the provided file is not a resume, then give extermly bad and worse response"),
                ],
            ),
        ]
        
        # Set response configuration
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        print("response")
        
        #in response.text, remove the ```json from start and end ```
        # response.text = response.text.replace("```json", "").replace("```", "")
        print(response.text)
        # Return the response
        return jsonify({
            'message': 'Resume analyzed successfully',
            'analysis': response.text,
            'filename': latest_resume.filename,
            'upload_date': latest_resume.upload_date.isoformat()
        }), 200
        #print the response
        
    
    except Exception as e:
        return jsonify({'error': f'Error analyzing resume: {str(e)}'}), 500

@app.route('/interview-analyze', methods=['POST'])
def interview_analyze():
    data = request.get_json()
    
    if not data or 'email' not in data or 'conversationLog' not in data:
        return jsonify({'error': 'Email and conversation log are required'}), 400
    
    email = data.get('email')
    conversation_log = data.get('conversationLog', [])
    
    # Validate conversation log
    if not isinstance(conversation_log, list) or len(conversation_log) == 0:
        return jsonify({'error': 'Invalid conversation log format'}), 400
    
    # Find user by email
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Create a hash of the conversation log to use as a cache key
    conversation_json = json.dumps(conversation_log, sort_keys=True)
    import hashlib
    conversation_hash = hashlib.md5(conversation_json.encode()).hexdigest()
    
    # Check if we have a cached response for this conversation
    existing_response = InterviewResponse.query.filter_by(
        user_id=user.id, 
        conversation_hash=conversation_hash
    ).first()
    
    if existing_response:
        # If response exists, load it from the file
        response_file_path = os.path.join(RESPONSE_CACHE_FOLDER, existing_response.response_file)
        
        if os.path.exists(response_file_path):
            try:
                with open(response_file_path, 'r', encoding='utf-8') as f:
                    cached_response = json.load(f)
                
                return jsonify({
                    'success': True,
                    'message': 'Interview analysis retrieved from cache',
                    'analysis': cached_response,
                    'cached': True
                }), 200
            except Exception as e:
                # If there's an error reading the cache, we'll regenerate
                print(f"Error reading cached interview response: {str(e)}")
    
    try:
        # Initialize Gemini client
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        
        # Define the model
        model = "gemini-2.0-flash"
        
        # Format the conversation for analysis
        formatted_conversation = ""
        for entry in conversation_log:
            speaker = entry.get('speaker', '')
            text = entry.get('text', '')
            entry_type = entry.get('type', '')
            
            formatted_conversation += f"{speaker.upper()}: [{entry_type}] {text}\n\n"
        
        # Prepare the analysis prompt
        analysis_prompt = """
        You are an expert interview coach analyzing an interview conversation.
        Analyze the following interview conversation and provide feedback in JSON format with the following structure:
        
        {
          "metrics": {
            "overallScore": number (0-100),
            "confidence": number (0-100),
            "technicalScore": number (0-100),
            "communicationScore": number (0-100)
          },
          "keyInsights": [
            string (list of 5 key observations about the candidate's performance)
          ],
          "improvementAreas": [
            string (list of 4 specific areas where the candidate can improve)
          ],
          "strengths": [
            {
              "title": string (strength category),
              "description": string (brief description of the strength)
            }
            (3 total strengths)
          ],
          "focusAreas": [
            {
              "title": string (focus area title),
              "description": string (brief description of what to focus on),
              "tip": string (practical advice for improvement)
            }
            (3 total focus areas)
          ],
          "questionResponses": [
            {
              "question": string (the interview question),
              "response": string (the candidate's response),
              "responseScore": number (0-100 score for the response),
              "feedback": string (specific feedback on this response)
            }
            (one entry per question-answer pair)
          ],
          "nextSteps": [
            {
              "title": string (action item title),
              "description": string (brief description of the action)
            }
            (3 total next steps)
          ]
        }
        
        Do not include any text outside the JSON structure. Only return the JSON object.
        Be fair but constructive in your assessment. Consider both technical accuracy and communication skills.
        """
        
        # Create the content structure
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=f"{analysis_prompt}\n\nInterview Conversation:\n{formatted_conversation}"),
                ],
            ),
        ]
        
        # Set response configuration
        generate_content_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        
        # Clean up response to ensure valid JSON
        result = response.text
        # Strip any Markdown code block markers if present
        if result.startswith("```json"):
            result = result.replace("```json", "", 1)
        if result.endswith("```"):
            result = result.replace("```", "", 1)
        result = result.strip()
        
        # Parse the JSON to validate and return
        try:
            analysis_json = json.loads(result)
            
            # Save the response to a file
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            response_filename = f"interview_{timestamp}_{user.id}.json"
            response_file_path = os.path.join(RESPONSE_CACHE_FOLDER, response_filename)
            
            with open(response_file_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_json, f, ensure_ascii=False, indent=2)
            
            # Save the response metadata to the database
            if existing_response:
                # Update existing response
                old_file_path = os.path.join(RESPONSE_CACHE_FOLDER, existing_response.response_file)
                if os.path.exists(old_file_path):
                    try:
                        os.remove(old_file_path)
                    except:
                        pass
                existing_response.response_file = response_filename
                existing_response.created_at = datetime.utcnow()
            else:
                # Create new response record
                interview_response = InterviewResponse(
                    user_id=user.id,
                    conversation_hash=conversation_hash,
                    response_file=response_filename
                )
                db.session.add(interview_response)
            
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Interview analysis completed successfully",
                "analysis": analysis_json,
                "cached": False
            }), 200
        except json.JSONDecodeError as e:
            db.session.rollback()
            return jsonify({
                "success": False,
                "message": f"Error parsing analysis result: {str(e)}",
                "raw_response": result
            }), 500
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error analyzing interview: {str(e)}"
        }), 500

# Handle login_required errors
@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Authentication required'}), 401

if __name__ == '__main__':
    app.run(debug=True) 