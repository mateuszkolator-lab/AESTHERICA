"""
RhinoPlanner API Tests
Tests for the rhinoplasty planning feature API endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test patient ID from agent context
TEST_PATIENT_ID = "e1778a07-50f5-41d0-8c2e-5675ae5b6a63"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "password": os.getenv('TEST_ADMIN_PASSWORD', 'Matikolati123!')
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed — skipping authenticated tests")


class TestRhinoPlannerAPI:
    """Tests for RhinoPlanner API endpoints"""
    
    def test_get_patient_rhino_plan(self, api_client):
        """Test GET /api/rhinoplanner/patient/{patient_id} returns plan or null"""
        response = api_client.get(f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}")
        assert response.status_code == 200
        
        # Response can be null (no plan) or plan object
        data = response.json()
        if data is not None:
            # Validate structure
            assert "patient_id" in data
            assert data["patient_id"] == TEST_PATIENT_ID
            assert "canvas_frontal" in data
            assert "canvas_profile" in data
            assert "canvas_base" in data
            assert "procedures" in data
            assert "notes" in data
            assert "surgeon_notes" in data
    
    def test_put_rhino_plan_update(self, api_client):
        """Test PUT /api/rhinoplanner/patient/{patient_id} - creates or updates plan"""
        unique_note = f"TEST_NOTES_{uuid.uuid4().hex[:8]}"
        
        plan_data = {
            "canvas_frontal": '{"version":"6.0.0","objects":[]}',
            "canvas_profile": None,
            "canvas_base": None,
            "procedures": [
                {"category": "Grzbiet nosa", "items": ["Redukcja garbka"]},
                {"category": "Czubek nosa", "items": ["Zmniejszenie czubka"]}
            ],
            "notes": unique_note,
            "surgeon_notes": f"Surgeon {unique_note}"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=plan_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["patient_id"] == TEST_PATIENT_ID
        assert data["notes"] == unique_note
        assert len(data["procedures"]) == 2
        
        # Verify by GET
        get_response = api_client.get(f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["notes"] == unique_note
    
    def test_put_rhino_plan_procedures_structure(self, api_client):
        """Test that procedures are correctly stored and retrieved"""
        test_procedures = [
            {"category": "Przegroda nosowa", "items": ["Korekcja przegrody", "Pobranie chrząstki"]},
            {"category": "Kolumella", "items": ["Strut graft"]}
        ]
        
        plan_data = {
            "procedures": test_procedures,
            "notes": "Procedure structure test"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=plan_data
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify procedure categories
        categories = [p["category"] for p in data["procedures"]]
        assert "Przegroda nosowa" in categories
        assert "Kolumella" in categories
        
        # Verify items
        przegroda = next(p for p in data["procedures"] if p["category"] == "Przegroda nosowa")
        assert "Korekcja przegrody" in przegroda["items"]
        assert "Pobranie chrząstki" in przegroda["items"]
    
    def test_get_all_rhino_plans(self, api_client):
        """Test GET /api/rhinoplanner/all returns list of plans"""
        response = api_client.get(f"{BASE_URL}/api/rhinoplanner/all")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have at least the test patient's plan
        patient_ids = [p["patient_id"] for p in data]
        assert TEST_PATIENT_ID in patient_ids
    
    def test_get_nonexistent_patient_plan(self, api_client):
        """Test GET for non-existent patient returns null"""
        fake_patient_id = f"nonexistent-{uuid.uuid4()}"
        response = api_client.get(f"{BASE_URL}/api/rhinoplanner/patient/{fake_patient_id}")
        assert response.status_code == 200
        assert response.json() is None
    
    def test_put_with_canvas_data(self, api_client):
        """Test PUT with canvas JSON data"""
        canvas_data = '{"version":"6.0.0","objects":[{"type":"rect","left":100,"top":100}]}'
        
        plan_data = {
            "canvas_frontal": canvas_data,
            "canvas_profile": '{"version":"6.0.0","objects":[]}',
            "canvas_base": None,
            "notes": "Canvas test"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=plan_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["canvas_frontal"] == canvas_data
        assert data["canvas_profile"] == '{"version":"6.0.0","objects":[]}'
    
    def test_put_partial_update(self, api_client):
        """Test PUT only updates provided fields"""
        # First set a known state
        initial_data = {
            "notes": "Initial notes",
            "surgeon_notes": "Initial surgeon notes"
        }
        api_client.put(f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}", json=initial_data)
        
        # Update only notes
        partial_data = {
            "notes": "Updated notes only"
        }
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=partial_data
        )
        assert response.status_code == 200
        
        # Verify notes updated but surgeon_notes unchanged
        data = response.json()
        assert data["notes"] == "Updated notes only"
        # surgeon_notes should remain from initial (not overwritten to null)


class TestRhinoPlannerEdgeCases:
    """Edge case tests for RhinoPlanner"""
    
    def test_empty_procedures_list(self, api_client):
        """Test that empty procedures list is valid"""
        plan_data = {
            "procedures": [],
            "notes": "Empty procedures test"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=plan_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["procedures"] == []
    
    def test_special_characters_in_notes(self, api_client):
        """Test notes with Polish special characters"""
        special_notes = "Pacjent wymaga korekcji grzbietu nosa. Żądania: zmniejszenie, wyszczuplenie."
        
        plan_data = {
            "notes": special_notes,
            "surgeon_notes": "Notatki chirurga: ąęółżźćń"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/rhinoplanner/patient/{TEST_PATIENT_ID}",
            json=plan_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["notes"] == special_notes
        assert "ąęółżźćń" in data["surgeon_notes"]
