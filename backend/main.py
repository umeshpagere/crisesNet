import os
import time
import secrets
import hashlib
from datetime import datetime
from typing import Dict, Any, Tuple, Generator
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from flask_caching import Cache
try:
    from google.cloud import firestore
except ImportError:
    firestore = None
from backend.services.allocation_optimizer import AllocationOptimizer
from backend.services.gps_service import GPSIngestionService
from backend.services.heatmap_service import ThreatHeatmapService
from backend.services.gap_service import GapAnalysisService
from backend.services.ai_advisor_service import AIAdvisorService
from backend.services.route_service import RouteService

app = Flask(__name__)
CORS(app)

# Configure caching
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 60})

PROJECT_ID = "crisisnet-2026"
API_VERSION = "0.1.0"

try:
    db = firestore.Client(project=PROJECT_ID) if firestore else None
    if db is None and firestore is None:
        print("Warning: google-cloud-firestore not installed, running in mock mode")
except Exception as e:
    print(f"Warning: Failed to initialize Firestore client: {e}")
    db = None

# Initialize Phase 3 services
gps_service = GPSIngestionService(firestore_client=db)
heatmap_service = ThreatHeatmapService(firestore_client=db)
gap_service = GapAnalysisService(firestore_client=db)
ai_advisor    = AIAdvisorService()
route_service = RouteService(firestore_client=db)


def get_timestamp() -> str:
    """Return current timestamp in ISO 8601 format."""
    return datetime.utcnow().isoformat() + "Z"


def measure_latency(func):
    """Decorator to measure function execution time in milliseconds."""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return result, latency_ms
    return wrapper


@app.route('/health', methods=['GET'])
def health_check() -> Tuple[Dict[str, Any], int]:
    """
    Health check endpoint that verifies API and Firestore connectivity.
    
    Returns:
        JSON response with health status and timestamp
        Status code: 200 (healthy) or 500 (unhealthy)
    """
    try:
        if db is None:
            return jsonify({
                "status": "healthy",
                "message": "Running in mock mode (Firestore unavailable)",
                "timestamp": get_timestamp(),
                "api_version": API_VERSION
            }), 200
        
        db.collection('benchmarks').document('phase_0').get()
        
        return jsonify({
            "status": "healthy",
            "timestamp": get_timestamp(),
            "api_version": API_VERSION
        }), 200
    
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "message": str(e),
            "timestamp": get_timestamp(),
            "api_version": API_VERSION
        }), 500


@app.route('/api/firestore-test', methods=['GET'])
def firestore_test() -> Tuple[Dict[str, Any], int]:
    """
    Test Firestore read operation and measure latency.
    
    Returns:
        JSON response with read latency and document data
        Status code: 200 (success), 404 (not found), or 500 (error)
    """
    try:
        if db is None:
            return jsonify({
                "status": "error",
                "message": "Firestore client not initialized"
            }), 500
        
        @measure_latency
        def read_document():
            doc_ref = db.collection('raw_signals').document('test_signal_1')
            doc = doc_ref.get()
            return doc
        
        doc, latency_ms = read_document()
        
        if not doc.exists:
            return jsonify({
                "status": "error",
                "message": "Document not found",
                "latency_ms": latency_ms
            }), 404
        
        return jsonify({
            "status": "success",
            "latency_ms": latency_ms,
            "data": doc.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/firestore-write-test', methods=['POST'])
def firestore_write_test() -> Tuple[Dict[str, Any], int]:
    """
    Test Firestore write operation and measure latency.
    
    Accepts optional JSON body to write to Firestore.
    
    Returns:
        JSON response with write latency
        Status code: 201 (created) or 500 (error)
    """
    try:
        if db is None:
            return jsonify({
                "status": "error",
                "message": "Firestore client not initialized"
            }), 500
        
        data = request.get_json() if request.is_json else {}
        
        timestamp = datetime.utcnow().isoformat()
        doc_id = f"write_{timestamp.replace(':', '-').replace('.', '-')}"
        
        write_data = {
            "timestamp": timestamp,
            "test_data": data,
            "source": "api_test"
        }
        
        @measure_latency
        def write_document():
            doc_ref = db.collection('test_writes').document(doc_id)
            doc_ref.set(write_data)
            return doc_id
        
        written_doc_id, latency_ms = write_document()
        
        return jsonify({
            "status": "success",
            "latency_ms": latency_ms,
            "document_id": written_doc_id
        }), 201
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/benchmarks', methods=['GET'])
def get_benchmarks() -> Tuple[Dict[str, Any], int]:
    """
    Retrieve Phase 0 benchmarks from Firestore.
    
    Returns:
        JSON response with benchmark data
        Status code: 200 (success), 404 (not found), or 500 (error)
    """
    try:
        if db is None:
            return jsonify({
                "status": "error",
                "message": "Firestore client not initialized"
            }), 500
        
        doc_ref = db.collection('benchmarks').document('phase_0')
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({
                "status": "error",
                "message": "Benchmarks document not found"
            }), 404
        
        return jsonify({
            "status": "success",
            "benchmarks": doc.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/benchmarks', methods=['POST'])
def update_benchmarks() -> Tuple[Dict[str, Any], int]:
    """
    Update Phase 0 benchmarks in Firestore.
    
    Accepts JSON body with fields to update.
    
    Returns:
        JSON response with update confirmation
        Status code: 200 (success) or 500 (error)
    """
    try:
        if db is None:
            return jsonify({
                "status": "error",
                "message": "Firestore client not initialized"
            }), 500
        
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Request must be JSON"
            }), 400
        
        update_data = request.get_json()
        
        doc_ref = db.collection('benchmarks').document('phase_0')
        doc_ref.update(update_data)
        
        return jsonify({
            "status": "success",
            "message": "Benchmarks updated"
        }), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/allocate', methods=['POST'])
def allocate_responders() -> Tuple[Dict[str, Any], int]:
    """
    Allocate responders to victims using OR-Tools TSP optimization.
    
    Request body:
        {
            "victims": [
                {"id": "v1", "lat": 19.99, "lng": 73.78, "severity": "critical"},
                ...
            ],
            "responders": [
                {"id": "r1", "lat": 20.00, "lng": 73.80, "capacity": 5},
                ...
            ]
        }
    
    Returns:
        {
            "status": "success",
            "assignments": [
                {
                    "responder_id": "r1",
                    "victim_ids": ["v1", "v2"],
                    "route": ["v1", "v2"],
                    "route_distance_km": 12.5
                }
            ],
            "total_distance_km": 45.2,
            "unassigned_victims": 0,
            "solve_time_ms": 234
        }
    """
    try:
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Request must be JSON"
            }), 400
        
        data = request.get_json()
        
        # Validate input
        if "victims" not in data or "responders" not in data:
            return jsonify({
                "status": "error",
                "message": "Request must include 'victims' and 'responders' arrays"
            }), 400
        
        victims = data["victims"]
        responders = data["responders"]
        
        # Validate victims
        for v in victims:
            if not all(k in v for k in ["id", "lat", "lng", "severity"]):
                return jsonify({
                    "status": "error",
                    "message": "Each victim must have id, lat, lng, severity"
                }), 400
        
        # Validate responders
        for r in responders:
            if not all(k in r for k in ["id", "lat", "lng", "capacity"]):
                return jsonify({
                    "status": "error",
                    "message": "Each responder must have id, lat, lng, capacity"
                }), 400
        
        # Run allocation
        optimizer = AllocationOptimizer()
        result = optimizer.allocate(victims, responders)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ============================================================================
# PHASE 3 ENDPOINTS — GPS, Heatmap, SSE Stream
# ============================================================================

@app.route('/api/v1/boats/location', methods=['POST'])
def ingest_boat_location() -> Tuple[Dict[str, Any], int]:
    """
    Ingest GPS location update from a boat.
    
    Request body: {boat_id, lat, lng, speed_knots, heading_degrees, battery_pct, timestamp}
    Returns: {status, boat_id, published}
    """
    try:
        payload = request.get_json()
        
        if not payload:
            return jsonify({"error": "Missing JSON payload"}), 422
        
        # Call GPS service
        result = gps_service.ingest_location_update(payload)
        return jsonify(result), 200
    
    except ValueError as e:
        # Validation error from GPS service
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Internal error: {str(e)}"}), 500


@app.route('/api/v1/boats', methods=['GET'])
def get_active_boats() -> Tuple[Dict[str, Any], int]:
    """
    Get all active boats with recent location updates.
    
    Query params: stale_threshold_minutes (default: 10)
    Returns: List of boat objects
    """
    try:
        threshold = int(request.args.get('stale_threshold_minutes', 10))
        boats = gps_service.get_all_active_boats(stale_threshold_minutes=threshold)
        
        return jsonify({
            "boats": boats,
            "count": len(boats),
            "timestamp": get_timestamp()
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/boats/<boat_id>/trail', methods=['GET'])
def get_boat_trail(boat_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Get location history trail for a specific boat.
    
    Query params: minutes (default: 30)
    Returns: List of location points (max 500, downsampled if needed)
    """
    try:
        minutes = int(request.args.get('minutes', 30))
        trail = gps_service.get_boat_trail(boat_id, last_n_minutes=minutes)
        
        return jsonify({
            "boat_id": boat_id,
            "trail": trail,
            "point_count": len(trail),
            "time_window_minutes": minutes
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap', methods=['GET'])
@cache.cached(timeout=60, query_string=True)
def get_heatmap() -> Tuple[Dict[str, Any], int]:
    """
    Get threat heatmap with time decay and grid grouping.
    Cached for 60 seconds.
    
    Query params: grid_resolution_km (default: 2.0)
    Returns: Heatmap with hotspots, bounding box, metadata
    """
    try:
        grid_resolution = float(request.args.get('grid_resolution_km', 2.0))
        heatmap = heatmap_service.compute_heatmap(grid_resolution_km=grid_resolution)
        
        # Rename 'hotspots' to 'points' for frontend compatibility
        heatmap['points'] = heatmap.pop('hotspots')
        
        return jsonify(heatmap), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap/zone-risk', methods=['GET'])
def get_zone_risk() -> Tuple[Dict[str, Any], int]:
    """
    Calculate risk score for a specific geographic zone.
    
    Query params: lat, lng, radius_km (default: 5.0)
    Returns: {risk_score, nearby_events, dominant_crisis_type}
    """
    try:
        lat = request.args.get('lat')
        lng = request.args.get('lng')
        
        if lat is None or lng is None:
            return jsonify({"error": "Missing required params: lat, lng"}), 422
        
        lat = float(lat)
        lng = float(lng)
        radius_km = float(request.args.get('radius_km', 5.0))
        
        # Validate lat/lng
        if not (-90 <= lat <= 90):
            return jsonify({"error": f"Invalid latitude: {lat}"}), 422
        if not (-180 <= lng <= 180):
            return jsonify({"error": f"Invalid longitude: {lng}"}), 422
        
        risk_data = heatmap_service.get_zone_risk_score(lat, lng, radius_km)
        return jsonify(risk_data), 200
    
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap/resource-density', methods=['GET'])
@cache.cached(timeout=60, query_string=True)
def get_resource_density_heatmap() -> Tuple[Dict[str, Any], int]:
    """Resource density heatmap — high intensity = many available resources."""
    try:
        grid_resolution = float(request.args.get('grid_resolution_km', 2.0))
        resources = []
        if db:
            for doc in db.collection('resources').stream():
                resources.append(doc.to_dict())
        data = heatmap_service.compute_resource_density(resources, grid_resolution)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap/population-risk', methods=['GET'])
@cache.cached(timeout=60, query_string=True)
def get_population_risk_heatmap() -> Tuple[Dict[str, Any], int]:
    """Population-at-risk heatmap — weight = affected_count × severity."""
    try:
        grid_resolution = float(request.args.get('grid_resolution_km', 2.0))
        crises: list = []
        gaps_raw = gap_service.compute_gaps()
        gaps = [
            {
                'lat': g.lat, 'lng': g.lng,
                'affected_people': g.affected_people,
                'priority_score': g.priority_score,
            }
            for g in gaps_raw
        ]
        if db:
            for doc in db.collection('crises').stream():
                crises.append(doc.to_dict())
        data = heatmap_service.compute_population_risk(crises, gaps, grid_resolution)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap/response-time', methods=['GET'])
@cache.cached(timeout=60, query_string=True)
def get_response_time_heatmap() -> Tuple[Dict[str, Any], int]:
    """Response-time heatmap — intensity 1.0 = ETA ≥ 30 min (slow)."""
    try:
        grid_resolution = float(request.args.get('grid_resolution_km', 2.0))
        resources: list = []
        crises: list = []
        if db:
            for doc in db.collection('resources').stream():
                resources.append(doc.to_dict())
            for doc in db.collection('crises').stream():
                crises.append(doc.to_dict())
        data = heatmap_service.compute_response_time_heatmap(resources, crises, grid_resolution)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/heatmap/temporal', methods=['GET'])
@cache.cached(timeout=120, query_string=True)
def get_temporal_heatmap() -> Tuple[Dict[str, Any], int]:
    """Temporal heatmap slices for time-lapse playback."""
    try:
        hours = int(request.args.get('hours', 72))
        slices = int(request.args.get('slices', 24))
        hours = max(1, min(hours, 168))   # cap at 7 days
        slices = max(4, min(slices, 48))
        data = heatmap_service.get_temporal_slices(hours=hours, slice_count=slices)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/stream/live-ops', methods=['GET'])
def stream_live_ops() -> Response:
    """
    Server-Sent Events (SSE) stream for live operations.
    Streams boats, resources, NGOs, gaps, assignments, chat, alerts, coverage zones every 3s.
    
    Returns: text/event-stream with 9 event types
    """
    def generate() -> Generator[str, None, None]:
        """Generate SSE events every 3 seconds"""
        import json
        
        while True:
            try:
                # Get current boats (legacy)
                boats = gps_service.get_all_active_boats(stale_threshold_minutes=10)
                
                # Get recent heatmap (legacy alerts)
                heatmap = heatmap_service.compute_heatmap(grid_resolution_km=2.0)
                alerts = heatmap.get('hotspots', [])[:20]  # Top 20 hotspots as alerts
                
                # NEW: Get all resources
                resources = []
                if db:
                    for doc in db.collection('resources').stream():
                        resources.append(doc.to_dict())
                
                # NEW: Get all NGOs
                ngos = []
                if db:
                    for doc in db.collection('ngos').stream():
                        ngos.append(doc.to_dict())
                
                # NEW: Get gap zones
                gaps_list = gap_service.compute_gaps()
                gaps = []
                for gap in gaps_list:
                    gaps.append({
                        'lat': gap.lat,
                        'lng': gap.lng,
                        'radius_km': gap.radius_km,
                        'affected_people': gap.affected_people,
                        'priority_score': gap.priority_score,
                        'crisis_id': gap.crisis_id
                    })
                
                # NEW: Get crisis assignments
                assignments = []
                if db:
                    for doc in db.collection('crisis_assignments').stream():
                        assignments.append(doc.to_dict())
                
                # NEW: Get coverage zones
                coverage_zones = []
                if db:
                    for doc in db.collection('coverage_zones').stream():
                        coverage_zones.append(doc.to_dict())
                
                # Format SSE event with all data types
                data = {
                    "boats": boats,
                    "alerts": alerts,
                    "resources": resources,
                    "ngos": ngos,
                    "gaps": gaps,
                    "assignments": assignments,
                    "coverage_zones": coverage_zones,
                    "timestamp": get_timestamp()
                }
                
                yield f"data: {json.dumps(data)}\n\n"
                
                time.sleep(3)
            
            except GeneratorExit:
                break
            except Exception as e:
                # Send error event
                error_data = {"error": str(e), "timestamp": get_timestamp()}
                yield f"data: {json.dumps(error_data)}\n\n"
                time.sleep(3)
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


# === NGO DASHBOARD ROUTES ===

@app.route('/api/v1/ngos/register', methods=['POST'])
def register_ngo() -> Tuple[Dict[str, Any], int]:
    """Register a new NGO and assign a unique colour."""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"error": "NGO name required"}), 400
    
    ngo_id = f"NGO_{data['name'].upper().replace(' ', '_')}"
    
    # Colour palette - cycle through
    colours = ['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899']
    
    if db:
        # Count existing NGOs to assign next colour
        ngos_ref = db.collection('ngos')
        ngo_count = len(list(ngos_ref.stream()))
        assigned_colour = colours[ngo_count % len(colours)]
        
        # Store NGO profile
        ngo_doc = {
            'ngo_id': ngo_id,
            'name': data['name'],
            'contact': data.get('contact', ''),
            'zone': data.get('zone', ''),
            'resource_types': data.get('resource_types', []),
            'colour': assigned_colour,
            'status': 'online',
            'last_seen': get_timestamp(),
            'created_at': get_timestamp()
        }
        ngos_ref.document(ngo_id).set(ngo_doc)
    else:
        assigned_colour = colours[0]
    
    return jsonify({
        'ngo_id': ngo_id,
        'colour': assigned_colour,
        'status': 'registered'
    }), 201


@app.route('/api/v1/ngos', methods=['GET'])
def get_ngos() -> Tuple[Dict[str, Any], int]:
    """Get all active NGOs."""
    if not db:
        return jsonify({'ngos': []}), 200
    
    ngos = []
    for doc in db.collection('ngos').stream():
        ngos.append(doc.to_dict())
    
    return jsonify({'ngos': ngos, 'count': len(ngos)}), 200


@app.route('/api/v1/ngos/<ngo_id>/status', methods=['PATCH'])
def update_ngo_status(ngo_id: str) -> Tuple[Dict[str, Any], int]:
    """Update NGO online/offline status."""
    data = request.get_json()
    
    if not data or 'status' not in data:
        return jsonify({"error": "Status required"}), 400
    
    if db:
        ngo_ref = db.collection('ngos').document(ngo_id)
        ngo_ref.update({
            'status': data['status'],
            'last_seen': get_timestamp()
        })
    
    return jsonify({'status': 'updated'}), 200


@app.route('/api/v1/resources', methods=['POST'])
def create_resource() -> Tuple[Dict[str, Any], int]:
    """Register a new resource."""
    data = request.get_json()
    
    required = ['resource_id', 'ngo_id', 'type', 'lat', 'lng']
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400
    
    if db:
        resource_doc = {
            'resource_id': data['resource_id'],
            'ngo_id': data['ngo_id'],
            'type': data['type'],
            'name': data.get('name', data['resource_id']),
            'capacity': data.get('capacity', 0),
            'lat': data['lat'],
            'lng': data['lng'],
            'status': data.get('status', 'available'),
            'assigned_crisis_id': data.get('assigned_crisis_id'),
            'battery_pct': data.get('battery_pct', 100),
            'speed': data.get('speed', 0),
            'heading': data.get('heading', 0),
            'created_at': get_timestamp(),
            'updated_at': get_timestamp()
        }
        db.collection('resources').document(data['resource_id']).set(resource_doc)
    
    return jsonify({'status': 'created', 'resource_id': data['resource_id']}), 201


@app.route('/api/v1/resources', methods=['GET'])
def get_resources() -> Tuple[Dict[str, Any], int]:
    """Get all resources with optional filters."""
    ngo_id = request.args.get('ngo_id')
    status = request.args.get('status')
    
    if not db:
        return jsonify({'resources': []}), 200
    
    query = db.collection('resources')
    
    if ngo_id:
        query = query.where('ngo_id', '==', ngo_id)
    if status:
        query = query.where('status', '==', status)
    
    resources = [doc.to_dict() for doc in query.stream()]
    
    return jsonify({'resources': resources, 'count': len(resources)}), 200


@app.route('/api/v1/resources/<resource_id>', methods=['PATCH'])
def update_resource(resource_id: str) -> Tuple[Dict[str, Any], int]:
    """Update resource status, position, or assignment."""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Update data required"}), 400
    
    if db:
        resource_ref = db.collection('resources').document(resource_id)
        update_data = {k: v for k, v in data.items() if k in [
            'status', 'lat', 'lng', 'assigned_crisis_id', 'battery_pct', 'speed', 'heading'
        ]}
        update_data['updated_at'] = get_timestamp()
        resource_ref.update(update_data)
    
    return jsonify({'status': 'updated'}), 200


@app.route('/api/v1/resources/<resource_id>', methods=['DELETE'])
def delete_resource(resource_id: str) -> Tuple[Dict[str, Any], int]:
    """Remove a resource."""
    if db:
        db.collection('resources').document(resource_id).delete()
    
    return jsonify({'status': 'deleted'}), 200


@app.route('/api/v1/crises/<crisis_id>/assignments', methods=['POST'])
def assign_resource_to_crisis(crisis_id: str) -> Tuple[Dict[str, Any], int]:
    """Assign a resource to a crisis."""
    data = request.get_json()
    
    if not data or 'resource_id' not in data or 'ngo_id' not in data:
        return jsonify({"error": "resource_id and ngo_id required"}), 400
    
    if db:
        assignment_doc = {
            'crisis_id': crisis_id,
            'resource_id': data['resource_id'],
            'ngo_id': data['ngo_id'],
            'assigned_at': get_timestamp(),
            'eta_minutes': data.get('eta_minutes', 0),
            'status': 'assigned'
        }
        assignment_id = f"{crisis_id}_{data['resource_id']}"
        db.collection('crisis_assignments').document(assignment_id).set(assignment_doc)
        
        # Update resource status
        db.collection('resources').document(data['resource_id']).update({
            'status': 'deployed',
            'assigned_crisis_id': crisis_id,
            'updated_at': get_timestamp()
        })
    
    return jsonify({'status': 'assigned'}), 201


@app.route('/api/v1/crises/<crisis_id>/assignments/<resource_id>', methods=['DELETE'])
def unassign_resource(crisis_id: str, resource_id: str) -> Tuple[Dict[str, Any], int]:
    """Unassign a resource from a crisis."""
    if db:
        assignment_id = f"{crisis_id}_{resource_id}"
        db.collection('crisis_assignments').document(assignment_id).delete()
        
        # Update resource status
        db.collection('resources').document(resource_id).update({
            'status': 'available',
            'assigned_crisis_id': None,
            'updated_at': get_timestamp()
        })
    
    return jsonify({'status': 'unassigned'}), 200


@app.route('/api/v1/crises/active', methods=['GET'])
def get_active_crises() -> Tuple[Dict[str, Any], int]:
    """Get all active crises with assignments."""
    if not db:
        return jsonify({'crises': []}), 200
    
    # Get active crises (last 6 hours)
    crises = []
    for doc in db.collection('crisis_events').limit(50).stream():
        crisis = doc.to_dict()
        
        # Get assignments for this crisis
        assignments = []
        for assign_doc in db.collection('crisis_assignments').where('crisis_id', '==', doc.id).stream():
            assignments.append(assign_doc.to_dict())
        
        crisis['assignments'] = assignments
        crises.append(crisis)
    
    return jsonify({'crises': crises, 'count': len(crises)}), 200


@app.route('/api/v1/coverage-zones', methods=['POST'])
def create_coverage_zone() -> Tuple[Dict[str, Any], int]:
    """Claim a coverage zone."""
    data = request.get_json()
    
    if not data or 'ngo_id' not in data or 'polygon_coords' not in data:
        return jsonify({"error": "ngo_id and polygon_coords required"}), 400
    
    if db:
        zone_id = f"ZONE_{data['ngo_id']}_{int(time.time())}"
        zone_doc = {
            'zone_id': zone_id,
            'ngo_id': data['ngo_id'],
            'polygon_coords': data['polygon_coords'],
            'zone_name': data.get('zone_name', ''),
            'claimed_at': get_timestamp()
        }
        db.collection('coverage_zones').document(zone_id).set(zone_doc)
        
        return jsonify({'status': 'created', 'zone_id': zone_id}), 201
    
    return jsonify({'status': 'created', 'zone_id': 'mock_zone'}), 201


@app.route('/api/v1/coverage-zones', methods=['GET'])
def get_coverage_zones() -> Tuple[Dict[str, Any], int]:
    """Get all claimed coverage zones."""
    if not db:
        return jsonify({'zones': []}), 200
    
    zones = [doc.to_dict() for doc in db.collection('coverage_zones').stream()]
    
    return jsonify({'zones': zones, 'count': len(zones)}), 200


@app.route('/api/v1/coverage-zones/<zone_id>', methods=['DELETE'])
def delete_coverage_zone(zone_id: str) -> Tuple[Dict[str, Any], int]:
    """Release a coverage zone."""
    if db:
        db.collection('coverage_zones').document(zone_id).delete()
    
    return jsonify({'status': 'deleted'}), 200


@app.route('/api/v1/chat', methods=['POST'])
def send_chat_message() -> Tuple[Dict[str, Any], int]:
    """Send a chat message."""
    data = request.get_json()
    
    if not data or 'ngo_id' not in data or 'message' not in data:
        return jsonify({"error": "ngo_id and message required"}), 400
    
    if db:
        message_doc = {
            'ngo_id': data['ngo_id'],
            'ngo_name': data.get('ngo_name', ''),
            'ngo_colour': data.get('ngo_colour', '#3b82f6'),
            'message': data['message'],
            'timestamp': get_timestamp(),
            'type': data.get('type', 'human')
        }
        db.collection('chat_messages').add(message_doc)
    
    return jsonify({'status': 'sent'}), 201


@app.route('/api/v1/chat', methods=['GET'])
def get_chat_messages() -> Tuple[Dict[str, Any], int]:
    """Get recent chat messages."""
    if not db:
        return jsonify({'messages': []}), 200
    
    messages = []
    for doc in db.collection('chat_messages').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(50).stream():
        messages.append(doc.to_dict())
    
    messages.reverse()  # Oldest first
    
    return jsonify({'messages': messages, 'count': len(messages)}), 200


@app.route('/api/v1/gaps', methods=['GET'])
@cache.cached(timeout=60)
def get_gaps() -> Tuple[Dict[str, Any], int]:
    """Get top 10 coverage gap zones (60s cache)."""
    gaps = gap_service.compute_gaps()
    
    # Convert dataclass to dict
    gaps_data = []
    for gap in gaps:
        gaps_data.append({
            'lat': gap.lat,
            'lng': gap.lng,
            'radius_km': gap.radius_km,
            'affected_people': gap.affected_people,
            'nearest_ngo': gap.nearest_ngo,
            'distance_to_nearest_km': gap.distance_to_nearest_km,
            'crisis_severity': gap.crisis_severity,
            'priority_score': gap.priority_score,
            'crisis_id': gap.crisis_id,
            'crisis_type': gap.crisis_type
        })
    
    return jsonify({'gaps': gaps_data, 'count': len(gaps_data)}), 200


@app.route('/api/v1/ai/recommend-allocation', methods=['POST'])
def ai_recommend_allocation() -> Response:
    """Stream AI allocation recommendations via SSE."""
    data = request.get_json()
    
    resources = data.get('resources', [])
    gaps      = data.get('gaps', [])
    if not gaps and db:
        gaps = [g.__dict__ for g in gap_service.compute_gaps()]

    return Response(
        stream_with_context(ai_advisor.recommend_allocation(resources, gaps)),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.route('/api/v1/ai/ask', methods=['POST'])
def ai_ask() -> Response:
    """Stream AI natural language Q&A via SSE."""
    data = request.get_json()
    
    question = data.get('question', '') if data else ''
    context  = data.get('context', {}) if data else {}

    return Response(
        stream_with_context(ai_advisor.ask_question(question, context)),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.route('/api/v1/ai/handover-brief', methods=['POST'])
def ai_handover_brief() -> Response:
    """Stream AI shift handover briefing via SSE."""
    body   = request.get_json() or {}
    ngo_id = body.get('ngo_id', 'UNKNOWN')
    # Build live stats for the brief
    stats: dict = {}
    if db:
        stats['crises_handled'] = len(list(db.collection('crisis_events').limit(100).stream()))
        stats['ngos_active']    = len(list(db.collection('ngos').where('status', '==', 'online').stream()))
        gaps = gap_service.compute_gaps()
        stats['coverage_gaps']  = len(gaps)
        stats['people_reached'] = sum(g.affected_people for g in gaps)
        stats['open_crises']    = stats['crises_handled']
    else:
        stats = {'crises_handled': 12, 'people_reached': 487, 'open_crises': 3, 'coverage_gaps': 2}

    return Response(
        stream_with_context(ai_advisor.generate_handover_brief(ngo_id, stats)),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.route('/api/v1/reports/ops-summary', methods=['GET'])
def ops_summary() -> Tuple[Dict[str, Any], int]:
    """Get current shift operations summary."""
    if not db:
        return jsonify({
            'crises_handled': 12,
            'people_reached': 487,
            'ngos_active': 4,
            'resources_deployed': 18,
            'coverage_gaps': 2
        }), 200
    
    # Count active crises
    crises_count = len(list(db.collection('crisis_events').limit(100).stream()))
    
    # Count NGOs
    ngos_count = len(list(db.collection('ngos').where('status', '==', 'online').stream()))
    
    # Count deployed resources
    resources_count = len(list(db.collection('resources').where('status', '==', 'deployed').stream()))
    
    # Get gaps
    gaps = gap_service.compute_gaps()
    
    return jsonify({
        'crises_handled': crises_count,
        'people_reached': sum(g.affected_people for g in gaps),
        'ngos_active': ngos_count,
        'resources_deployed': resources_count,
        'coverage_gaps': len(gaps)
    }), 200


# ---------------------------------------------------------------------------
# NGO Stats
# ---------------------------------------------------------------------------

@app.route('/api/v1/ngo-stats', methods=['GET'])
def get_ngo_stats() -> Tuple[Dict[str, Any], int]:
    """Per-NGO aggregated KPIs: coverage_pct, response_time_avg, people_reached, resources_deployed."""
    if not db:
        return jsonify({'stats': [
            {'ngo_id': 'NGO_RELIEF_INDIA',  'name': 'Relief India',        'colour': '#f59e0b', 'coverage_pct': 74, 'response_time_avg': 8.2,  'people_reached': 203, 'resources_deployed': 3, 'resources_available': 1},
            {'ngo_id': 'NGO_MEDAID_MH',     'name': 'MedAid Maharashtra',  'colour': '#3b82f6', 'coverage_pct': 55, 'response_time_avg': 12.5, 'people_reached': 140, 'resources_deployed': 1, 'resources_available': 2},
            {'ngo_id': 'NGO_SHELTER_FIRST', 'name': 'Shelter First',       'colour': '#10b981', 'coverage_pct': 40, 'response_time_avg': 18.0, 'people_reached': 87,  'resources_deployed': 1, 'resources_available': 1},
            {'ngo_id': 'NGO_RAPID_RESCUE',  'name': 'Rapid Rescue Force',  'colour': '#8b5cf6', 'coverage_pct': 60, 'response_time_avg': 6.1,  'people_reached': 57,  'resources_deployed': 2, 'resources_available': 0},
        ]}), 200
    stats = []
    for doc in db.collection('ngos').stream():
        ngo = doc.to_dict()
        ngo_id = ngo.get('ngo_id', doc.id)
        res_docs = list(db.collection('resources').where('ngo_id', '==', ngo_id).stream())
        resources = [r.to_dict() for r in res_docs]
        deployed  = sum(1 for r in resources if r.get('status') == 'deployed')
        available = sum(1 for r in resources if r.get('status') == 'available')
        assignments = list(db.collection('crisis_assignments').where('ngo_id', '==', ngo_id).stream())
        avg_eta = 0.0
        if assignments:
            etas = [a.to_dict().get('eta_minutes', 0) for a in assignments]
            avg_eta = sum(etas) / len(etas) if etas else 0.0
        stats.append({
            'ngo_id':             ngo_id,
            'name':               ngo.get('name', ngo_id),
            'colour':             ngo.get('colour', '#6b7280'),
            'coverage_pct':       round(min(100, available * 15 + deployed * 8), 1),
            'response_time_avg':  round(avg_eta, 1),
            'people_reached':     sum(r.get('capacity', 0) for r in resources if r.get('status') == 'deployed'),
            'resources_deployed': deployed,
            'resources_available': available,
        })
    return jsonify({'stats': stats}), 200


# ---------------------------------------------------------------------------
# Mutual Aid
# ---------------------------------------------------------------------------

@app.route('/api/v1/mutual-aid/requests', methods=['GET'])
def list_mutual_aid_requests() -> Tuple[Dict[str, Any], int]:
    """List all mutual aid requests."""
    if not db:
        return jsonify({'requests': []}), 200
    docs = db.collection('mutual_aid_requests').order_by('created_at', direction='DESCENDING').limit(50).stream()
    return jsonify({'requests': [d.to_dict() for d in docs]}), 200


@app.route('/api/v1/mutual-aid/requests', methods=['POST'])
def create_mutual_aid_request() -> Tuple[Dict[str, Any], int]:
    """Create a mutual aid request between two NGOs."""
    data = request.get_json() or {}
    required = ['from_ngo', 'to_ngo', 'resource_type', 'quantity']
    if not all(k in data for k in required):
        return jsonify({'error': f'Missing required fields: {required}'}), 400
    import uuid
    req_id = f'MAR_{uuid.uuid4().hex[:8].upper()}'
    doc = {
        'request_id':   req_id,
        'from_ngo':     data['from_ngo'],
        'to_ngo':       data['to_ngo'],
        'resource_type': data['resource_type'],
        'quantity':     data.get('quantity', 1),
        'crisis_id':    data.get('crisis_id'),
        'message':      data.get('message', ''),
        'status':       'pending',
        'created_at':   get_timestamp(),
        'updated_at':   get_timestamp(),
    }
    if db:
        db.collection('mutual_aid_requests').document(req_id).set(doc)
    return jsonify({'request_id': req_id, 'status': 'pending'}), 201


@app.route('/api/v1/mutual-aid/requests/<request_id>', methods=['PATCH'])
def update_mutual_aid_request(request_id: str) -> Tuple[Dict[str, Any], int]:
    """Accept or decline a mutual aid request."""
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('accepted', 'declined'):
        return jsonify({'error': 'status must be accepted or declined'}), 400
    if db:
        db.collection('mutual_aid_requests').document(request_id).update({
            'status':     status,
            'updated_at': get_timestamp(),
        })
    return jsonify({'request_id': request_id, 'status': status}), 200


# ---------------------------------------------------------------------------
# Route Planning
# ---------------------------------------------------------------------------

@app.route('/api/v1/routes/plan', methods=['GET'])
def plan_route() -> Tuple[Dict[str, Any], int]:
    """Plan optimal route from a resource to a crisis."""
    resource_id = request.args.get('resource_id')
    crisis_id   = request.args.get('crisis_id')
    if not resource_id or not crisis_id:
        return jsonify({'error': 'resource_id and crisis_id are required'}), 400
    speed = float(request.args.get('speed_kmh', 15.0))
    result = route_service.plan_route(resource_id, crisis_id, speed_kmh=speed)
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 200


@app.errorhandler(404)
def not_found(error) -> Tuple[Dict[str, Any], int]:
    """Handle 404 errors."""
    return jsonify({
        "status": "error",
        "message": "Endpoint not found"
    }), 404


# ============================================================================
# DEVICE API — Hardware GPS Tracker Integration
# ============================================================================

def _verify_device_token(token: str) -> Dict | None:
    """
    Verify an X-Device-Token against Firestore 'device_tokens' collection.
    Returns the device doc dict on success, None on failure.
    Falls back to mock mode (always valid) when Firestore is offline.
    """
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if db:
        doc = db.collection('device_tokens').document(token_hash).get()
        if doc.exists:
            return doc.to_dict()
        return None
    # Offline/mock mode — accept any non-empty token
    return {'resource_id': 'MOCK', 'device_name': 'mock', 'mock': True}


@app.route('/api/v1/device/register', methods=['POST'])
def register_device() -> Tuple[Dict[str, Any], int]:
    """
    Issue an API token for a hardware GPS device.

    Request body: { resource_id, device_name, ngo_id }
    Returns:      { token, resource_id, device_name, created_at }

    The returned token is stored as its SHA-256 hash in Firestore.
    The caller must store the plain-text token — it cannot be retrieved later.
    """
    data = request.get_json()
    if not data or not data.get('resource_id') or not data.get('ngo_id'):
        return jsonify({'error': 'resource_id and ngo_id are required'}), 400

    plain_token = 'cn_' + secrets.token_hex(24)   # e.g. cn_a1b2c3...
    token_hash  = hashlib.sha256(plain_token.encode()).hexdigest()
    device_name = data.get('device_name', f"Device-{data['resource_id']}")
    created_at  = get_timestamp()

    if db:
        db.collection('device_tokens').document(token_hash).set({
            'resource_id': data['resource_id'],
            'ngo_id':      data['ngo_id'],
            'device_name': device_name,
            'created_at':  created_at,
            'last_seen':   None,
        })

    return jsonify({
        'token':       plain_token,
        'resource_id': data['resource_id'],
        'device_name': device_name,
        'created_at':  created_at,
        'note': 'Store this token on the device. It cannot be retrieved again.',
    }), 201


@app.route('/api/v1/device/location', methods=['POST'])
def device_location_update() -> Tuple[Dict[str, Any], int]:
    """
    Receive a GPS fix from a hardware device and update the live dashboard.

    Authentication: X-Device-Token header (plain token issued by /device/register)

    Request body:
      { lat, lng, speed_knots?, heading_degrees?, battery_pct?, timestamp? }

    Flow:
      1. Validate token → resolve resource_id
      2. PATCH resources/<resource_id> in Firestore  →  SSE stream picks it up ≤3 s
      3. Append to boats/<resource_id>/locations trail (for history view)

    Returns: { status, resource_id, lat, lng, published_at }
    """
    token = request.headers.get('X-Device-Token', '').strip()
    device = _verify_device_token(token)
    if not device:
        return jsonify({'error': 'Invalid or missing X-Device-Token'}), 401

    payload = request.get_json()
    if not payload or 'lat' not in payload or 'lng' not in payload:
        return jsonify({'error': 'lat and lng are required'}), 422

    resource_id = device['resource_id']
    lat         = float(payload['lat'])
    lng         = float(payload['lng'])
    speed_knots = float(payload.get('speed_knots', 0))
    heading     = float(payload.get('heading_degrees', 0))
    battery_pct = int(payload.get('battery_pct', 100))
    published_at = get_timestamp()

    # Convert knots → km/h for the resource schema
    speed_kmh = round(speed_knots * 1.852, 2)

    if db:
        # ── 1. Update the resource document (SSE stream reads this every 3 s) ──
        db.collection('resources').document(resource_id).update({
            'lat':        lat,
            'lng':        lng,
            'speed':      speed_kmh,
            'heading':    heading,
            'battery_pct': battery_pct,
            'updated_at': published_at,
        })

        # ── 2. Append to trail (boats collection, locations sub-collection) ──
        boat_ref = db.collection('boats').document(resource_id)
        boat_ref.set({
            'boat_id':    resource_id,
            'lat':        lat,
            'lng':        lng,
            'speed_knots': speed_knots,
            'heading_degrees': heading,
            'battery_pct': battery_pct,
            'updated_at': published_at,
        }, merge=True)
        boat_ref.collection('locations').add({
            'lat':       lat,
            'lng':       lng,
            'speed_knots': speed_knots,
            'heading_degrees': heading,
            'battery_pct': battery_pct,
            'timestamp': datetime.utcnow(),
        })

        # ── 3. Update device last_seen ──
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.collection('device_tokens').document(token_hash).update({'last_seen': published_at})

    return jsonify({
        'status':      'updated',
        'resource_id': resource_id,
        'lat':         lat,
        'lng':         lng,
        'published_at': published_at,
    }), 200


@app.route('/api/v1/device/<resource_id>', methods=['GET'])
def get_device_info(resource_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Return device registration status and last_seen for a resource.
    Useful for the dashboard to show whether a hardware device is linked.
    """
    if not db:
        return jsonify({'resource_id': resource_id, 'linked': False, 'mock': True}), 200

    docs = db.collection('device_tokens') \
              .where('resource_id', '==', resource_id) \
              .limit(1).stream()
    found = next(docs, None)
    if not found:
        return jsonify({'resource_id': resource_id, 'linked': False}), 200

    info = found.to_dict()
    return jsonify({
        'resource_id': resource_id,
        'linked':      True,
        'device_name': info.get('device_name'),
        'created_at':  info.get('created_at'),
        'last_seen':   info.get('last_seen'),
    }), 200


@app.errorhandler(500)
def internal_error(error) -> Tuple[Dict[str, Any], int]:
    """Handle 500 errors."""
    return jsonify({
        "status": "error",
        "message": "Internal server error"
    }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
