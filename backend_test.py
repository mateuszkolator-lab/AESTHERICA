import requests
import sys
import json
from datetime import datetime, timedelta

class PatientManagementTester:
    def __init__(self):
        # Use public endpoint from frontend env
        self.base_url = "https://aesthetica-pro.preview.emergentagent.com/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_patient_id = None
        self.test_visit_id = None
        self.test_location_id = None

    def log_test(self, test_name, success, response=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            self.failed_tests.append({
                "test": test_name,
                "error": error or "Unknown error",
                "response": response
            })
            print(f"❌ {test_name}: FAILED - {error}")

    def run_test(self, test_name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            print(f"\n🔍 Testing {test_name}...")
            print(f"   URL: {url}")
            
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json() if response.content else {}
            except:
                pass

            if success:
                self.log_test(test_name, True, response_data)
                return True, response_data
            else:
                self.log_test(test_name, False, response_data, f"Expected {expected_status}, got {response.status_code}")
                return False, response_data

        except Exception as e:
            self.log_test(test_name, False, error=str(e))
            return False, {}

    def test_health_check(self):
        """Test API health"""
        return self.run_test("API Health Check", "GET", "/", 200)

    def test_login(self):
        """Test login with correct password"""
        success, response = self.run_test(
            "Login with correct password", 
            "POST", 
            "/auth/login", 
            200,
            {"password": "doctor2024"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
        return success

    def test_invalid_login(self):
        """Test login with incorrect password"""
        return self.run_test(
            "Login with invalid password", 
            "POST", 
            "/auth/login", 
            401,
            {"password": "wrongpassword"}
        )

    def test_auth_verify(self):
        """Test token verification"""
        if not self.token:
            self.log_test("Token Verification", False, error="No token available")
            return False
        return self.run_test("Token Verification", "GET", "/auth/verify", 200)

    def test_create_location(self):
        """Test creating a location"""
        location_data = {
            "name": "Main Clinic",
            "address": "123 Medical Center Dr"
        }
        success, response = self.run_test(
            "Create Location", 
            "POST", 
            "/locations", 
            200,
            location_data
        )
        if success and 'id' in response:
            self.test_location_id = response['id']
        return success

    def test_get_locations(self):
        """Test getting locations"""
        return self.run_test("Get Locations", "GET", "/locations", 200)

    def test_create_patient(self):
        """Test creating a patient"""
        patient_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@test.com",
            "phone": "+1234567890",
            "date_of_birth": "1985-06-15",
            "gender": "male",
            "status": "consultation",
            "procedure_type": "Rhinoplasty",
            "preferred_date_start": "2024-03-01",
            "preferred_date_end": "2024-03-31",
            "location_id": self.test_location_id,
            "price": 8500.00,
            "notes": "Patient interested in rhinoplasty procedure"
        }
        success, response = self.run_test(
            "Create Patient", 
            "POST", 
            "/patients", 
            200,
            patient_data
        )
        if success and 'id' in response:
            self.test_patient_id = response['id']
        return success

    def test_get_patients(self):
        """Test getting all patients"""
        return self.run_test("Get All Patients", "GET", "/patients", 200)

    def test_get_patient_by_id(self):
        """Test getting specific patient"""
        if not self.test_patient_id:
            self.log_test("Get Patient by ID", False, error="No test patient ID")
            return False
        return self.run_test(
            "Get Patient by ID", 
            "GET", 
            f"/patients/{self.test_patient_id}", 
            200
        )

    def test_update_patient(self):
        """Test updating patient"""
        if not self.test_patient_id:
            self.log_test("Update Patient", False, error="No test patient ID")
            return False
        
        update_data = {
            "status": "planned",
            "surgery_date": "2024-03-15",
            "notes": "Surgery scheduled for March 15th"
        }
        return self.run_test(
            "Update Patient", 
            "PUT", 
            f"/patients/{self.test_patient_id}", 
            200,
            update_data
        )

    def test_patient_filtering(self):
        """Test patient filtering by status"""
        return self.run_test(
            "Filter Patients by Status", 
            "GET", 
            "/patients?status=planned", 
            200
        )

    def test_add_visit(self):
        """Test adding a visit to patient"""
        if not self.test_patient_id:
            self.log_test("Add Visit", False, error="No test patient ID")
            return False
        
        visit_data = {
            "date": "2024-02-01",
            "type": "consultation",
            "notes": "Initial consultation completed"
        }
        success, response = self.run_test(
            "Add Visit", 
            "POST", 
            f"/patients/{self.test_patient_id}/visits", 
            200,
            visit_data
        )
        if success and 'id' in response:
            self.test_visit_id = response['id']
        return success

    def test_add_photo(self):
        """Test adding photo to visit"""
        if not self.test_patient_id or not self.test_visit_id:
            self.log_test("Add Photo", False, error="No test patient or visit ID")
            return False
        
        # Create a simple base64 image data
        photo_data = {
            "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wGV",
            "filename": "test_photo.jpg",
            "category": "before",
            "caption": "Test photo"
        }
        return self.run_test(
            "Add Photo to Visit", 
            "POST", 
            f"/patients/{self.test_patient_id}/visits/{self.test_visit_id}/photos", 
            200,
            photo_data
        )

    def test_dashboard(self):
        """Test dashboard endpoint"""
        return self.run_test("Get Dashboard Data", "GET", "/dashboard", 200)

    def test_statistics(self):
        """Test statistics endpoint"""
        return self.run_test("Get Statistics", "GET", "/stats", 200)

    def test_calendar_status(self):
        """Test calendar status"""
        return self.run_test("Calendar Status", "GET", "/calendar/status", 200)

    def test_export_patients(self):
        """Test patient export"""
        success, response = self.run_test("Export Patients", "GET", "/export/patients", 200)
        return success

    def test_cleanup(self):
        """Cleanup test data"""
        success = True
        
        # Delete test patient (which should cascade delete visits and photos)
        if self.test_patient_id:
            delete_success, _ = self.run_test(
                "Delete Test Patient", 
                "DELETE", 
                f"/patients/{self.test_patient_id}", 
                200
            )
            success = success and delete_success

        # Delete test location
        if self.test_location_id:
            delete_success, _ = self.run_test(
                "Delete Test Location", 
                "DELETE", 
                f"/locations/{self.test_location_id}", 
                200
            )
            success = success and delete_success
            
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Patient Management API Tests")
        print(f"📍 Testing against: {self.base_url}")
        
        # Basic connectivity and auth tests
        self.test_health_check()
        self.test_invalid_login()  # Test invalid login first
        
        if not self.test_login():
            print("❌ Login failed - cannot continue with authenticated tests")
            return self.generate_report()
        
        self.test_auth_verify()
        
        # Location management tests
        self.test_create_location()
        self.test_get_locations()
        
        # Patient management tests
        self.test_create_patient()
        self.test_get_patients()
        self.test_get_patient_by_id()
        self.test_update_patient()
        self.test_patient_filtering()
        
        # Visit and photo tests
        self.test_add_visit()
        self.test_add_photo()
        
        # Dashboard and reporting tests
        self.test_dashboard()
        self.test_statistics()
        self.test_calendar_status()
        self.test_export_patients()
        
        # Cleanup
        self.test_cleanup()
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\n📊 TEST REPORT")
        print(f"================")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return success_rate >= 80  # Consider 80% as acceptable

if __name__ == "__main__":
    tester = PatientManagementTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)