"""
12 pytest tests for NGO dashboard endpoints.

Runs against the Flask test client — no live Firestore or Vertex AI required.
All Firestore calls are patched out via monkeypatch / MagicMock so the suite
runs fully offline.

Usage:
    pytest tests/test_ngo_dashboard.py -v
"""

import json
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def app():
    """Return a Flask test app with Firestore mocked out."""
    with patch("backend.main.firestore", None), \
         patch("backend.main.db", None):
        from backend.main import app as flask_app
        flask_app.config["TESTING"] = True
        yield flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NGO_PAYLOAD = {
    "name": "Relief India",
    "contact": "Priya Sharma",
    "zone": "Nashik",
    "resource_types": ["Boats", "Medical"],
}

RESOURCE_PAYLOAD = {
    "resource_id": "BOAT_NK_01",
    "ngo_id": "NGO_RELIEF_INDIA",
    "type": "boat",
    "name": "Rescue Boat Alpha",
    "capacity": 12,
    "lat": 19.9975,
    "lng": 73.7898,
    "status": "available",
    "battery_pct": 100,
    "speed": 0,
    "heading": 0,
}


# ===========================================================================
# TEST 1: Health check
# ===========================================================================

def test_health_check(client):
    """Health endpoint returns 200 and status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] in ("ok", "healthy")


# ===========================================================================
# TEST 2: NGO registration — valid payload
# ===========================================================================

def test_ngo_register_success(client):
    """POST /api/v1/ngos/register returns ngo_id and colour."""
    resp = client.post(
        "/api/v1/ngos/register",
        data=json.dumps(NGO_PAYLOAD),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "ngo_id" in data
    assert "colour" in data
    assert data["ngo_id"].startswith("NGO_")


# ===========================================================================
# TEST 3: NGO registration — missing required field
# ===========================================================================

def test_ngo_register_missing_field(client):
    """POST /api/v1/ngos/register without 'name' returns 400."""
    bad = {k: v for k, v in NGO_PAYLOAD.items() if k != "name"}
    resp = client.post(
        "/api/v1/ngos/register",
        data=json.dumps(bad),
        content_type="application/json",
    )
    assert resp.status_code == 400


# ===========================================================================
# TEST 4: List NGOs (mock mode)
# ===========================================================================

def test_list_ngos(client):
    """GET /api/v1/ngos returns a list (may be empty in mock mode)."""
    resp = client.get("/api/v1/ngos")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "ngos" in data
    assert isinstance(data["ngos"], list)


# ===========================================================================
# TEST 5: Add resource — valid payload
# ===========================================================================

def test_add_resource_success(client):
    """POST /api/v1/resources returns 201 with resource_id echo."""
    resp = client.post(
        "/api/v1/resources",
        data=json.dumps(RESOURCE_PAYLOAD),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data.get("resource_id") == RESOURCE_PAYLOAD["resource_id"]


# ===========================================================================
# TEST 6: Add resource — invalid lat/lng
# ===========================================================================

def test_add_resource_bad_coords(client):
    """POST /api/v1/resources with missing required field returns 400."""
    bad = {k: v for k, v in RESOURCE_PAYLOAD.items() if k not in ("lat", "lng", "resource_id")}
    resp = client.post(
        "/api/v1/resources",
        data=json.dumps(bad),
        content_type="application/json",
    )
    assert resp.status_code == 400


# ===========================================================================
# TEST 7: List resources
# ===========================================================================

def test_list_resources(client):
    """GET /api/v1/resources returns resources list."""
    resp = client.get("/api/v1/resources")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "resources" in data


# ===========================================================================
# TEST 8: Assign resource to crisis
# ===========================================================================

def test_assign_resource_to_crisis(client):
    """POST /api/v1/crises/:id/assignments returns 201 with assigned status."""
    resp = client.post(
        "/api/v1/crises/NK-001/assignments",
        data=json.dumps({"resource_id": "BOAT_NK_01", "ngo_id": "NGO_RELIEF_INDIA"}),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data.get("status") == "assigned"


# ===========================================================================
# TEST 9: Coverage zones — create
# ===========================================================================

def test_create_coverage_zone(client):
    """POST /api/v1/coverage-zones returns 201."""
    zone_payload = {
        "ngo_id": "NGO_RELIEF_INDIA",
        "zone_name": "North Nashik",
        "polygon_coords": [
            [19.95, 73.75],
            [20.05, 73.75],
            [20.05, 73.85],
            [19.95, 73.85],
        ],
    }
    resp = client.post(
        "/api/v1/coverage-zones",
        data=json.dumps(zone_payload),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "zone_id" in data


# ===========================================================================
# TEST 10: Gap analysis endpoint
# ===========================================================================

def test_gap_analysis(client):
    """GET /api/v1/gaps returns gaps list with correct shape."""
    resp = client.get("/api/v1/gaps")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "gaps" in data
    assert "count" in data
    assert data["count"] == len(data["gaps"])


# ===========================================================================
# TEST 11: AI ask endpoint — streaming SSE
# ===========================================================================

def test_ai_ask_streaming(client):
    """POST /api/v1/ai/ask returns text/event-stream with data: prefix."""
    resp = client.post(
        "/api/v1/ai/ask",
        data=json.dumps({"question": "What are the biggest coverage gaps?"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.content_type
    body = resp.data.decode()
    assert body.startswith("data:")
    payload = json.loads(body.replace("data:", "").strip())
    assert "answer" in payload


# ===========================================================================
# TEST 12: Ops summary report
# ===========================================================================

def test_ops_summary(client):
    """GET /api/v1/reports/ops-summary returns expected keys."""
    resp = client.get("/api/v1/reports/ops-summary")
    assert resp.status_code == 200
    data = resp.get_json()
    for key in ("crises_handled", "people_reached", "ngos_active", "resources_deployed", "coverage_gaps"):
        assert key in data, f"Missing key: {key}"


# ===========================================================================
# TEST 13-20: New heatmap endpoints + NGO features
# ===========================================================================

def test_heatmap_resource_density(client):
    """GET /api/v1/heatmap/resource-density returns points list."""
    resp = client.get("/api/v1/heatmap/resource-density")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "points" in data
    assert "grid_resolution_km" in data
    assert "generated_at" in data


def test_heatmap_population_risk(client):
    """GET /api/v1/heatmap/population-risk returns points list."""
    resp = client.get("/api/v1/heatmap/population-risk")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "points" in data


def test_heatmap_response_time(client):
    """GET /api/v1/heatmap/response-time returns points list."""
    resp = client.get("/api/v1/heatmap/response-time")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "points" in data


def test_heatmap_temporal(client):
    """GET /api/v1/heatmap/temporal returns slices list."""
    resp = client.get("/api/v1/heatmap/temporal?hours=24&slices=6")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "slices" in data
    assert data["slice_count"] == 6
    assert len(data["slices"]) == 6
    for s in data["slices"]:
        assert "hotspots" in s
        assert "label" in s


def test_ngo_stats(client):
    """GET /api/v1/ngo-stats returns list with expected keys."""
    resp = client.get("/api/v1/ngo-stats")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "stats" in data
    for stat in data["stats"]:
        for key in ("ngo_id", "coverage_pct", "response_time_avg", "people_reached"):
            assert key in stat, f"Missing key in stat: {key}"


def test_mutual_aid_create(client):
    """POST /api/v1/mutual-aid/requests creates a request."""
    payload = {
        "from_ngo": "NGO_RELIEF_INDIA",
        "to_ngo": "NGO_MEDAID_MH",
        "resource_type": "medical",
        "quantity": 2,
        "message": "Need medical support urgently",
    }
    resp = client.post(
        "/api/v1/mutual-aid/requests",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["status"] == "pending"
    assert "request_id" in data


def test_mutual_aid_missing_fields(client):
    """POST /api/v1/mutual-aid/requests with missing fields returns 400."""
    resp = client.post(
        "/api/v1/mutual-aid/requests",
        data=json.dumps({"from_ngo": "NGO_A"}),
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_route_plan(client):
    """GET /api/v1/routes/plan returns waypoints + ETA."""
    resp = client.get("/api/v1/routes/plan?resource_id=BOAT_NK_01&crisis_id=NK-001")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "waypoints" in data
    assert "eta_minutes" in data
    assert "distance_km" in data
    assert len(data["waypoints"]) >= 2


def test_route_plan_missing_params(client):
    """GET /api/v1/routes/plan without params returns 400."""
    resp = client.get("/api/v1/routes/plan?resource_id=BOAT_NK_01")
    assert resp.status_code == 400
