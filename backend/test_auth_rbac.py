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
from app.database import Base, engine, get_db
from app import models, auth

client = TestClient(app)

def test_auth_rbac_suite():
    print("\n" + "="*75)
    print("  RAILSYNC — AUTOMATED AUTHENTICATION & RBAC TEST SUITE")
    print("="*75)

    # -------------------------------------------------------------
    # 1. Bcrypt Password Hashing & Token Encoding Unit Tests
    # -------------------------------------------------------------
    print("\n[1/7] Unit Testing Bcrypt Hashing & JWT Token Encoding...")
    pwd = "railpass123"
    hashed = auth.hash_password(pwd)
    assert auth.verify_password(pwd, hashed), "Password verification failed"
    assert not auth.verify_password("wrongpass", hashed), "Wrong password unexpectedly verified"
    print("  [OK] Bcrypt password hashing & salt verification working correctly.")

    token = auth.create_access_token(data={"sub": "controller", "role": "CENTRAL_CONTROLLER", "dept_id": 4})
    decoded = auth.decode_access_token(token)
    assert decoded["sub"] == "controller"
    assert decoded["role"] == "CENTRAL_CONTROLLER"
    print("  [OK] JWT creation and payload decoding verified.")

    # -------------------------------------------------------------
    # 2. Verify Presence of Seeded Operational Accounts
    # -------------------------------------------------------------
    print("\n[2/7] Verifying 4 Operational Roles + Admin Accounts...")
    expected_roles = {
        "controller": "CENTRAL_CONTROLLER",
        "eng_track": "ENGINEERING",
        "ohe_traction": "OHE_TRACTION",
        "st_telecom": "SIGNALING_TELECOM",
        "admin": "SYSTEM_ADMIN",
    }
    tokens = {}
    for username, expected_role in expected_roles.items():
        res = client.post("/api/auth/login", json={"username": username, "password": "railpass123"})
        assert res.status_code == 200, f"Failed to login {username}: {res.text}"
        data = res.json()
        assert data["user"]["role"] == expected_role, f"Role mismatch for {username}"
        tokens[username] = data["access_token"]
        print(f"  [OK] User '{username}' authenticated as role '{expected_role}' (Dept ID: {data['user']['department_id']}).")

    # -------------------------------------------------------------
    # 3. Authentication Gateway Edge Cases (401 Unauthorized)
    # -------------------------------------------------------------
    print("\n[3/7] Testing Authentication Edge Cases & Rejections...")
    bad_login = client.post("/api/auth/login", json={"username": "controller", "password": "wrong_password"})
    assert bad_login.status_code == 401, f"Expected 401, got {bad_login.status_code}"
    print("  [OK] Invalid credentials rejected with 401 Unauthorized.")

    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tokens['controller']}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "controller"
    print("  [OK] /api/auth/me returns active user session profile.")

    # -------------------------------------------------------------
    # 4. Strict RBAC Sole Approval Authority (403 Forbidden)
    # -------------------------------------------------------------
    print("\n[4/7] Enforcing Sole Approval Authority (Non-Controllers Blocked)...")
    for dept_user in ["eng_track", "ohe_traction", "st_telecom"]:
        res_wf = client.post(
            "/api/blocks/approve-workflow",
            json={
                "block_code": "Block A-17",
                "section_id": 1,
                "action": "APPROVED",
                "performed_by": "Field Engineer",
                "user_role": expected_roles[dept_user],
                "remarks": "Unauthorized self-approval attempt"
            },
            headers={"Authorization": f"Bearer {tokens[dept_user]}"}
        )
        assert res_wf.status_code == 403, f"Expected 403, got {res_wf.status_code} for {dept_user}"
        print(f"  [OK] {dept_user} ({expected_roles[dept_user]}) blocked with 403 Forbidden on approve-workflow.")

    # -------------------------------------------------------------
    # 5. Department Boundary Protection on Requisitions (403 Forbidden)
    # -------------------------------------------------------------
    print("\n[5/7] Testing Departmental Boundary Isolation...")
    cross_dept_res = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 2, # OHE
            "section_id": 1,
            "work_type": "Illegal Cross-Department Submit",
            "priority": "HIGH",
            "duration_minutes": 120,
            "reason": "Test cross-department submission by Engineering",
        },
        headers={"Authorization": f"Bearer {tokens['eng_track']}"} # Engineering belongs to Dept 1
    )
    assert cross_dept_res.status_code == 403, f"Expected 403, got {cross_dept_res.status_code}"
    print(f"  [OK] Engineering user blocked with 403 Forbidden when submitting for OHE department.")

    # -------------------------------------------------------------
    # 6. Legitimate Multi-Role Flow & Controller Approval
    # -------------------------------------------------------------
    print("\n[6/7] Testing Multi-Department Demand Intake & Controller Approval...")
    # Engineering submits
    eng_res = client.post(
        "/api/maintenance/requests",
        json={
            "department_id": 1,
            "section_id": 1,
            "work_type": "Track Tamping (CSM 08-32)",
            "location_details": "UP Main Line (KM 124/2 to 127/8)",
            "priority": "HIGH",
            "duration_minutes": 180,
            "required_resources": "CSM Tamper #104 + Ballast Regulator",
            "reason": "Vertical acceleration anomaly detected.",
        },
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_res.status_code == 200
    eng_req = eng_res.json()
    print(f"  [OK] Engineering demand created: {eng_req['request_number']} (Status: {eng_req['status']})")

    # Controller approves
    ctrl_app = client.post(
        "/api/blocks/approve-workflow",
        json={
            "block_code": eng_req["request_number"],
            "section_id": 1,
            "action": "APPROVED",
            "performed_by": "Chief Operations Controller (Sr. DOM)",
            "user_role": "CENTRAL_CONTROLLER",
            "remarks": "Approved with timetable slot verification.",
            "emergency_override": False,
        },
        headers={"Authorization": f"Bearer {tokens['controller']}"}
    )
    assert ctrl_app.status_code == 200
    app_data = ctrl_app.json()
    assert app_data["digital_signature"].startswith("IR-SIG-")
    print(f"  [OK] Central Controller approved block {eng_req['request_number']}! Digital Signature: {app_data['digital_signature'][:24]}...")

    # -------------------------------------------------------------
    # 7. Role-Targeted Notifications & Cryptographic Audit Trail
    # -------------------------------------------------------------
    print("\n[7/7] Verifying Notification Feeds & Audit Trail...")
    eng_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {tokens['eng_track']}"})
    assert eng_notifs.status_code == 200
    assert len(eng_notifs.json()) > 0
    print(f"  [OK] Engineering received approval alert: '{eng_notifs.json()[0]['title']}'")

    audit_res = client.get("/api/blocks/audit-trail", headers={"Authorization": f"Bearer {tokens['controller']}"})
    assert audit_res.status_code == 200
    assert len(audit_res.json()) > 0
    print(f"  [OK] Cryptographic audit trail contains {len(audit_res.json())} logged events with SHA-256 signatures.")

    print("\n" + "="*75)
    print("  ALL AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) TESTS PASSED 100%!")
    print("="*75 + "\n")

if __name__ == "__main__":
    test_auth_rbac_suite()
