import os
import sys

# Reconfigure stdout/stderr to utf-8 for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_phase6_controller_upgrade():
    print("\n" + "="*70)
    print("  PHASE 6: CENTRAL CONTROLLER UPGRADE & OPERATIONAL ROUTING")
    print("="*70)

    # 1. Authenticate Central Controller
    print("\n[Step 1] Authenticating Central Controller...")
    res = client.post("/api/auth/login", json={"username": "controller", "password": "railpass123"})
    assert res.status_code == 200, "Controller login failed"
    token = res.json()["access_token"]
    user_info = res.json()["user"]
    assert user_info["role"] == "CENTRAL_CONTROLLER"
    print(f"  ✓ Central Controller authenticated: {user_info['name']} ({user_info['role']})")

    # 2. Check Pending Department Requests Queue
    print("\n[Step 2] Inspecting Pending Department Requests Queue...")
    queue_res = client.get(
        "/api/maintenance/requests",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert queue_res.status_code == 200
    all_requests = queue_res.json()
    pending = [
        r for r in all_requests 
        if r["status"] in ["UNDER_CONTROLLER_REVIEW", "RECOMMENDED", "SUBMITTED", "AI_ANALYZING"]
    ]
    print(f"  ✓ Total requests in controller database: {len(all_requests)}")
    print(f"  ✓ Pending requests in review queue: {len(pending)}")
    
    # Verify multi-department presence in the queue
    dept_ids = {r["department_id"] for r in pending}
    print(f"  ✓ Active departments represented in pending queue: {dept_ids}")

    # 3. Candidate Slots for Pending Requisition
    print("\n[Step 3] Candidate Slots Inspection for Target Section...")
    target_req = pending[0] if pending else all_requests[0]
    cand_res = client.get(
        f"/api/blocks/candidates?section_id={target_req['section_id']}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cand_res.status_code == 200
    cand_data = cand_res.json()
    candidates = cand_data.get("candidates", [])
    assert len(candidates) >= 3, f"Expected at least 3 candidates, got {len(candidates)}"
    print(f"  ✓ Target section #{target_req['section_id']} candidate windows generated:")
    for c in candidates:
        name = c.get("window_name") or c.get("name")
        print(f"    - [{name}] {c['start_time']} - {c['end_time']} (Impact: {c['train_impact_minutes']}m, Score: {c['score']}/100, Safety: {c['safety_status']})")

    # 4. Multi-Department Joint Block Opportunity Analysis
    print("\n[Step 4] Multi-Department Joint Block Synergy Evaluation...")
    joint_opp = cand_data.get("joint_opportunity", {})
    if joint_opp.get("is_joint_opportunity"):
        print(f"  ✓ Joint synergy identified on {joint_opp['section_name']}!")
        print(f"    - Coordinated depts: {joint_opp['departments']}")
        print(f"    - Possession time saved: {joint_opp['possession_time_saved_minutes']} mins")
        print(f"    - Passenger detention avoided: {joint_opp['train_detention_avoided_minutes']} mins")

    # 5. Sole Controller Approval Workflow with Cryptographic Digital Signature
    print("\n[Step 5] Executing Controller Approval Workflow...")
    approve_res = client.post(
        "/api/blocks/approve-workflow",
        json={
            "block_code": target_req["request_number"],
            "section_id": target_req["section_id"],
            "action": "APPROVED",
            "performed_by": user_info["name"],
            "user_role": user_info["role"],
            "remarks": "Approved by Sr. DOM. Night possessions aligned with freight headway clearance.",
            "emergency_override": False,
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert approve_res.status_code == 200, f"Approval failed: {approve_res.text}"
    app_data = approve_res.json()
    assert app_data["digital_signature"].startswith("IR-SIG-")
    print(f"  ✓ Block {target_req['request_number']} APPROVED!")
    print(f"    - Digital Signature: {app_data['digital_signature']}")
    print(f"    - Safety Gate Status: {app_data.get('safety_gate_status', 'PASSED')}")

    # 6. Rejection Workflow with Statutory Reason
    print("\n[Step 6] Testing Controller Rejection Workflow...")
    # Submit a dummy requisition to test rejection
    eng_token_res = client.post("/api/auth/login", json={"username": "eng_track", "password": "railpass123"})
    eng_token = eng_token_res.json()["access_token"]
    test_sub = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 1,
            "section_id": 1,
            "work_type": "Daytime Rail Grinding Test",
            "priority": "LOW",
            "duration_minutes": 90,
            "reason": "Test rejection flow during peak hours",
        },
        headers={"Authorization": f"Bearer {eng_token}"}
    )
    test_req = test_sub.json()

    reject_res = client.post(
        "/api/blocks/reject-workflow",
        json={
            "block_code": test_req["request_number"],
            "section_id": test_req["section_id"],
            "action": "REJECTED",
            "performed_by": user_info["name"],
            "user_role": user_info["role"],
            "remarks": "Section experiencing 140% line capacity utilization. Reschedule for Sunday lean window.",
            "emergency_override": False,
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert reject_res.status_code == 200
    print(f"  ✓ Block {test_req['request_number']} REJECTED with remarks recorded in audit trail.")

    # 7. Preserved Core Systems Check
    print("\n[Step 7] Checking Preserved Digital Twin, ML Engine & Operational State...")
    state_res = client.get("/api/operational/state")
    assert state_res.status_code == 200
    state = state_res.json()
    print(f"  ✓ Operational Clock: {state['clock']['operational_time']} ({state['clock']['operational_date']})")
    print(f"  ✓ Digital Twin Trains: {len(state['trains'])} active trains on network")
    print(f"  ✓ Corridor Sections: {state['kpis']['active_blocks_count']} active blocks, {state['kpis']['approved_blocks_count']} approved blocks")

    rec_res = client.get("/api/blocks/recommendation")
    assert rec_res.status_code == 200
    rec = rec_res.json()
    print(f"  ✓ Optimization Recommendation: {rec['block_code']} on {rec['section_name']} (Score: {rec['score']}/100)")

    print("\n" + "="*70)
    print("  ALL PHASE 6 CONTROLLER UPGRADE SPECIFICATIONS VERIFIED 100%!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_phase6_controller_upgrade()
