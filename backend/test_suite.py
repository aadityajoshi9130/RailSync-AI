import urllib.request
import urllib.parse
import urllib.error
import json

BASE_URL = 'http://127.0.0.1:8000'
results = {}

def test_ep(name, method, path, json_data=None):
    url = f"{BASE_URL}{path}"
    data = None
    headers = {}
    if json_data is not None:
        data = json.dumps(json_data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.status
            body_text = response.read().decode('utf-8')
            try:
                body = json.loads(body_text)
            except:
                body = body_text[:200]
            results[name] = {'status': status, 'data': body}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8')
        try:
            body = json.loads(body_text)
        except:
            body = body_text[:200]
        results[name] = {'status': e.code, 'data': body}
    except Exception as e:
        results[name] = {'error': str(e)}

# 1. Health & Root
test_ep('root', 'GET', '/')
test_ep('health', 'GET', '/health')

# 2. Network
test_ep('stations_get', 'GET', '/api/network/stations')
test_ep('sections_get', 'GET', '/api/network/sections')
test_ep('station_post_valid', 'POST', '/api/network/stations', json_data={'name': 'Test Junction', 'code': 'TJ'})
test_ep('station_post_invalid', 'POST', '/api/network/stations', json_data={'name': 'Bad'}) # missing code
test_ep('station_post_sqli', 'POST', '/api/network/stations', json_data={'name': "' OR '1'='1", 'code': "';--"})

# 3. Trains
test_ep('trains_get', 'GET', '/api/trains')
test_ep('train_simulate_step', 'POST', '/api/trains/simulate-step')
test_ep('train_reset', 'POST', '/api/trains/reset')

# 4. Maintenance
test_ep('depts_get', 'GET', '/api/maintenance/departments')
test_ep('tasks_get', 'GET', '/api/maintenance/tasks')
test_ep('task_post_valid', 'POST', '/api/maintenance/tasks', json_data={'department_id': 1, 'section_id': 1, 'description': 'QA Rail Grind', 'priority': 'HIGH', 'duration_minutes': 90})
test_ep('task_post_invalid_dept', 'POST', '/api/maintenance/tasks', json_data={'department_id': 99999, 'section_id': 99999, 'description': 'FK test', 'priority': 'HIGH', 'duration_minutes': 90})

# 5. Blocks
test_ep('block_rec', 'GET', '/api/blocks/recommendation')
test_ep('block_conflicts', 'GET', '/api/blocks/conflicts?section_id=1')
test_ep('block_conflicts_invalid_sec', 'GET', '/api/blocks/conflicts?section_id=99999')
test_ep('block_approve', 'POST', '/api/blocks/approve')
test_ep('blocks_list', 'GET', '/api/blocks')

# 6. Analytics
test_ep('analytics_summary', 'GET', '/api/analytics/summary')
test_ep('analytics_trend', 'GET', '/api/analytics/punctuality-trend')
test_ep('analytics_congestion', 'GET', '/api/analytics/hourly-congestion')
test_ep('analytics_audit', 'GET', '/api/analytics/audit-history')
test_ep('analytics_predict', 'POST', '/api/analytics/predict-delay', json_data={'section_id': 1, 'departure_hour': 10, 'day_of_week': 2, 'has_active_block': 1, 'is_vande_bharat': 1})
test_ep('analytics_predict_bad', 'POST', '/api/analytics/predict-delay', json_data={'departure_hour': 'bad_hour'})

# 7. Phase 4 AI & Explainable AI (XAI)
test_ep('phase4_explain_xai', 'GET', '/api/blocks/explain-recommendation/Block%20A-17')
test_ep('phase4_feature_importance', 'GET', '/api/blocks/feature-importance')
test_ep('phase4_predict_risk', 'POST', '/api/blocks/predict-risk', json_data={'section_id': 2, 'duration_minutes': 180, 'departments_count': 3, 'start_hour': 2})

# 8. Phase 4 Human Approval & Cryptographic Audit Trail
test_ep('phase4_approve_workflow', 'POST', '/api/blocks/approve-workflow', json_data={'block_code': 'Block A-17', 'section_id': 1, 'action': 'APPROVED', 'performed_by': 'Chief Operations Controller', 'user_role': 'Chief Controller', 'remarks': 'Automated QA suite verified'})
test_ep('phase4_audit_trail', 'GET', '/api/blocks/audit-trail')

with open('test_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Test suite completed successfully. Results written to test_results.json")
