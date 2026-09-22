from fastapi.testclient import TestClient
from app.main import app

def test_phase3():
    print("=== Phase 3: Request Lifecycle, Notifications & Extended Audit Verification ===")
    client = TestClient(app)

    # 1. Authenticate users
    eng_token = client.post("/api/auth/login", json={"username": "eng_track", "password": "railpass123"}).json()["access_token"]
    ohe_token = client.post("/api/auth/login", json={"username": "ohe_traction", "password": "railpass123"}).json()["access_token"]
    st_token = client.post("/api/auth/login", json={"username": "st_telecom", "password": "railpass123"}).json()["access_token"]
    ctrl_token = client.post("/api/auth/login", json={"username": "controller", "password": "railpass123"}).json()["access_token"]
    print("[OK] Authenticated tokens retrieved for all 4 operational roles!")

    # 2. Engineering User submits Track Maintenance Request
    eng_payload = {
        "department_id": 1,
        "section_id": 1,
        "work_type": "Track Renewal & Tamping",
        "location_details": "Km 114/2 - 116/8 UP Main Line",
        "asset_id": "TRK-PUN-01",
        "priority": "HIGH",
        "duration_minutes": 180,
        "preferred_date": "2026-09-22",
        "preferred_start": "02:00",
        "preferred_end": "05:00",
        "required_resources": "1x BCM, 1x CSM Tamper, 15 Gangmen",
        "reason": "Deep screening required to eliminate 30 km/h caution order."
    }
    res_eng = client.post("/api/maintenance/requests", headers={"Authorization": f"Bearer {eng_token}"}, json=eng_payload)
    assert res_eng.status_code == 200, f"Submission failed: {res_eng.text}"
    req_eng_data = res_eng.json()
    eng_req_id = req_eng_data["id"]
    eng_req_number = req_eng_data["request_number"]
    assert eng_req_number.startswith("REQ-ENG-")
    assert req_eng_data["status"] == "UNDER_CONTROLLER_REVIEW"
    print(f"[OK] Engineering submitted demand: {eng_req_number} (Status: {req_eng_data['status']})")

    # 3. Department Isolation Check: Engineering attempts to submit for OHE (Dept 2) -> 403 Forbidden!
    bad_dept = client.post(
        "/api/maintenance/requests",
        headers={"Authorization": f"Bearer {eng_token}"},
        json={**eng_payload, "department_id": 2, "work_type": "Unauthorized OHE request"}
    )
    assert bad_dept.status_code == 403, f"Expected 403, got {bad_dept.status_code}"
    print(f"[OK] Cross-department submission blocked with 403 Forbidden: {bad_dept.json()['detail']}")

    # 4. OHE User submits Traction Maintenance Request
    ohe_payload = {
        "department_id": 2,
        "section_id": 1,
        "work_type": "OHE Catenary & Contact Wire Overhaul",
        "location_details": "Km 113 - 117 Both Lines",
        "asset_id": "OHE-LON-02",
        "priority": "HIGH",
        "duration_minutes": 150,
        "preferred_date": "2026-09-22",
        "preferred_start": "02:30",
        "preferred_end": "05:00",
        "required_resources": "1x Tower Wagon, 8 OHE Linemen",
        "reason": "Annual bracket inspection and dropper renewal."
    }
    res_ohe = client.post("/api/maintenance/requests", headers={"Authorization": f"Bearer {ohe_token}"}, json=ohe_payload)
    assert res_ohe.status_code == 200
    ohe_req_data = res_ohe.json()
    ohe_req_id = ohe_req_data["id"]
    ohe_req_number = ohe_req_data["request_number"]
    assert ohe_req_number.startswith("REQ-OHE-")
    print(f"[OK] OHE submitted demand: {ohe_req_number}")

    # 5. S&T User submits Signaling Maintenance Request
    st_payload = {
        "department_id": 3,
        "section_id": 1,
        "work_type": "Point Machine Replacement & Axle Counter Check",
        "location_details": "Lonavala Yard Crossover 104A/B",
        "asset_id": "PM-LNL-104",
        "priority": "MEDIUM",
        "duration_minutes": 120,
        "preferred_date": "2026-09-22",
        "preferred_start": "02:00",
        "preferred_end": "04:00",
        "required_resources": "Signal Testing Kit, 4 Technicians",
        "reason": "Preventive maintenance on point detection contacts."
    }
    res_st = client.post("/api/maintenance/requests", headers={"Authorization": f"Bearer {st_token}"}, json=st_payload)
    assert res_st.status_code == 200
    st_req_data = res_st.json()
    print(f"[OK] S&T submitted demand: {st_req_data['request_number']}")

    # 6. Role-Based Request Visibility
    # Engineering user lists requests -> gets ONLY Engineering requests
    eng_list = client.get("/api/maintenance/requests", headers={"Authorization": f"Bearer {eng_token}"}).json()
    for r in eng_list:
        assert r["department_id"] == 1, f"Engineering saw foreign dept request: {r['department_id']}"
    print(f"[OK] Engineering view restricted to Engineering requests only ({len(eng_list)} items).")

    # Controller lists requests -> sees all departments
    ctrl_list = client.get("/api/maintenance/requests", headers={"Authorization": f"Bearer {ctrl_token}"}).json()
    all_depts = {r["department_id"] for r in ctrl_list}
    assert 1 in all_depts and 2 in all_depts and 3 in all_depts
    print(f"[OK] Central Controller view includes all departments ({len(ctrl_list)} items across depts: {all_depts}).")

    # 7. Central Controller Notifications Check
    ctrl_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {ctrl_token}"}).json()
    assert len(ctrl_notifs) > 0
    print(f"[OK] Central Controller received {len(ctrl_notifs)} operational notifications!")
    print(f"  - Latest alert: '{ctrl_notifs[0]['title']}' - {ctrl_notifs[0]['message']}")

    # 8. Work Progress Tracking: Engineering updates progress
    prog_res = client.patch(
        f"/api/maintenance/requests/{eng_req_id}/progress",
        headers={"Authorization": f"Bearer {eng_token}"},
        json={"progress_pct": 45, "progress_notes": "Ballast excavated and screening underway."}
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["progress_pct"] == 45
    print("[OK] Work progress updated by Engineering to 45%!")

    # Engineering attempts to update progress on OHE request -> 403 Forbidden!
    unauth_prog = client.patch(
        f"/api/maintenance/requests/{ohe_req_id}/progress",
        headers={"Authorization": f"Bearer {eng_token}"},
        json={"progress_pct": 99, "progress_notes": "Hacked OHE"}
    )
    assert unauth_prog.status_code == 403
    print(f"[OK] Unauthorized progress update rejected with 403: {unauth_prog.json()['detail']}")

    # 9. Central Controller approves Section 1 block -> Verifies Department notification & request status
    appr_res = client.post(
        "/api/blocks/approve-workflow",
        headers={"Authorization": f"Bearer {ctrl_token}"},
        json={
            "block_code": "Block A-17",
            "section_id": 1,
            "action": "APPROVED",
            "performed_by": "Chief Operations Controller, Pune Division",
            "user_role": "Chief Controller",
            "remarks": "Multi-department joint possession approved for Track + OHE + S&T."
        }
    )
    assert appr_res.status_code == 200
    print(f"[OK] Controller approved corridor block with digital signature: {appr_res.json()['digital_signature']}")

    # Check Engineering notifications -> Must have approval notification!
    eng_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {eng_token}"}).json()
    approved_notif = next((n for n in eng_notifs if "Approved" in n["title"]), None)
    assert approved_notif is not None, "Engineering did not receive approval notification"
    print(f"[OK] Engineering received approval notification: '{approved_notif['title']}' - {approved_notif['message']}")

    # Check request status -> must be APPROVED
    req_check = client.get(f"/api/maintenance/requests/{eng_req_id}", headers={"Authorization": f"Bearer {eng_token}"}).json()
    assert req_check["request"]["status"] == "APPROVED"
    print(f"[OK] Request {eng_req_number} status transitioned to APPROVED in database!")

    # 10. Audit Trail Check
    audit_res = client.get("/api/blocks/audit-trail")
    assert audit_res.status_code == 200
    audit_logs = audit_res.json()
    actions_logged = {a["action"] for a in audit_logs}
    print(f"[OK] Audit trail contains {len(audit_logs)} logs with actions: {actions_logged}")
    assert "REQUEST_SUBMITTED" in actions_logged
    assert "APPROVED" in actions_logged

    print("\n>>> ALL PHASE 3 TESTS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    test_phase3()
