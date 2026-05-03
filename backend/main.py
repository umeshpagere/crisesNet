import os
import time
from datetime import datetime
from typing import Dict, Any, Tuple
from flask import Flask, request, jsonify
try:
    from google.cloud import firestore
except ImportError:
    firestore = None
from backend.services.allocation_optimizer import AllocationOptimizer

app = Flask(__name__)

PROJECT_ID = "crisisnet-2026"
API_VERSION = "0.1.0"

try:
    db = firestore.Client(project=PROJECT_ID) if firestore else None
    if db is None and firestore is None:
        print("Warning: google-cloud-firestore not installed, running in mock mode")
except Exception as e:
    print(f"Warning: Failed to initialize Firestore client: {e}")
    db = None


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


@app.errorhandler(404)
def not_found(error) -> Tuple[Dict[str, Any], int]:
    """Handle 404 errors."""
    return jsonify({
        "status": "error",
        "message": "Endpoint not found"
    }), 404


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
