import sys
from app.database import SessionLocal
from app import models
from app.api.auth import seed_default_users
from app.auth import verify_password, create_access_token, decode_access_token, hash_password
from fastapi.testclient import TestClient
from app.main import app

def test_phase1():
    print("=== Phase 1: Security & RBAC Verification ===")
    
    # 1. Database and User Seeding
    db = SessionLocal()
    try:
        seed_default_users(db)
        users = db.query(models.User).all()
        print(f"[OK] Total users seeded: {len(users)}")
        assert len(users) >= 4, "Expected at least 4 default users"

        roles_found = set()
        for u in users:
            is_valid = verify_password("railpass123", u.password_hash)
            assert is_valid, f"Password verification failed for {u.username}"
            roles_found.add(u.role)
            print(f"  - User: {u.username:15} Role: {u.role:20} Dept: {u.department_id} (Password: OK)")

        assert "CENTRAL_CONTROLLER" in roles_found
        assert "ENGINEERING" in roles_found
        assert "OHE_TRACTION" in roles_found
        assert "SIGNALING_TELECOM" in roles_found
        print("[OK] All 4 required operational roles are present!")

        # 2. JWT Token Generation & Validation
        token = create_access_token({"sub": "controller", "role": "CENTRAL_CONTROLLER", "department_id": 4})
        decoded = decode_access_token(token)
        assert decoded["sub"] == "controller"
        assert decoded["role"] == "CENTRAL_CONTROLLER"
        print("[OK] JWT encode & decode verified successfully!")
    finally:
        db.close()

    # 3. TestClient Integration Tests
    client = TestClient(app)

    # Test Login with valid credentials
    login_res = client.post("/api/auth/login", json={"username": "controller", "password": "railpass123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token_controller = login_res.json()["access_token"]
    user_data = login_res.json()["user"]
    assert user_data["username"] == "controller"
    assert user_data["role"] == "CENTRAL_CONTROLLER"
    print("[OK] Controller login verified via API!")

    # Test Login with invalid password
    bad_login = client.post("/api/auth/login", json={"username": "controller", "password": "wrongpassword"})
    assert bad_login.status_code == 401
    print("[OK] Invalid login rejected with 401 Unauthorized!")

    # Test /api/auth/me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_controller}"})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "controller"
    print("[OK] /api/auth/me returns authenticated user profile!")

    # Test Engineering Login
    eng_login = client.post("/api/auth/login", json={"username": "eng_track", "password": "railpass123"})
    assert eng_login.status_code == 200
    token_eng = eng_login.json()["access_token"]
    assert eng_login.json()["user"]["role"] == "ENGINEERING"
    print("[OK] Engineering user login verified via API!")

    # 4. Strict RBAC Enforcement: Engineering user attempts to approve a block
    # Must be rejected with HTTP 403 Forbidden!
    unauth_approve = client.post(
        "/api/blocks/approve-workflow",
        headers={"Authorization": f"Bearer {token_eng}"},
        json={"block_code": "Block A-17", "section_id": 1, "action": "APPROVED", "remarks": "Unauthorized test"}
    )
    print(f"Engineering approve attempt status code: {unauth_approve.status_code}")
    assert unauth_approve.status_code == 403, f"Expected 403 Forbidden, got {unauth_approve.status_code}"
    print(f"[OK] STRICT RBAC ENFORCED: Engineering approval rejected with 403 Forbidden: {unauth_approve.json()['detail']}")

    # 5. Controller approves block -> Must succeed with 200 OK
    auth_approve = client.post(
        "/api/blocks/approve-workflow",
        headers={"Authorization": f"Bearer {token_controller}"},
        json={"block_code": "Block A-17", "section_id": 1, "action": "APPROVED", "remarks": "Controller verified approval"}
    )
    assert auth_approve.status_code == 200
    assert "digital_signature" in auth_approve.json()
    print(f"[OK] Controller approval succeeded with digital signature: {auth_approve.json()['digital_signature']}")

    print("\n>>> ALL PHASE 1 TESTS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    test_phase1()
