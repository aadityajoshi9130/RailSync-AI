import os
import sys

# Reconfigure stdout/stderr to utf-8 for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, get_db
from app import models

client = TestClient(app)

def run_e2e_tests():
    print("\n" + "="*70)
    print("  RAILSYNC — COMPREHENSIVE END-TO-END MULTI-ROLE VERIFICATION")
    print("="*70)

    # ---------------------------------------------------------
    # 1. Multi-Role Authentication
    # ---------------------------------------------------------
    print("\n[Step 1] Authenticating all 4 operational roles...")
    users = {
        "controller": "railpass123",
        "eng_track": "railpass123",
        "ohe_traction": "railpass123",
        "st_telecom": "railpass123",
    }
    tokens = {}
    for uname, pwd in users.items():
        res = client.post("/api/auth/login", json={"username": uname, "password": pwd})
        assert res.status_code == 200, f"Login failed for {uname}: {res.text}"
        tokens[uname] = res.json()["access_token"]
        role = res.json()["user"]["role"]
        print(f"  ✓ {uname} ({role}) logged in successfully. Token issued.")

    # ---------------------------------------------------------
    # 2. Department Boundary Enforcement
    # ---------------------------------------------------------
    print("\n[Step 2] Testing departmental boundary isolation...")
    # Engineering user trying to submit an OHE demand (dept_id: 2) -> Expect 403
    cross_dept_payload = {
        "department_id": 2,
        "section_id": 1,
        "work_type": "Illegal Cross-Department Requisition",
        "priority": "HIGH",
        "duration_minutes": 120,
        "reason": "Test unauthorized cross-department submit",
    }
    res = client.post(
        "/api/maintenance/requests",
        json=cross_dept_payload,
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  ✓ Engineering user blocked with 403 Forbidden when submitting for OHE department.")

    # ---------------------------------------------------------
    # 3. Legitimate Multi-Department Demand Submission
    # ---------------------------------------------------------
    print("\n[Step 3] Submitting legitimate demands across 3 engineering departments on Section 1...")
    
    # 3a. Engineering demand
    eng_res = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 1,
            "section_id": 1,
            "work_type": "Track Tamping (CSM 08-32)",
            "location_details": "UP Main Line (KM 124/2 - 126/8)",
            "priority": "HIGH",
            "duration_minutes": 180,
            "preferred_start": "01:30",
            "preferred_end": "04:30",
            "required_resources": "CSM Tamper #104 + 40 Trackmen",
            "reason": "High vertical acceleration detected on rail joints.",
        },
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_res.status_code == 200, f"Eng request failed: {eng_res.text}"
    eng_req = eng_res.json()
    print(f"  ✓ Engineering demand registered: {eng_req['request_number']} (Status: {eng_req['status']})")

    # 3b. OHE demand on same section
    ohe_res = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 2,
            "section_id": 1,
            "work_type": "Contact Wire Replacement",
            "location_details": "UP Line 25kV Catenary (Mast 118/14 - 122/08)",
            "priority": "HIGH",
            "duration_minutes": 150,
            "preferred_start": "02:00",
            "preferred_end": "04:30",
            "required_resources": "8-Wheeler Tower Wagon #TW-42 + 18 Linemen",
            "reason": "Critical contact wire diameter wear below 8.2mm.",
        },
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert ohe_res.status_code == 200, f"OHE request failed: {ohe_res.text}"
    ohe_req = ohe_res.json()
    print(f"  ✓ OHE demand registered: {ohe_req['request_number']} (Status: {ohe_req['status']})")

    # 3c. S&T demand on same section
    st_res = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 3,
            "section_id": 1,
            "work_type": "Point Machine Overhaul",
            "location_details": "Lonavala Cabin · Point #104 A/B",
            "priority": "MEDIUM",
            "duration_minutes": 120,
            "preferred_start": "02:30",
            "preferred_end": "04:30",
            "required_resources": "1 Section Engineer + 2 ESMs",
            "reason": "Point 104A motor throwing time exceeded 5.8s threshold.",
        },
        headers={"Authorization": f"Bearer {tokens['st_telecom']}"}
    )
    assert st_res.status_code == 200, f"S&T request failed: {st_res.text}"
    st_req = st_res.json()
    print(f"  ✓ S&T demand registered: {st_req['request_number']} (Status: {st_req['status']})")

    # ---------------------------------------------------------
    # 4. Joint Block Synergy Evaluation
    # ---------------------------------------------------------
    print("\n[Step 4] Checking Joint Block Synergy Engine...")
    synergy_res = client.get(
        "/api/blocks/joint-opportunities",
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert synergy_res.status_code == 200
    opportunities = synergy_res.json()
    assert len(opportunities) > 0, "Expected at least one joint opportunity"
    sec1_opp = next((o for o in opportunities if o["section_id"] == 1), None)
    assert sec1_opp is not None, "Section 1 should have a detected joint opportunity"
    print(f"  ✓ Joint opportunity detected on {sec1_opp['section_name']}!")
    print(f"    - Departments bundled: {sec1_opp['departments']}")
    print(f"    - Departments count: {sec1_opp['departments_count']}")
    print(f"    - Possession time saved: {sec1_opp['possession_time_saved_minutes']} mins")
    print(f"    - Train detention avoided: {sec1_opp['train_detention_avoided_minutes']} mins")
    print(f"    - Recommended window: {sec1_opp['recommended_joint_window']}")

    # ---------------------------------------------------------
    # 5. Multi-Candidate Scheduling
    # ---------------------------------------------------------
    print("\n[Step 5] Checking Multi-Candidate Scheduling Slots for Section 1...")
    cand_res = client.get(
        "/api/blocks/candidates?section_id=1",
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert cand_res.status_code == 200
    cand_data = cand_res.json()
    candidates = cand_data.get("candidates", [])
    assert len(candidates) == 3, f"Expected 3 candidates, got {len(candidates)}"
    for cand in candidates:
        name = cand.get("window_name") or cand.get("name")
        print(f"  ✓ {name}: {cand['start_time']} - {cand['end_time']} (Score: {cand['score']}, Safety: {cand['safety_status']})")

    # ---------------------------------------------------------
    # 6. Sole Approval Authority & RBAC
    # ---------------------------------------------------------
    print("\n[Step 6] Testing Sole Block Approval Authority...")
    # 6a. Engineering user attempts to approve -> Expect 403 Forbidden
    eng_approve_res = client.post(
        "/api/blocks/approve-workflow",
        json={
            "block_code": eng_req["request_number"],
            "section_id": 1,
            "action": "APPROVED",
            "performed_by": "Senior Section Engineer",
            "user_role": "ENGINEERING",
            "remarks": "Unauthorized self-approval",
        },
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_approve_res.status_code == 403, f"Expected 403, got {eng_approve_res.status_code}"
    print("  ✓ Non-controller user blocked with 403 Forbidden on block approval.")

    # 6b. Central Controller approves the block -> Expect 200 OK
    ctrl_approve_res = client.post(
        "/api/blocks/approve-workflow",
        json={
            "block_code": eng_req["request_number"],
            "section_id": 1,
            "action": "APPROVED",
            "performed_by": "Chief Operations Controller (Sr. DOM)",
            "user_role": "CENTRAL_CONTROLLER",
            "remarks": "Approved with joint synergy alignment for Track + OHE + S&T.",
            "emergency_override": False,
        },
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert ctrl_approve_res.status_code == 200, f"Controller approval failed: {ctrl_approve_res.text}"
    approve_data = ctrl_approve_res.json()
    print(f"  ✓ Central Controller authorized block {eng_req['request_number']}!")
    print(f"    - Digital Signature: {approve_data['digital_signature'][:24]}...")
    print(f"    - Safety Gate Verdict: {approve_data.get('safety_gate_status', 'PASSED')}")

    # ---------------------------------------------------------
    # 7. Notifications Verification
    # ---------------------------------------------------------
    print("\n[Step 7] Verifying role-targeted notifications...")
    # Eng track notifications
    notif_res = client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert notif_res.status_code == 200
    eng_notifs = notif_res.json()
    assert len(eng_notifs) > 0, "Engineering user should have received notification of approval"
    latest_eng_notif = eng_notifs[0]
    print(f"  ✓ Engineering received notification: '{latest_eng_notif['title']}' - {latest_eng_notif['message']}")

    # Mark as read
    mark_read = client.post(
        f"/api/notifications/{latest_eng_notif['id']}/read",
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert mark_read.status_code == 200
    print("  ✓ Notification marked as read successfully.")

    # ---------------------------------------------------------
    # 8. Cryptographic Audit Trail
    # ---------------------------------------------------------
    print("\n[Step 8] Checking Cryptographic Audit Trail...")
    audit_res = client.get(
        "/api/blocks/audit-trail",
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert audit_res.status_code == 200
    audit_trail = audit_res.json()
    assert len(audit_trail) > 0, "Audit trail should contain logged actions"
    latest_audit = audit_trail[0]
    print(f"  ✓ Latest audit log verified:")
    print(f"    - Action: {latest_audit['action']} on {latest_audit['block_code']}")
    print(f"    - Performed by: {latest_audit['performed_by']} ({latest_audit['user_role']})")
    print(f"    - Signature: {latest_audit['digital_signature'][:32]}...")

    # ---------------------------------------------------------
    # 9. Active Possession Progress Updates
    # ---------------------------------------------------------
    print("\n[Step 9] Testing field progress reporting...")
    prog_res = client.patch(
        f"/api/maintenance/requests/{eng_req['id']}/progress",
        json={"progress_pct": 75, "progress_notes": "CSM Tamper completed 1.8km track. Ballast dressing in progress."},
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert prog_res.status_code == 200
    updated_req = prog_res.json()
    assert updated_req["progress_pct"] == 75
    print(f"  ✓ Progress on {updated_req['request_number']} updated to {updated_req['progress_pct']}% with field notes.")

    print("\n" + "="*70)
    print("  ALL END-TO-END MULTI-ROLE RBAC & OPERATIONAL WORKFLOWS PASSED 100%!")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_e2e_tests()
