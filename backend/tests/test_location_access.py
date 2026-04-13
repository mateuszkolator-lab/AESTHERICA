"""
Location-Based Access Control Tests for AestheticaMD
Tests: User location assignment, filtered data access for patients/slots/dashboard/controls/stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clinic-scheduler-pro-1.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = 'mateusz.kolator@gmail.com'
ADMIN_PASSWORD = 'Matikolati123!'
TEST_USER_EMAIL = 'jan.kowalski@klinika.pl'
TEST_USER_PASSWORD = 'haslo123'

# Location IDs from the review request
LOCATION_PRO_FAMILIA = '05d9b792-07f3-43f4-ace2-89d4ec9cc57d'
LOCATION_MEDICUS = '589030c5-d58e-4ef7-a262-cd2b672bb4c8'


class TestAdminLoginLocationFields:
    """Test admin login returns global_access=true"""
    
    def test_admin_login_has_global_access(self):
        """Admin login should return global_access=true in user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        user = data["user"]
        
        # Admin should have global_access=true
        assert user.get("global_access") == True, f"Admin should have global_access=true, got: {user.get('global_access')}"
        assert user.get("role") == "admin", f"Admin should have role=admin, got: {user.get('role')}"
        
        # location_ids should be present (can be empty for admin)
        assert "location_ids" in user, "Admin user should have location_ids field"
        
        print(f"✅ Admin login: global_access={user.get('global_access')}, location_ids={user.get('location_ids')}")


class TestNonAdminLoginLocationFields:
    """Test non-admin user login returns location_ids and global_access"""
    
    def test_non_admin_login_has_location_fields(self):
        """Non-admin login should return location_ids and global_access in user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Test user login failed: {response.text}"
        
        data = response.json()
        user = data["user"]
        
        # Non-admin should have location_ids field
        assert "location_ids" in user, "User should have location_ids field"
        assert isinstance(user["location_ids"], list), "location_ids should be a list"
        
        # Non-admin should have global_access field
        assert "global_access" in user, "User should have global_access field"
        
        # Jan Kowalski should be assigned to Medicus location
        assert LOCATION_MEDICUS in user.get("location_ids", []), \
            f"Jan Kowalski should be assigned to Medicus location, got: {user.get('location_ids')}"
        
        print(f"✅ Non-admin login: location_ids={user.get('location_ids')}, global_access={user.get('global_access')}")


class TestPatientsLocationFilter:
    """Test GET /patients filtered by user's location access"""
    
    def test_admin_sees_all_patients(self, admin_token):
        """Admin should see all patients regardless of location"""
        response = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get patients: {response.text}"
        
        admin_patients = response.json()
        print(f"✅ Admin sees {len(admin_patients)} patients (all)")
        return len(admin_patients)
    
    def test_non_admin_sees_filtered_patients(self, test_user_token, admin_token):
        """Non-admin should see only patients from their location + unassigned"""
        # Get admin patient count for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_patients = admin_response.json()
        
        # Get non-admin patient count
        response = requests.get(
            f"{BASE_URL}/api/patients",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get patients: {response.text}"
        
        user_patients = response.json()
        
        # Verify filtering - user should see patients with their location OR no location
        for patient in user_patients:
            loc_id = patient.get("location_id")
            # Patient should either have Medicus location, no location, or empty location
            assert loc_id in [LOCATION_MEDICUS, None, ""], \
                f"User should only see Medicus or unassigned patients, got location_id: {loc_id}"
        
        print(f"✅ Non-admin sees {len(user_patients)} patients (filtered from {len(admin_patients)} total)")


class TestCalendarDataLocationFilter:
    """Test GET /surgery-slots/calendar-data filtered by location"""
    
    def test_admin_sees_all_slots(self, admin_token):
        """Admin should see all surgery slots"""
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots/calendar-data",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get calendar data: {response.text}"
        
        data = response.json()
        assert "slots" in data, "Response should contain slots"
        assert "unassigned_patients" in data, "Response should contain unassigned_patients"
        
        print(f"✅ Admin sees {len(data['slots'])} slots, {len(data['unassigned_patients'])} unassigned patients")
    
    def test_non_admin_sees_filtered_slots(self, test_user_token, admin_token):
        """Non-admin should see only slots from their location"""
        # Get admin data for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/surgery-slots/calendar-data",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_data = admin_response.json()
        
        # Get non-admin data
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots/calendar-data",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get calendar data: {response.text}"
        
        user_data = response.json()
        
        # Verify slots are filtered by location
        for slot in user_data.get("slots", []):
            loc_id = slot.get("location_id")
            # Slot should be from Medicus location
            assert loc_id == LOCATION_MEDICUS, \
                f"User should only see Medicus slots, got location_id: {loc_id}"
        
        print(f"✅ Non-admin sees {len(user_data.get('slots', []))} slots (filtered from {len(admin_data.get('slots', []))} total)")


class TestDashboardLocationFilter:
    """Test GET /dashboard filtered by location access"""
    
    def test_admin_dashboard(self, admin_token):
        """Admin dashboard should show all data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        data = response.json()
        assert "upcoming_surgeries" in data
        assert "recent_patients" in data
        assert "stats" in data
        
        print(f"✅ Admin dashboard: {data['stats']['total']} total patients")
    
    def test_non_admin_dashboard_filtered(self, test_user_token, admin_token):
        """Non-admin dashboard should show filtered data"""
        # Get admin stats for comparison
        admin_response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_data = admin_response.json()
        
        # Get non-admin dashboard
        response = requests.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        user_data = response.json()
        
        # Non-admin should see equal or fewer patients
        assert user_data["stats"]["total"] <= admin_data["stats"]["total"], \
            "Non-admin should see equal or fewer patients than admin"
        
        print(f"✅ Non-admin dashboard: {user_data['stats']['total']} patients (admin sees {admin_data['stats']['total']})")


class TestControlsLocationFilter:
    """Test GET /controls/patients filtered by location access"""
    
    def test_admin_controls(self, admin_token):
        """Admin should see all patients with controls"""
        response = requests.get(
            f"{BASE_URL}/api/controls/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get controls: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin controls: {len(data)} patients with controls")
    
    def test_non_admin_controls_filtered(self, test_user_token, admin_token):
        """Non-admin should see filtered controls"""
        # Get admin data
        admin_response = requests.get(
            f"{BASE_URL}/api/controls/patients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_data = admin_response.json()
        
        # Get non-admin data
        response = requests.get(
            f"{BASE_URL}/api/controls/patients",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get controls: {response.text}"
        
        user_data = response.json()
        
        # Non-admin should see equal or fewer patients
        assert len(user_data) <= len(admin_data), \
            "Non-admin should see equal or fewer patients than admin"
        
        print(f"✅ Non-admin controls: {len(user_data)} patients (admin sees {len(admin_data)})")


class TestStatsLocationFilter:
    """Test GET /stats filtered by location access"""
    
    def test_admin_stats(self, admin_token):
        """Admin should see all stats"""
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_patients" in data
        assert "by_status" in data
        
        print(f"✅ Admin stats: {data['total_patients']} total patients")
    
    def test_non_admin_stats_filtered(self, test_user_token, admin_token):
        """Non-admin should see filtered stats"""
        # Get admin stats
        admin_response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_data = admin_response.json()
        
        # Get non-admin stats
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        user_data = response.json()
        
        # Non-admin should see equal or fewer patients
        assert user_data["total_patients"] <= admin_data["total_patients"], \
            "Non-admin should see equal or fewer patients than admin"
        
        print(f"✅ Non-admin stats: {user_data['total_patients']} patients (admin sees {admin_data['total_patients']})")


class TestUserUpdateLocationFields:
    """Test PUT /users/{id} with location_ids and global_access fields"""
    
    def test_update_user_location_ids(self, admin_token):
        """Admin can update user's location_ids"""
        # First get the test user's ID
        users_response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert users_response.status_code == 200
        
        users = users_response.json()
        test_user = next((u for u in users if u["email"] == TEST_USER_EMAIL), None)
        assert test_user is not None, f"Test user {TEST_USER_EMAIL} not found"
        
        original_location_ids = test_user.get("location_ids", [])
        original_global_access = test_user.get("global_access", False)
        
        # Update with both locations
        update_response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}",
            json={
                "location_ids": [LOCATION_MEDICUS, LOCATION_PRO_FAMILIA],
                "global_access": False
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_response.status_code == 200, f"Failed to update user: {update_response.text}"
        
        updated_user = update_response.json()
        assert LOCATION_MEDICUS in updated_user.get("location_ids", [])
        assert LOCATION_PRO_FAMILIA in updated_user.get("location_ids", [])
        
        print(f"✅ User location_ids updated: {updated_user.get('location_ids')}")
        
        # Restore original state
        restore_response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}",
            json={
                "location_ids": original_location_ids,
                "global_access": original_global_access
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert restore_response.status_code == 200
        print(f"✅ User location_ids restored to: {original_location_ids}")
    
    def test_update_user_global_access(self, admin_token):
        """Admin can update user's global_access flag"""
        # Get test user
        users_response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()
        test_user = next((u for u in users if u["email"] == TEST_USER_EMAIL), None)
        assert test_user is not None
        
        original_global_access = test_user.get("global_access", False)
        
        # Set global_access to true
        update_response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}",
            json={"global_access": True},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_response.status_code == 200, f"Failed to update user: {update_response.text}"
        
        updated_user = update_response.json()
        assert updated_user.get("global_access") == True
        
        print(f"✅ User global_access set to True")
        
        # Restore original state
        restore_response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}",
            json={"global_access": original_global_access},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert restore_response.status_code == 200
        print(f"✅ User global_access restored to: {original_global_access}")


class TestSurgerySlotsLocationFilter:
    """Test GET /surgery-slots filtered by location"""
    
    def test_admin_sees_all_slots(self, admin_token):
        """Admin should see all surgery slots"""
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get slots: {response.text}"
        
        slots = response.json()
        print(f"✅ Admin sees {len(slots)} surgery slots")
    
    def test_non_admin_sees_filtered_slots(self, test_user_token, admin_token):
        """Non-admin should see only slots from their location"""
        # Get admin slots
        admin_response = requests.get(
            f"{BASE_URL}/api/surgery-slots",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        admin_slots = admin_response.json()
        
        # Get non-admin slots
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200, f"Failed to get slots: {response.text}"
        
        user_slots = response.json()
        
        # Verify filtering
        for slot in user_slots:
            loc_id = slot.get("location_id")
            assert loc_id == LOCATION_MEDICUS, \
                f"User should only see Medicus slots, got location_id: {loc_id}"
        
        print(f"✅ Non-admin sees {len(user_slots)} slots (filtered from {len(admin_slots)} total)")


class TestSuggestions:
    """Test GET /surgery-slots/suggestions filtered by location"""
    
    def test_suggestions_endpoint(self, admin_token):
        """Test suggestions endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/surgery-slots/suggestions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get suggestions: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Suggestions endpoint working: {len(data)} suggestions")


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
