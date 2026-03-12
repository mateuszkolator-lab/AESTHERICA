import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

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
        "password": "Matikolati123!"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed — skipping authenticated tests")

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

@pytest.fixture
def test_patient_data():
    """Generate unique test patient data"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    return {
        "first_name": f"TEST_{unique_id}",
        "last_name": f"Patient_{unique_id}",
        "email": f"test_{unique_id}@example.com",
        "phone": "+48123456789",
        "status": "consultation",
        "procedure_type": "Rhinoplastyka",
        "notes": f"Test patient {unique_id}"
    }

@pytest.fixture
def test_location_data():
    """Generate unique test location data"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    return {
        "name": f"TEST_Location_{unique_id}",
        "address": f"ul. Testowa {unique_id}"
    }

@pytest.fixture
def test_procedure_type_data():
    """Generate unique test procedure type data"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    return {
        "name": f"TEST_Procedure_{unique_id}",
        "description": f"Test procedure {unique_id}",
        "default_price": 5000.0
    }

@pytest.fixture
def test_surgery_slot_data():
    """Generate unique test surgery slot data"""
    from datetime import datetime, timedelta
    future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    return {
        "date": future_date,
        "notes": "Test surgery slot"
    }
