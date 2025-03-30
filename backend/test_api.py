import requests
import json
import os

# Base URL of your Flask API
BASE_URL = 'http://localhost:5000'
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "password123"
TEST_NAME = "Test User"

def test_signup():
    """Test user signup endpoint"""
    url = f"{BASE_URL}/signup"
    data = {
        "name": TEST_NAME,
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(url, json=data)
    print("\n=== SIGNUP TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 201

def test_login():
    """Test user login endpoint"""
    url = f"{BASE_URL}/login"
    data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(url, json=data)
    print("\n=== LOGIN TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 200

def test_me():
    """Test get current user endpoint"""
    url = f"{BASE_URL}/me"
    data = {"email": TEST_EMAIL}
    
    response = requests.post(url, json=data)
    print("\n=== GET USER TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 200

def test_logout():
    """Test user logout endpoint"""
    url = f"{BASE_URL}/logout"
    data = {"email": TEST_EMAIL}
    
    response = requests.post(url, json=data)
    print("\n=== LOGOUT TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 200

def test_upload_resume():
    """Test file upload endpoint"""
    url = f"{BASE_URL}/upload/resume"
    
    # Create a simple test file if it doesn't exist
    test_file_path = "test_resume.txt"
    if not os.path.exists(test_file_path):
        with open(test_file_path, "w") as f:
            f.write("This is a test resume file for API testing.")
    
    # Open file in binary mode
    with open(test_file_path, "rb") as f:
        files = {"file": f}
        data = {"email": TEST_EMAIL}
        response = requests.post(url, files=files, data=data)
    
    print("\n=== UPLOAD RESUME TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 201

def test_get_resumes():
    """Test get user resumes endpoint"""
    url = f"{BASE_URL}/user/resumes"
    data = {"email": TEST_EMAIL}
    
    response = requests.post(url, json=data)
    print("\n=== GET RESUMES TEST ===")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 200

def test_analyze_resume():
    """Test resume analysis endpoint"""
    # First, make sure we have uploaded a resume
    test_upload_resume()
    
    # Now analyze the resume
    url = f"{BASE_URL}/analyze/resume"
    data = {"email": TEST_EMAIL}
    
    response = requests.post(url, json=data)
    print("\n=== ANALYZE RESUME TEST ===")
    print(f"Status code: {response.status_code}")
    
    # Don't print the entire response as it could be very large
    if response.status_code == 200:
        json_response = response.json()
        print(f"Message: {json_response.get('message')}")
        print(f"Filename: {json_response.get('filename')}")
        print(f"Upload date: {json_response.get('upload_date')}")
        print("Analysis: [Output truncated due to size]")
    else:
        print(f"Response: {response.json()}")
    
    return response.status_code == 200

if __name__ == "__main__":
    # Try to sign up a new user (might fail if user already exists)
    signup_success = test_signup()
    
    # Login
    login_success = test_login()
    
    # Test get user info
    test_me()
    
    # Test file upload
    test_upload_resume()
    
    # Test get resumes
    test_get_resumes()
    
    # Test resume analysis
    test_analyze_resume()
    
    # Test logout
    test_logout()
    
    # Test that me endpoint still works even after logout
    # (since we no longer use session-based auth)
    me_after_logout = requests.post(f"{BASE_URL}/me", json={"email": TEST_EMAIL})
    print("\n=== GET USER AFTER LOGOUT TEST ===")
    print(f"Status code: {me_after_logout.status_code}")
    print(f"Response: {me_after_logout.json()}") 