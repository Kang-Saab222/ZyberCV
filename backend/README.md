# Flask API with SQLite and Flask-Login

A simple Flask API for user authentication using SQLite database.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   pip install flask flask-login flask-sqlalchemy flask-wtf email_validator flask-cors
   ```
3. Run the application:
   ```
   python app.py
   ```
   This will automatically create a SQLite database file `auth.db` in your project directory.

## API Endpoints

### Signup
- **URL**: `/signup`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "message": "User created successfully",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "created_at": "2023-06-01T12:34:56"
    }
  }
  ```

### Login
- **URL**: `/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Login successful",
    "email": "user@example.com",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "created_at": "2023-06-01T12:34:56"
    }
  }
  ```

### Logout
- **URL**: `/logout`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Logout successful"
  }
  ```

### Get Current User
- **URL**: `/me`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "created_at": "2023-06-01T12:34:56"
    }
  }
  ```

### Upload Resume
- **URL**: `/upload/resume`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `email`: User's email address
  - `file`: The resume file to upload (PDF, DOC, DOCX, TXT)
- **Response**:
  ```json
  {
    "message": "File uploaded successfully",
    "file": {
      "id": 1,
      "filename": "20230601123456_resume.pdf",
      "upload_date": "2023-06-01T12:34:56",
      "user_id": 1
    }
  }
  ```

### Get User's Resumes
- **URL**: `/user/resumes`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "resumes": [
      {
        "id": 1,
        "filename": "20230601123456_resume.pdf",
        "upload_date": "2023-06-01T12:34:56",
        "user_id": 1
      }
    ]
  }
  ```

### Analyze Resume with Gemini AI
- **URL**: `/analyze/resume`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Resume analyzed successfully",
    "analysis": "...", // JSON string with detailed resume analysis
    "filename": "20230601123456_resume.pdf",
    "upload_date": "2023-06-01T12:34:56"
  }
  ```
- **Note**: This endpoint requires the Gemini API key to be set in the environment variable `GEMINI_API_KEY`.

## Authentication

This API uses email-based authentication. You need to provide the user's email in the request body for protected endpoints.

## CORS Support

This API includes CORS support via Flask-CORS, allowing cross-origin requests from any origin (including your React frontend). The API is configured with `supports_credentials=True` to enable sending and receiving cookies in cross-origin requests.

When making requests from your React frontend, ensure you include the following options:

```javascript
fetch('http://127.0.0.1:5000/endpoint', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    // other data as needed
  })
})
```

For file uploads, use FormData:

```javascript
const formData = new FormData();
formData.append('email', 'user@example.com');
formData.append('file', fileInput.files[0]);

fetch('http://127.0.0.1:5000/upload/resume', {
  method: 'POST',
  credentials: 'include',
  body: formData
})
```

## Testing

Run the test script to verify the API functionality:
```
python test_api.py