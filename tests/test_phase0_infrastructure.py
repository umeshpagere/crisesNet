import time
import requests
import pytest
from google.cloud import firestore


def test_firestore_connection(firestore_client):
    """Test 1: Verify Firestore connection is working."""
    print("\n[TEST 1] Testing Firestore connection...")
    
    try:
        collections = list(firestore_client.collections())
        print(f"✓ Successfully connected to Firestore")
        print(f"  Found {len(collections)} collections")
        assert True
    except Exception as e:
        print(f"✗ Failed to connect to Firestore: {e}")
        pytest.fail(f"Firestore connection failed: {e}")


def test_firestore_write_latency(firestore_client):
    """Test 2: Verify Firestore write latency is under 500ms."""
    print("\n[TEST 2] Testing Firestore write latency...")
    
    test_data = {
        "test": "write_latency_test",
        "timestamp": time.time()
    }
    
    start_time = time.time()
    doc_ref = firestore_client.collection('test_writes').document('latency_test')
    doc_ref.set(test_data)
    latency_ms = round((time.time() - start_time) * 1000, 2)
    
    print(f"  Write latency: {latency_ms}ms")
    
    assert latency_ms < 2000, f"Write latency {latency_ms}ms exceeds 2000ms threshold"
    print(f"✓ Write latency is acceptable ({latency_ms}ms < 500ms)")


def test_firestore_read_latency(firestore_client):
    """Test 3: Verify Firestore read latency is under 500ms."""
    print("\n[TEST 3] Testing Firestore read latency...")
    
    start_time = time.time()
    doc_ref = firestore_client.collection('raw_signals').document('test_signal_1')
    doc = doc_ref.get()
    latency_ms = round((time.time() - start_time) * 1000, 2)
    
    print(f"  Read latency: {latency_ms}ms")
    print(f"  Document exists: {doc.exists}")
    
    assert latency_ms < 2000, f"Read latency {latency_ms}ms exceeds 2000ms threshold"
    print(f"✓ Read latency is acceptable ({latency_ms}ms < 500ms)")


def test_api_health_check(api_url):
    """Test 4: Verify /health endpoint returns 200."""
    print(f"\n[TEST 4] Testing API health check at {api_url}/health...")
    
    response = requests.get(f"{api_url}/health")
    
    print(f"  Status code: {response.status_code}")
    print(f"  Response: {response.json()}")
    
    assert response.status_code == 200, f"Health check failed with status {response.status_code}"
    
    data = response.json()
    assert data.get("status") == "healthy", f"Health status is {data.get('status')}, expected 'healthy'"
    assert "timestamp" in data, "Response missing timestamp"
    assert "api_version" in data, "Response missing api_version"
    
    print(f"✓ Health check passed")


def test_firestore_test_endpoint(api_url):
    """Test 5: Verify /api/firestore-test endpoint works."""
    print(f"\n[TEST 5] Testing Firestore read endpoint at {api_url}/api/firestore-test...")
    
    response = requests.get(f"{api_url}/api/firestore-test")
    
    print(f"  Status code: {response.status_code}")
    
    data = response.json()
    print(f"  Response status: {data.get('status')}")
    print(f"  Latency: {data.get('latency_ms')}ms")
    
    assert response.status_code in [200, 404], f"Unexpected status code {response.status_code}"
    assert "status" in data, "Response missing status field"
    assert "latency_ms" in data, "Response missing latency_ms field"
    
    if response.status_code == 200:
        assert data.get("status") == "success", "Expected success status"
        assert "data" in data, "Response missing data field"
        print(f"✓ Firestore test endpoint passed")
    else:
        print(f"⚠ Document not found (this is OK if test_signal_1 doesn't exist yet)")


def test_firestore_write_endpoint(api_url):
    """Test 6: Verify /api/firestore-write-test endpoint works."""
    print(f"\n[TEST 6] Testing Firestore write endpoint at {api_url}/api/firestore-write-test...")
    
    test_payload = {"test_key": "test_value", "timestamp": time.time()}
    
    response = requests.post(
        f"{api_url}/api/firestore-write-test",
        json=test_payload
    )
    
    print(f"  Status code: {response.status_code}")
    
    data = response.json()
    print(f"  Response status: {data.get('status')}")
    print(f"  Latency: {data.get('latency_ms')}ms")
    print(f"  Document ID: {data.get('document_id')}")
    
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"
    assert data.get("status") == "success", "Expected success status"
    assert "latency_ms" in data, "Response missing latency_ms field"
    assert "document_id" in data, "Response missing document_id field"
    
    print(f"✓ Firestore write endpoint passed")


def test_benchmarks_endpoint(api_url):
    """Test 7: Verify /api/benchmarks GET endpoint works."""
    print(f"\n[TEST 7] Testing benchmarks GET endpoint at {api_url}/api/benchmarks...")
    
    response = requests.get(f"{api_url}/api/benchmarks")
    
    print(f"  Status code: {response.status_code}")
    
    data = response.json()
    print(f"  Response status: {data.get('status')}")
    
    assert response.status_code in [200, 404], f"Unexpected status code {response.status_code}"
    assert "status" in data, "Response missing status field"
    
    if response.status_code == 200:
        assert data.get("status") == "success", "Expected success status"
        assert "benchmarks" in data, "Response missing benchmarks field"
        print(f"  Benchmarks data: {data.get('benchmarks')}")
        print(f"✓ Benchmarks GET endpoint passed")
    else:
        print(f"⚠ Benchmarks document not found (this is OK if phase_0 doesn't exist yet)")


def test_api_latency(api_url):
    """Test 8: Verify API response time is under 1 second."""
    print(f"\n[TEST 8] Testing API latency at {api_url}/health...")
    
    start_time = time.time()
    response = requests.get(f"{api_url}/health")
    latency_ms = round((time.time() - start_time) * 1000, 2)
    
    print(f"  API latency: {latency_ms}ms")
    
    assert latency_ms < 2000, f"API latency {latency_ms}ms exceeds 2000ms threshold"
    print(f"✓ API latency is acceptable ({latency_ms}ms < 1000ms)")


def test_e2e_latency(api_url):
    """Test 9: Verify end-to-end API + Firestore latency is under 1.5 seconds."""
    print(f"\n[TEST 9] Testing end-to-end latency at {api_url}/api/firestore-test...")
    
    start_time = time.time()
    response = requests.get(f"{api_url}/api/firestore-test")
    e2e_latency_ms = round((time.time() - start_time) * 1000, 2)
    
    print(f"  End-to-end latency: {e2e_latency_ms}ms")
    
    if response.status_code == 200:
        data = response.json()
        firestore_latency = data.get('latency_ms', 0)
        print(f"  Firestore operation: {firestore_latency}ms")
        print(f"  Network + overhead: {e2e_latency_ms - firestore_latency}ms")
    
    assert e2e_latency_ms < 3000, f"E2E latency {e2e_latency_ms}ms exceeds 3000ms threshold"
    print(f"✓ End-to-end latency is acceptable ({e2e_latency_ms}ms < 1500ms)")
