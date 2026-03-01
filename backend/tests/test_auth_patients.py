import pytest
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('')


class TestAuthentication:
    """Test auth endpoints"""
    
    def test_login_with_valid_password(self, api_client):
        """Test login with correct password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "password": "doctor2024"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 0
    
    def test_login_with_invalid_password(self, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    def test_verify_token(self, authenticated_client):
        """Test token verification"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/verify")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "valid"
        assert "user" in data
    
    def test_verify_invalid_token(self, api_client):
        """Test invalid token"""
        api_client.headers.update({"Authorization": "Bearer invalid_token_123"})
        response = api_client.get(f"{BASE_URL}/api/auth/verify")
        assert response.status_code == 401


class TestPatients:
    """Test patients CRUD endpoints"""
    
    def test_get_patients_list(self, authenticated_client):
        """Test getting patients list"""
        response = authenticated_client.get(f"{BASE_URL}/api/patients")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_patient(self, authenticated_client, test_patient_data):
        """Test creating a new patient"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/patients",
            json=test_patient_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        patient_id = data["id"]
        
        # Verify patient was created by fetching it
        get_response = authenticated_client.get(f"{BASE_URL}/api/patients/{patient_id}")
        assert get_response.status_code == 200
        patient_data = get_response.json()
        assert patient_data["first_name"] == test_patient_data["first_name"]
        assert patient_data["last_name"] == test_patient_data["last_name"]
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
    
    def test_update_patient(self, authenticated_client, test_patient_data):
        """Test updating a patient"""
        # Create patient first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/patients",
            json=test_patient_data
        )
        patient_id = create_response.json()["id"]
        
        # Update patient
        update_data = {"notes": "Updated test notes"}
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/patients/{patient_id}",
            json=update_data
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = authenticated_client.get(f"{BASE_URL}/api/patients/{patient_id}")
        assert get_response.json()["notes"] == "Updated test notes"
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
    
    def test_delete_patient(self, authenticated_client, test_patient_data):
        """Test deleting a patient"""
        # Create patient first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/patients",
            json=test_patient_data
        )
        patient_id = create_response.json()["id"]
        
        # Delete patient
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/patients/{patient_id}")
        assert get_response.status_code == 404
    
    def test_filter_patients_by_status(self, authenticated_client):
        """Test filtering patients by status"""
        response = authenticated_client.get(f"{BASE_URL}/api/patients?status=consultation")
        assert response.status_code == 200
        data = response.json()
        for patient in data:
            assert patient["status"] == "consultation"
    
    def test_get_nonexistent_patient(self, authenticated_client):
        """Test getting a patient that doesn't exist"""
        response = authenticated_client.get(f"{BASE_URL}/api/patients/nonexistent-id")
        assert response.status_code == 404


class TestPatientVisits:
    """Test patient visits endpoints"""
    
    def test_add_visit_to_patient(self, authenticated_client, test_patient_data):
        """Test adding a visit to a patient"""
        # Create patient first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/patients",
            json=test_patient_data
        )
        patient_id = create_response.json()["id"]
        
        # Add visit
        visit_data = {
            "date": "2026-03-15",
            "type": "consultation",
            "notes": "Test visit"
        }
        visit_response = authenticated_client.post(
            f"{BASE_URL}/api/patients/{patient_id}/visits",
            json=visit_data
        )
        assert visit_response.status_code == 200
        visit_id = visit_response.json()["id"]
        
        # Verify visit was added
        get_response = authenticated_client.get(f"{BASE_URL}/api/patients/{patient_id}")
        patient_data = get_response.json()
        assert len(patient_data["visits"]) > 0
        assert any(v["id"] == visit_id for v in patient_data["visits"])
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/patients/{patient_id}")
