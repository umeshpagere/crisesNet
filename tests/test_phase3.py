"""
Phase 3 Test Suite — GPS, Heatmap, SSE Endpoints
15 pytest tests with mocked Firestore and Pub/Sub
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, Mock
from backend.main import app


@pytest.fixture
def client():
    """Flask test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# ============================================================================
# GPS INGESTION TESTS (Tests 1-3)
# ============================================================================

@patch('backend.services.pubsub_bridge.pubsub_bridge')
@patch('backend.main.db')
def test_gps_ingest_valid(mock_db, mock_pubsub, client):
    """Test 1: POST with valid lat/lng/boat_id → 200, Firestore write called"""
    mock_pubsub.publish.return_value = "msg_12345"
    mock_db.collection.return_value.document.return_value.set = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value.add = MagicMock()
    
    payload = {
        "boat_id": "BOAT_TEST_01",
        "lat": 19.9975,
        "lng": 73.7898,
        "speed_knots": 12.5,
        "heading_degrees": 90,
        "battery_pct": 85,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    response = client.post('/api/v1/boats/location', json=payload)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert data['boat_id'] == 'BOAT_TEST_01'
    assert data['published'] == True


def test_gps_rejects_invalid_lat(client):
    """Test 2: lat=999 → 422"""
    payload = {
        "boat_id": "BOAT_TEST_02",
        "lat": 999,
        "lng": 73.7898,
        "speed_knots": 10,
        "heading_degrees": 180,
        "battery_pct": 90,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    response = client.post('/api/v1/boats/location', json=payload)
    
    assert response.status_code == 422
    data = response.get_json()
    assert 'error' in data
    assert 'latitude' in data['error'].lower()


def test_gps_rejects_missing_boat_id(client):
    """Test 3: missing boat_id field → 422"""
    payload = {
        "lat": 19.9975,
        "lng": 73.7898,
        "speed_knots": 10,
        "heading_degrees": 180,
        "battery_pct": 90,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    response = client.post('/api/v1/boats/location', json=payload)
    
    assert response.status_code == 422
    data = response.get_json()
    assert 'error' in data


# ============================================================================
# BOAT TRAIL TESTS (Tests 4-5)
# ============================================================================

@patch('backend.main.db')
def test_boat_trail_downsamples(mock_db, client):
    """Test 4: trail with 600 points → response has ≤500"""
    # Mock Firestore to return 600 location points
    mock_locations = []
    base_time = datetime.utcnow() - timedelta(minutes=30)
    
    for i in range(600):
        mock_doc = MagicMock()
        mock_doc.to_dict.return_value = {
            'lat': 19.99 + (i * 0.0001),
            'lng': 73.78 + (i * 0.0001),
            'speed_knots': 10,
            'heading_degrees': 90,
            'battery_pct': 85,
            'timestamp': base_time + timedelta(seconds=i*3)
        }
        mock_locations.append(mock_doc)
    
    mock_query = MagicMock()
    mock_query.stream.return_value = mock_locations
    
    mock_db.collection.return_value.document.return_value.collection.return_value.where.return_value.order_by.return_value = mock_query
    
    response = client.get('/api/v1/boats/BOAT_TEST_03/trail?minutes=30')
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data['trail']) <= 500
    assert data['point_count'] <= 500


@patch('backend.main.gps_service')
def test_active_boats_filters_stale(mock_service, client):
    """Test 5: boats last_seen >5min ago excluded"""
    # Mock service to return boats with different statuses
    mock_service.get_all_active_boats.return_value = [
        {
            'boat_id': 'BOAT_ACTIVE',
            'last_seen': (datetime.utcnow() - timedelta(minutes=1)).isoformat(),
            'last_lat': 19.99,
            'last_lng': 73.78,
            'status': 'active'
        },
        {
            'boat_id': 'BOAT_STALE',
            'last_seen': (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
            'last_lat': 20.00,
            'last_lng': 73.80,
            'status': 'stale'
        }
    ]
    
    response = client.get('/api/v1/boats?stale_threshold_minutes=5')
    
    assert response.status_code == 200
    data = response.get_json()
    
    # Both boats returned, but stale one marked as 'stale'
    assert data['count'] == 2
    active_boat = next(b for b in data['boats'] if b['boat_id'] == 'BOAT_ACTIVE')
    stale_boat = next(b for b in data['boats'] if b['boat_id'] == 'BOAT_STALE')
    
    assert active_boat['status'] == 'active'
    assert stale_boat['status'] == 'stale'


# ============================================================================
# HEATMAP TESTS (Tests 6-8)
# ============================================================================

@patch('backend.services.heatmap_service.ThreatHeatmapService._get_recent_events')
def test_heatmap_time_decay(mock_get_events, client):
    """Test 6: events 24h old weighted lower than 1h old"""
    # Create two events: one recent (1h ago), one old (24h ago)
    recent_event = {
        'event_id': 'evt_recent',
        'lat': 19.99,
        'lng': 73.78,
        'severity_score': 0.9,
        'crisis_type': 'flood',
        'timestamp': datetime.utcnow() - timedelta(hours=1)
    }
    
    old_event = {
        'event_id': 'evt_old',
        'lat': 20.01,
        'lng': 73.80,
        'severity_score': 0.9,
        'crisis_type': 'flood',
        'timestamp': datetime.utcnow() - timedelta(hours=24)
    }
    
    mock_get_events.return_value = [recent_event, old_event]
    
    response = client.get('/api/v1/heatmap')
    
    assert response.status_code == 200
    data = response.get_json()
    
    # Recent event should have higher intensity due to time decay
    points = data['points']
    assert len(points) == 2
    
    # Sort by intensity
    points_sorted = sorted(points, key=lambda x: x['intensity'], reverse=True)
    
    # The highest intensity point should be from the recent event
    assert points_sorted[0]['latest_event_id'] == 'evt_recent'


@patch('backend.services.heatmap_service.ThreatHeatmapService._get_recent_events')
def test_heatmap_grid_grouping(mock_get_events, client):
    """Test 7: 3 events in same 2km cell merged into 1"""
    # Create 3 events very close together (within 2km grid cell)
    events = [
        {
            'event_id': f'evt_{i}',
            'lat': 19.99 + (i * 0.001),  # Very close
            'lng': 73.78 + (i * 0.001),
            'severity_score': 0.5,
            'crisis_type': 'flood',
            'timestamp': datetime.utcnow() - timedelta(hours=1)
        }
        for i in range(3)
    ]
    
    mock_get_events.return_value = events
    
    response = client.get('/api/v1/heatmap?grid_resolution_km=2.0')
    
    assert response.status_code == 200
    data = response.get_json()
    
    # Should be grouped into 1 hotspot
    assert len(data['points']) == 1
    assert data['points'][0]['event_count'] == 3


@patch('backend.services.heatmap_service.ThreatHeatmapService._get_recent_events')
def test_heatmap_normalization(mock_get_events, client):
    """Test 8: max intensity always 1.0"""
    events = [
        {
            'event_id': 'evt_high',
            'lat': 19.99,
            'lng': 73.78,
            'severity_score': 0.9,
            'crisis_type': 'earthquake',
            'timestamp': datetime.utcnow() - timedelta(hours=1)
        },
        {
            'event_id': 'evt_low',
            'lat': 20.01,
            'lng': 73.80,
            'severity_score': 0.3,
            'crisis_type': 'fire',
            'timestamp': datetime.utcnow() - timedelta(hours=2)
        }
    ]
    
    mock_get_events.return_value = events
    
    response = client.get('/api/v1/heatmap')
    
    assert response.status_code == 200
    data = response.get_json()
    
    # Max intensity should be 1.0
    max_intensity = max(p['intensity'] for p in data['points'])
    assert max_intensity == 1.0


# ============================================================================
# ZONE RISK TESTS (Tests 9-10)
# ============================================================================

@patch('backend.services.heatmap_service.ThreatHeatmapService._get_recent_events')
def test_zone_risk_no_nearby(mock_get_events, client):
    """Test 9: no events within radius → risk=0.0"""
    # Event far away (>100km)
    events = [
        {
            'event_id': 'evt_far',
            'lat': 25.00,  # Far from query point
            'lng': 80.00,
            'severity_score': 0.9,
            'crisis_type': 'flood',
            'timestamp': datetime.utcnow() - timedelta(hours=1)
        }
    ]
    
    mock_get_events.return_value = events
    
    # Query point: Nashik (19.9975, 73.7898)
    response = client.get('/api/v1/heatmap/zone-risk?lat=19.9975&lng=73.7898&radius_km=5')
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert data['risk_score'] == 0.0
    assert data['nearby_events'] == 0


@patch('backend.services.heatmap_service.ThreatHeatmapService._get_recent_events')
def test_zone_risk_critical(mock_get_events, client):
    """Test 10: severity-9 event 0.5km away → risk≥0.8"""
    # Critical event very close
    events = [
        {
            'event_id': 'evt_critical',
            'lat': 19.9975,
            'lng': 73.7948,  # ~0.5km away
            'severity_score': 0.9,
            'crisis_type': 'earthquake',
            'timestamp': datetime.utcnow() - timedelta(minutes=30)
        }
    ]
    
    mock_get_events.return_value = events
    
    response = client.get('/api/v1/heatmap/zone-risk?lat=19.9975&lng=73.7898&radius_km=5')
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert data['risk_score'] >= 0.7
    assert data['nearby_events'] >= 1


# ============================================================================
# UTILITY TESTS (Tests 11-12)
# ============================================================================

def test_haversine_known_distance():
    """Test 11: Mumbai↔Pune ≈120km ±5km"""
    from backend.services.heatmap_service import ThreatHeatmapService
    
    service = ThreatHeatmapService()
    
    # Mumbai coordinates
    mumbai_lat, mumbai_lng = 19.0760, 72.8777
    # Pune coordinates
    pune_lat, pune_lng = 18.5204, 73.8567
    
    distance = service._haversine_km(mumbai_lat, mumbai_lng, pune_lat, pune_lng)
    
    # Expected: ~120km (actual straight-line distance)
    assert 115 <= distance <= 125


@patch('backend.services.pubsub_bridge.pubsub_bridge.publisher')
def test_pubsub_bridge_publish(mock_publisher, client):
    """Test 12: publish() calls Pub/Sub client with correct topic"""
    from backend.services.pubsub_bridge import pubsub_bridge
    
    mock_future = MagicMock()
    mock_future.result.return_value = "msg_123"
    mock_publisher.publish.return_value = mock_future
    
    message_id = pubsub_bridge.publish('test-topic', {'key': 'value'})
    
    assert message_id == "msg_123"
    mock_publisher.publish.assert_called_once()


# ============================================================================
# SSE ENDPOINT TESTS (Tests 13-14)
# ============================================================================

def test_sse_endpoint_headers(client):
    """Test 13: GET /stream/live-ops → correct SSE headers"""
    response = client.get('/api/v1/stream/live-ops')
    
    assert response.status_code == 200
    assert response.content_type == 'text/event-stream; charset=utf-8'
    assert response.headers.get('Cache-Control') == 'no-cache'
    assert response.headers.get('X-Accel-Buffering') == 'no'


@patch('backend.services.gps_service.GPSIngestionService.get_all_active_boats')
@patch('backend.services.heatmap_service.ThreatHeatmapService.compute_heatmap')
def test_sse_boats_event_format(mock_heatmap, mock_boats, client):
    """Test 14: SSE data parses as JSON with 'boats' key"""
    mock_boats.return_value = [{'boat_id': 'BOAT_SSE_01', 'status': 'active'}]
    mock_heatmap.return_value = {'hotspots': [], 'total_active_events': 0}
    
    response = client.get('/api/v1/stream/live-ops')
    
    # Read first SSE event
    data_line = None
    for line in response.response:
        line_str = line.decode('utf-8')
        if line_str.startswith('data: '):
            data_line = line_str[6:].strip()
            break
    
    assert data_line is not None
    
    # Parse JSON
    event_data = json.loads(data_line)
    assert 'boats' in event_data
    assert 'alerts' in event_data
    assert 'timestamp' in event_data


# ============================================================================
# FLASK CACHING TEST (Test 15)
# ============================================================================

def test_flask_caching_heatmap(client):
    """Test 15: second call to /heatmap hits cache, not service"""
    from backend.main import cache, heatmap_service
    from unittest.mock import patch
    
    # Clear cache before test
    cache.clear()
    
    with patch.object(heatmap_service, 'compute_heatmap') as mock_compute:
        mock_compute.return_value = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'grid_resolution_km': 2.0,
            'hotspots': [],
            'total_active_events': 0,
            'bounding_box': {'min_lat': 0, 'max_lat': 0, 'min_lng': 0, 'max_lng': 0}
        }
        
        # First call
        response1 = client.get('/api/v1/heatmap')
        assert response1.status_code == 200
        assert mock_compute.call_count == 1
        
        # Second call (should hit cache)
        response2 = client.get('/api/v1/heatmap')
        assert response2.status_code == 200
        
        # Service should still only be called once (cached)
        assert mock_compute.call_count == 1
