"""
Comprehensive API tests for AestheticaMD
Tests: Auth, Users, Dashboard, Controls, Audit, Patients
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clinic-scheduler-pro-1.preview.emergentagent.com').rstrip('/')

# Test credentials from environment
ADMIN_EMAIL = os.getenv('TEST_ADMIN_EMAIL', 'mateusz.kolator@gmail.com')
ADMIN_PASSWORD = os.getenv('TEST_ADMIN_PASSWORD', 'Matikolati123!')
TEST_USER_EMAIL = os.getenv('TEST_USER_EMAIL', 'jan.kowalski@klinika.pl')
TEST_USER_PASSWORD = os.getenv('TEST_USER_PASSWORD', 'haslo123')


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_admin_success(self):
        """Test admin login returns token and user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert "id" in data["user"]
        assert "first_name" in data["user"]
        assert "last_name" in data["user"]
        print(f"✅ Admin login successful: {data['user']['first_name']} {data['user']['last_name']}")
    
    def test_login_test_user_success(self):
        """Test regular user login returns token and user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert data["user"]["role"] == "doctor"
        print(f"✅ Test user login successful: {data['user']['first_name']} {data['user']['last_name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_verify_token(self, admin_token):
        """Test token verification endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "valid"
        assert "user" in data
        print("✅ Token verification successful")


class TestUsersEndpoints:
    """Users management endpoint tests (admin only)"""
    
    def test_get_users_list_admin(self, admin_token):
        """Test GET /users/ returns users list for admin"""
        response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least one user"
        
        # Verify user structure
        user = data[0]
        assert "id" in user
        assert "email" in user
        assert "first_name" in user
        assert "last_name" in user
        assert "role" in user
        assert "is_active" in user
        print(f"✅ Users list retrieved: {len(data)} users")
    
    def test_get_users_list_non_admin_forbidden(self, test_user_token):
        """Test GET /users/ returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Non-admin correctly forbidden from users list")
    
    def test_get_current_user(self, admin_token):
        """Test GET /users/me returns current user info"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print("✅ Current user info retrieved")


class TestDashboardEndpoints:
    """Dashboard endpoint tests"""
    
    def test_get_dashboard(self, admin_token):
        """Test GET /dashboard returns dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "upcoming_surgeries" in data, "Should have upcoming_surgeries"
        assert "recent_patients" in data, "Should have recent_patients"
        assert "stats" in data, "Should have stats"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "operated" in stats
        assert "planned" in stats
        assert "awaiting" in stats
        assert "consultation" in stats
        print(f"✅ Dashboard data retrieved: {stats['total']} total patients")
    
    def test_get_stats(self, admin_token):
        """Test GET /stats returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_patients" in data
        assert "by_status" in data
        print(f"✅ Stats retrieved: {data['total_patients']} total patients")


class TestControlsEndpoints:
    """Post-operative controls endpoint tests"""
    
    def test_get_controls_patients(self, admin_token):
        """Test GET /controls/patients returns patients with controls"""
        response = requests.get(
            f"{BASE_URL}/api/controls/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are patients, verify structure
        if len(data) > 0:
            patient = data[0]
            assert "id" in patient
            assert "first_name" in patient
            assert "last_name" in patient
            assert "surgery_date" in patient
            assert "controls" in patient
            assert isinstance(patient["controls"], list)
            print(f"✅ Controls patients retrieved: {len(data)} patients")
        else:
            print("✅ Controls patients endpoint working (no operated patients yet)")


class TestAuditEndpoints:
    """Audit log endpoint tests"""
    
    def test_get_recent_audit_logs(self, admin_token):
        """Test GET /audit/recent returns recent audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/audit/recent",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            entry = data[0]
            assert "id" in entry
            assert "patient_id" in entry
            assert "action" in entry
            assert "timestamp" in entry
            print(f"✅ Recent audit logs retrieved: {len(data)} entries")
        else:
            print("✅ Audit logs endpoint working (no entries yet)")


class TestPatientsEndpoints:
    """Patients CRUD endpoint tests"""
    
    def test_get_patients_list(self, admin_token):
        """Test GET /patients returns patients list"""
        response = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Patients list retrieved: {len(data)} patients")
    
    def test_create_and_get_patient(self, admin_token):
        """Test POST /patients creates patient and GET retrieves it"""
        # Create patient
        patient_data = {
            "first_name": "TEST_Jan",
            "last_name": "TEST_Testowy",
            "email": "test_jan@test.pl",
            "phone": "+48123456789",
            "procedure_type": "Rhinoplastyka",
            "status": "consultation"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/patients",
            json=patient_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200, f"Expected 200, got {create_response.status_code}: {create_response.text}"
        
        created = create_response.json()
        assert "id" in created, "Response should contain patient id"
        patient_id = created["id"]
        print(f"✅ Patient created: {patient_id}")
        
        # Get patient to verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["id"] == patient_id
        assert fetched["first_name"] == patient_data["first_name"]
        assert fetched["last_name"] == patient_data["last_name"]
        print(f"✅ Patient retrieved and verified: {fetched['first_name']} {fetched['last_name']}")
        
        # Cleanup - delete test patient
        delete_response = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200
        print(f"✅ Test patient cleaned up")


class TestCalendarEndpoints:
    """Calendar and surgery slots endpoint tests"""
    
    def test_get_surgery_slots(self, admin_token):
        """Test GET /surgery-slots returns slots"""
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Surgery slots retrieved: {len(data)} slots")
    
    def test_get_calendar_data(self, admin_token):
        """Test GET /surgery-slots/calendar-data returns calendar data"""
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots/calendar-data",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "slots" in data or "unassigned_patients" in data
        print("✅ Calendar data retrieved")


class TestLocationsEndpoints:
    """Locations endpoint tests"""
    
    def test_get_locations(self, admin_token):
        """Test GET /locations returns locations list"""
        response = requests.get(
            f"{BASE_URL}/api/locations",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Locations retrieved: {len(data)} locations")


# Fixtures
@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return response.json()["token"]


@pytest.fixture(scope="module")
def test_user_token():
    """Get test user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Test user login failed: {response.status_code} - {response.text}")
    return response.json()["token"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
