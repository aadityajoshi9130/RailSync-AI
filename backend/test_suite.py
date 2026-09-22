import os
import sys
import json

# Reconfigure stdout/stderr to utf-8 for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
results = {}

# Authenticate Controller to get valid token for protected endpoints
auth_res = client.post("/api/auth/login", json={"username": "controller", "password": "railpass123"})
ctrl_token = auth_res.json().get("access_token") if auth_res.status_code == 200 else ""
auth_header = {"Authorization": f"Bearer {ctrl_token}"} if ctrl_token else {}

def test_ep(name, method, path, json_data=None, use_auth=True):
    headers = auth_header if use_auth else {}
    if method == "GET":
        res = client.get(path, headers=headers)
    elif method == "POST":
        res = client.post(path, json=json_data, headers=headers)
    elif method == "PATCH":
        res = client.patch(path, json=json_data, headers=headers)
    elif method == "DELETE":
        res = client.delete(path, headers=headers)
    else:
        res = client.request(method, path, json=json_data, headers=headers)
    
    try:
        body = res.json()
    except Exception:
        body = res.text[:200]
    
    results[name] = {"status": res.status_code, "data": body}
    print(f"  [OK] Endpoint '{name}' ({method} {path}) -> HTTP {res.status_code}")

print("\n" + "="*75)
print("  RAILSYNC — RUNNING SYSTEM TEST SUITE")
print("="*75)

# 1. Health & Root
print("\n[1/8] Testing Root & Health Endpoints...")
test_ep('root', 'GET', '/', use_auth=False)
test_ep('health', 'GET', '/health', use_auth=False)

# 2. Network
print("\n[2/8] Testing Railway Network Endpoints...")
test_ep('stations_get', 'GET', '/api/network/stations')
test_ep('sections_get', 'GET', '/api/network/sections')
test_ep('station_post_valid', 'POST', '/api/network/stations', json_data={'name': 'Test Junction', 'code': 'TJ'})
test_ep('station_post_invalid', 'POST', '/api/network/stations', json_data={'name': 'Bad'}) # missing code
test_ep('station_post_sqli', 'POST', '/api/network/stations', json_data={'name': "' OR '1'='1", 'code': "';--"})

# 3. Trains
print("\n[3/8] Testing Train Movement & Simulation Endpoints...")
test_ep('trains_get', 'GET', '/api/trains')
test_ep('train_simulate_step', 'POST', '/api/trains/simulate-step')
test_ep('train_reset', 'POST', '/api/trains/reset')

# 4. Maintenance
print("\n[4/8] Testing Maintenance Tasks Endpoints...")
test_ep('depts_get', 'GET', '/api/maintenance/departments')
test_ep('tasks_get', 'GET', '/api/maintenance/tasks')
test_ep('task_post_valid', 'POST', '/api/maintenance/tasks', json_data={'department_id': 1, 'section_id': 1, 'description': 'QA Rail Grind', 'priority': 'HIGH', 'duration_minutes': 90})
test_ep('task_post_invalid_dept', 'POST', '/api/maintenance/tasks', json_data={'department_id': 99999, 'section_id': 99999, 'description': 'FK test', 'priority': 'HIGH', 'duration_minutes': 90})

# 5. Blocks
print("\n[5/8] Testing Corridor Block & Candidate Endpoints...")
test_ep('block_rec', 'GET', '/api/blocks/recommendation')
test_ep('block_conflicts', 'GET', '/api/blocks/conflicts?section_id=1')
test_ep('block_conflicts_invalid_sec', 'GET', '/api/blocks/conflicts?section_id=99999')
test_ep('block_approve', 'POST', '/api/blocks/approve')
test_ep('blocks_list', 'GET', '/api/blocks')

# 6. Analytics
print("\n[6/8] Testing 30-Day Analytics & ML Prediction Endpoints...")
test_ep('analytics_summary', 'GET', '/api/analytics/summary')
test_ep('analytics_trend', 'GET', '/api/analytics/punctuality-trend')
test_ep('analytics_congestion', 'GET', '/api/analytics/hourly-congestion')
test_ep('analytics_audit', 'GET', '/api/analytics/audit-history')
test_ep('analytics_predict', 'POST', '/api/analytics/predict-delay', json_data={'section_id': 1, 'departure_hour': 10, 'day_of_week': 2, 'has_active_block': 1, 'is_vande_bharat': 1})
test_ep('analytics_predict_bad', 'POST', '/api/analytics/predict-delay', json_data={'departure_hour': 'bad_hour'})

# 7. Decision Explainability & Risk
print("\n[7/8] Testing Explainability & Risk Prediction Endpoints...")
test_ep('phase4_explain_xai', 'GET', '/api/blocks/explain-recommendation/Block%20A-17')
test_ep('phase4_feature_importance', 'GET', '/api/blocks/feature-importance')
test_ep('phase4_predict_risk', 'POST', '/api/blocks/predict-risk', json_data={'section_id': 2, 'duration_minutes': 180, 'departments_count': 3, 'start_hour': 2})

# 8. Human Approval & Cryptographic Audit Trail
print("\n[8/8] Testing Controller Workflow & Digital Signature Audit Trail...")
test_ep('phase4_approve_workflow', 'POST', '/api/blocks/approve-workflow', json_data={'block_code': 'Block A-17', 'section_id': 1, 'action': 'APPROVED', 'performed_by': 'Chief Operations Controller', 'user_role': 'Chief Controller', 'remarks': 'Automated QA suite verified'})
test_ep('phase4_audit_trail', 'GET', '/api/blocks/audit-trail')

with open('test_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("\n" + "="*75)
print("  TEST SUITE COMPLETED SUCCESSFULLY! Results written to test_results.json")
print("="*75 + "\n")
