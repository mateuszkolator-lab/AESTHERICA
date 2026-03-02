import pytest
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('')


class TestLocations:
    """Test locations CRUD endpoints"""
    
    def test_get_locations_list(self, authenticated_client):
        """Test getting locations list"""
        response = authenticated_client.get(f"{BASE_URL}/api/locations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_location(self, authenticated_client, test_location_data):
        """Test creating a new location"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/locations",
            json=test_location_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        location_id = data["id"]
        
        # Verify location was created
        get_response = authenticated_client.get(f"{BASE_URL}/api/locations")
        locations = get_response.json()
        created_location = next((l for l in locations if l["id"] == location_id), None)
        assert created_location is not None
        assert created_location["name"] == test_location_data["name"]
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/locations/{location_id}")
    
    def test_update_location(self, authenticated_client, test_location_data):
        """Test updating a location"""
        # Create location first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/locations",
            json=test_location_data
        )
        location_id = create_response.json()["id"]
        
        # Update location
        update_data = {"name": "Updated Location Name", "address": "Updated Address"}
        update_response = authenticated_client.put(
            f"{BASE_URL}/api/locations/{location_id}",
            json=update_data
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = authenticated_client.get(f"{BASE_URL}/api/locations")
        locations = get_response.json()
        updated_location = next((l for l in locations if l["id"] == location_id), None)
        assert updated_location["name"] == "Updated Location Name"
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/locations/{location_id}")
    
    def test_delete_location(self, authenticated_client, test_location_data):
        """Test deleting a location"""
        # Create location first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/locations",
            json=test_location_data
        )
        location_id = create_response.json()["id"]
        
        # Delete location
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/locations/{location_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/locations")
        locations = get_response.json()
        assert not any(l["id"] == location_id for l in locations)


class TestProcedureTypes:
    """Test procedure types CRUD endpoints"""
    
    def test_get_procedure_types_list(self, authenticated_client):
        """Test getting procedure types list"""
        response = authenticated_client.get(f"{BASE_URL}/api/procedure-types")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_procedure_type(self, authenticated_client, test_procedure_type_data):
        """Test creating a new procedure type"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/procedure-types",
            json=test_procedure_type_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        procedure_type_id = data["id"]
        
        # Verify procedure type was created
        get_response = authenticated_client.get(f"{BASE_URL}/api/procedure-types")
        procedure_types = get_response.json()
        created_pt = next((pt for pt in procedure_types if pt["id"] == procedure_type_id), None)
        assert created_pt is not None
        assert created_pt["name"] == test_procedure_type_data["name"]
        assert created_pt["default_price"] == test_procedure_type_data["default_price"]
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/procedure-types/{procedure_type_id}")
    
    def test_delete_procedure_type(self, authenticated_client, test_procedure_type_data):
        """Test deleting a procedure type"""
        # Create procedure type first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/procedure-types",
            json=test_procedure_type_data
        )
        procedure_type_id = create_response.json()["id"]
        
        # Delete procedure type
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/procedure-types/{procedure_type_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/procedure-types")
        procedure_types = get_response.json()
        assert not any(pt["id"] == procedure_type_id for pt in procedure_types)


class TestSurgerySlots:
    """Test surgery slots CRUD endpoints"""
    
    def test_get_surgery_slots_list(self, authenticated_client):
        """Test getting surgery slots list"""
        response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_surgery_slot(self, authenticated_client, test_surgery_slot_data):
        """Test creating a new surgery slot"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/surgery-slots",
            json=test_surgery_slot_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        slot_id = data["id"]
        
        # Verify slot was created
        get_response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots?include_past=true")
        slots = get_response.json()
        created_slot = next((s for s in slots if s["id"] == slot_id), None)
        assert created_slot is not None
        assert created_slot["date"] == test_surgery_slot_data["date"]
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/surgery-slots/{slot_id}")
    
    def test_duplicate_slot_date_fails(self, authenticated_client, test_surgery_slot_data):
        """Test that creating duplicate slot for same date fails"""
        # Create first slot
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/surgery-slots",
            json=test_surgery_slot_data
        )
        slot_id = create_response.json()["id"]
        
        # Try to create duplicate
        duplicate_response = authenticated_client.post(
            f"{BASE_URL}/api/surgery-slots",
            json=test_surgery_slot_data
        )
        assert duplicate_response.status_code == 400
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/surgery-slots/{slot_id}")
    
    def test_toggle_slot_full_status(self, authenticated_client, test_surgery_slot_data):
        """Test toggling slot full status"""
        # Create slot first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/surgery-slots",
            json=test_surgery_slot_data
        )
        slot_id = create_response.json()["id"]
        
        # Toggle full status
        toggle_response = authenticated_client.post(f"{BASE_URL}/api/surgery-slots/{slot_id}/toggle-full")
        assert toggle_response.status_code == 200
        
        # Verify status changed
        get_response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots?include_past=true")
        slots = get_response.json()
        slot = next((s for s in slots if s["id"] == slot_id), None)
        assert slot["is_full"] == True
        
        # Toggle back
        authenticated_client.post(f"{BASE_URL}/api/surgery-slots/{slot_id}/toggle-full")
        get_response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots?include_past=true")
        slots = get_response.json()
        slot = next((s for s in slots if s["id"] == slot_id), None)
        assert slot["is_full"] == False
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/surgery-slots/{slot_id}")
    
    def test_delete_surgery_slot(self, authenticated_client, test_surgery_slot_data):
        """Test deleting a surgery slot"""
        # Create slot first
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/surgery-slots",
            json=test_surgery_slot_data
        )
        slot_id = create_response.json()["id"]
        
        # Delete slot
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/surgery-slots/{slot_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots?include_past=true")
        slots = get_response.json()
        assert not any(s["id"] == slot_id for s in slots)
    
    def test_get_calendar_data(self, authenticated_client):
        """Test getting calendar data"""
        response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots/calendar-data")
        assert response.status_code == 200
        data = response.json()
        assert "slots" in data
        assert "unassigned_patients" in data
    
    def test_get_suggestions(self, authenticated_client):
        """Test getting slot suggestions"""
        response = authenticated_client.get(f"{BASE_URL}/api/surgery-slots/suggestions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestStatsAndDashboard:
    """Test stats and dashboard endpoints"""
    
    def test_get_dashboard(self, authenticated_client):
        """Test getting dashboard data"""
        response = authenticated_client.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "upcoming_surgeries" in data
        assert "recent_patients" in data
        assert "total" in data["stats"]
        assert "operated" in data["stats"]
        assert "planned" in data["stats"]
        assert "awaiting" in data["stats"]
    
    def test_get_stats(self, authenticated_client):
        """Test getting stats"""
        response = authenticated_client.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_patients" in data
        assert "by_status" in data
        assert "procedures_by_month" in data
    
    def test_get_stats_by_year(self, authenticated_client):
        """Test getting stats for specific year"""
        response = authenticated_client.get(f"{BASE_URL}/api/stats?year=2026")
        assert response.status_code == 200
        data = response.json()
        assert "total_patients" in data
    
    def test_get_calendar_status(self, authenticated_client):
        """Test getting Google Calendar status"""
        response = authenticated_client.get(f"{BASE_URL}/api/calendar/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "message" in data
