import requests
import sys

# Simple test to check server connectivity
def test_server_connection():
    server_url = "http://localhost:5001"
    
    print(f"Testing connection to server at: {server_url}")
    
    try:
        # Send GET request to server root
        response = requests.get(server_url)
        
        # Check response
        print(f"Status code: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            print("\nServer connection successful!")
            return True
        else:
            print(f"\nServer returned non-200 status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\nError connecting to server: {str(e)}")
        return False

if __name__ == "__main__":
    # Run the test
    success = test_server_connection()
    if not success:
        sys.exit(1)
