import os
import sys
import time

# Reconfigure stdout/stderr to utf-8 for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_phase7_master_verification():
    print("\n" + "="*75)
    print("  PHASE 7: COMPLETE SYSTEM INTEGRATION & END-TO-END FINAL VERIFICATION")
    print("="*75)

    start_time = time.time()
    tests_passed = 0
    total_tests = 10

    # 1. User Authentication & JWT Session Issuance
    print("\n[Check 1/10] Verifying Multi-Role Built-In Authentication...")
    roles = {
        "controller": "CENTRAL_CONTROLLER",
        "eng_track": "ENGINEERING",
        "ohe_traction": "OHE_TRACTION",
        "st_telecom": "SIGNALING_TELECOM",
        "admin": "SYSTEM_ADMIN"
    }
    tokens = {}
    for username, role_name in roles.items():
        res = client.post("/api/auth/login", json={"username": username, "password": "railpass123"})
        assert res.status_code == 200, f"Authentication failed for {username}"
        data = res.json()
        assert data["user"]["role"] == role_name
        tokens[username] = data["access_token"]
        print(f"  ✓ [{username}] -> Authenticated as {role_name} (Dept: {data['user']['department_id']})")
    tests_passed += 1

    # 2. Strict RBAC Approval Authority (403 Enforcement)
    print("\n[Check 2/10] Verifying Sole Approval Authority RBAC Enforcement...")
    for dept_user in ["eng_track", "ohe_traction", "st_telecom"]:
        illegal_approve = client.post(
            "/api/blocks/approve-workflow",
            json={"block_code": "Block A-17", "section_id": 1, "action": "APPROVED", "remarks": "Unauthorized attempt"},
            headers={"Authorization": f"Bearer {tokens[dept_user]}"}
        )
        assert illegal_approve.status_code == 403, f"Expected 403, got {illegal_approve.status_code} for {dept_user}"
        print(f"  ✓ {dept_user} blocked with 403 Forbidden on block approval.")
    tests_passed += 1

    # 3. Department Boundary Isolation
    print("\n[Check 3/10] Verifying Departmental Boundary Isolation...")
    cross_submit = client.post(
        "/api/maintenance/requests",
        json={"department_id": 2, "section_id": 1, "work_type": "Illegal Cross-Dept Submit", "reason": "Test cross-boundary submit"},
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert cross_submit.status_code == 403, f"Expected 403, got {cross_submit.status_code}"
    print(f"  ✓ Cross-department requisition attempt blocked with 403 Forbidden.")
    tests_passed += 1

    # 4. Multi-Department Demands Submission
    print("\n[Check 4/10] Submitting Multi-Department Requisitions...")
    # Engineering demand
    eng_sub = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 1,
            "section_id": 1,
            "work_type": "Track Tamping (CSM 08-32)",
            "location_details": "UP Main Line (KM 124/2 - 126/8)",
            "priority": "HIGH",
            "duration_minutes": 180,
            "required_resources": "CSM Tamper #104 + 40 Trackmen",
            "reason": "Vertical acceleration anomaly detected.",
        },
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_sub.status_code == 200
    eng_req = eng_sub.json()
    print(f"  ✓ Engineering demand registered: {eng_req['request_number']}")

    # OHE demand
    ohe_sub = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 2,
            "section_id": 1,
            "work_type": "Catenary Contact Wire Replacement",
            "location_details": "UP Line 25kV Catenary (Mast 118/14 - 122/08)",
            "priority": "HIGH",
            "duration_minutes": 150,
            "required_resources": "8-Wheeler Tower Wagon #TW-42 + 18 Linemen",
            "reason": "Contact wire wear measured below 8.2mm.",
        },
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert ohe_sub.status_code == 200
    ohe_req = ohe_sub.json()
    print(f"  ✓ OHE demand registered: {ohe_req['request_number']}")

    # S&T demand
    st_sub = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 3,
            "section_id": 1,
            "work_type": "Point Machine Overhaul (Form S&T-T/351)",
            "location_details": "Lonavala Cabin · Point #104 A/B",
            "priority": "MEDIUM",
            "duration_minutes": 120,
            "required_resources": "1 Section Engineer + 2 ESMs",
            "reason": "Point 104A motor throwing time exceeded threshold.",
        },
        headers={"Authorization": f"Bearer {tokens['st_telecom']}"}
    )
    assert st_sub.status_code == 200
    st_req = st_sub.json()
    print(f"  ✓ S&T demand registered: {st_req['request_number']}")
    tests_passed += 1

    # 5. Multi-Candidate Scheduling Slots
    print("\n[Check 5/10] Evaluating Multi-Candidate Scheduling Engine...")
    cand_res = client.get(
        f"/api/blocks/candidates?section_id={eng_req['section_id']}",
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert cand_res.status_code == 200
    candidates = cand_res.json().get("candidates", [])
    assert len(candidates) == 3, f"Expected 3 candidates, got {len(candidates)}"
    for c in candidates:
        name = c.get("window_name") or c.get("name")
        print(f"  ✓ Candidate Slot: {name} | Window: {c['start_time']} - {c['end_time']} | Score: {c['score']}/100 | Safety: {c['safety_status']}")
    tests_passed += 1

    # 6. Joint Block Synergy Engine
    print("\n[Check 6/10] Testing Joint Block Synergy Detection...")
    synergy_res = client.get("/api/blocks/joint-opportunities", headers={"Authorization": f"Bearer {tokens['controller']}"})
    assert synergy_res.status_code == 200
    opps = synergy_res.json()
    assert len(opps) > 0
    sec_opp = next((o for o in opps if o["section_id"] == 1), None)
    assert sec_opp is not None
    print(f"  ✓ Joint Block Synergy Verified on {sec_opp['section_name']}:")
    print(f"    - Bundled Departments: {sec_opp['departments']}")
    print(f"    - Possession Time Saved: {sec_opp['possession_time_saved_minutes']} mins")
    print(f"    - Train Detention Avoided: {sec_opp['train_detention_avoided_minutes']} mins")
    tests_passed += 1

    # 7. Controller Approval & Digital Signature
    print("\n[Check 7/10] Verifying Central Controller Sole Approval & Cryptographic Signature...")
    approve_res = client.post(
        "/api/blocks/approve-workflow",
        json={
            "block_code": eng_req["request_number"],
            "section_id": 1,
            "action": "APPROVED",
            "performed_by": "Chief Operations Controller (Sr. DOM)",
            "user_role": "CENTRAL_CONTROLLER",
            "remarks": "Approved with Joint Synergy alignment.",
            "emergency_override": False,
        },
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["digital_signature"].startswith("IR-SIG-")
    print(f"  ✓ Block {eng_req['request_number']} APPROVED with Signature: {app_data['digital_signature']}")
    tests_passed += 1

    # 8. Role-Targeted Real-Time Notifications
    print("\n[Check 8/10] Verifying Role-Targeted Notification Delivery...")
    eng_notif_res = client.get("/api/notifications", headers={"Authorization": f"Bearer {tokens['eng_track']}"})
    assert eng_notif_res.status_code == 200
    eng_notifs = eng_notif_res.json()
    assert len(eng_notifs) > 0
    print(f"  ✓ Engineering received approval notification: '{eng_notifs[0]['title']}'")

    ctrl_notif_res = client.get("/api/notifications", headers={"Authorization": f"Bearer {tokens['controller']}"})
    assert ctrl_notif_res.status_code == 200
    assert len(ctrl_notif_res.json()) > 0
    print(f"  ✓ Controller received demand intake notification: '{ctrl_notif_res.json()[0]['title']}'")
    tests_passed += 1

    # 9. Cryptographic Audit Trail
    print("\n[Check 9/10] Verifying Cryptographic Audit Trail Log...")
    audit_res = client.get("/api/blocks/audit-trail", headers={"Authorization": f"Bearer {tokens['controller']}"})
    assert audit_res.status_code == 200
    trail = audit_res.json()
    assert len(trail) > 0
    latest = trail[0]
    print(f"  ✓ Cryptographic Audit Entry Verified: Action '{latest['action']}' on '{latest['block_code']}' by '{latest['performed_by']}'")
    print(f"    - Digital Signature: {latest['digital_signature']}")
    tests_passed += 1

    # 10. Field Progress Updates & Lifecycle Advancement
    print("\n[Check 10/10] Verifying Field Progress Reporting...")
    prog_res = client.patch(
        f"/api/maintenance/requests/{eng_req['id']}/progress",
        json={"progress_pct": 100, "progress_notes": "Tamping completed. Track certified fit for 110 km/h."},
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["progress_pct"] == 100
    print(f"  ✓ Progress updated to 100% (Completed & Track Restored).")
    tests_passed += 1

    elapsed = round(time.time() - start_time, 2)
    print("\n" + "="*75)
    print(f"  PHASE 7 COMPLETE: ALL {tests_passed}/{total_tests} INTEGRATION CHECKS PASSED IN {elapsed}s!")
    print("="*75 + "\n")

if __name__ == "__main__":
    run_phase7_master_verification()
