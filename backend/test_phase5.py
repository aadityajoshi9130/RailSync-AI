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

def test_phase5_department_dashboards():
    print("\n" + "="*70)
    print("  PHASE 5: DEDICATED DEPARTMENTAL DASHBOARDS VERIFICATION")
    print("="*70)

    # 1. Login to all 3 department accounts + controller
    print("\n[Step 1] Authenticating Department Roles...")
    creds = {
        "eng_track": "railpass123",
        "ohe_traction": "railpass123",
        "st_telecom": "railpass123",
        "controller": "railpass123",
    }
    tokens = {}
    for u, p in creds.items():
        res = client.post("/api/auth/login", json={"username": u, "password": p})
        assert res.status_code == 200, f"Login failed for {u}"
        tokens[u] = res.json()["access_token"]
        print(f"  ✓ {u} authenticated successfully.")

    # 2. Engineering Dashboard Requirements
    print("\n[Step 2] Verifying Engineering (P-Way) Dashboard Workflows...")
    # 2a. Requisition track tamping demand
    eng_payload = {
        "department_id": 1,
        "section_id": 1,
        "work_type": "Track Tamping (CSM 08-32)",
        "location_details": "UP Main Line (KM 124/2 to 127/8)",
        "asset_id": "TRACK-SEC-1",
        "priority": "HIGH",
        "duration_minutes": 180,
        "preferred_start": "01:30",
        "preferred_end": "04:30",
        "required_resources": "CSM Tamper #104 + Ballast Regulator | Gang: 40 Trackmen",
        "reason": "OMS-2000 recorded high vertical acceleration (0.28g) over joints.",
    }
    eng_res = client.post(
        "/api/maintenance/requests",
        json=eng_payload,
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_res.status_code == 200, f"Eng submission failed: {eng_res.text}"
    eng_req = eng_res.json()
    print(f"  ✓ Engineering Requisition Created: {eng_req['request_number']}")
    print(f"    - Resources: {eng_req['required_resources']}")
    print(f"    - Status: {eng_req['status']}")

    # 2b. Engineering list filtering: Engineering can only see Dept 1
    eng_list_res = client.get(
        "/api/maintenance/requests",
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert eng_list_res.status_code == 200
    for r in eng_list_res.json():
        assert r["department_id"] == 1, f"Engineering saw foreign dept item #{r['department_id']}"
    print(f"  ✓ Engineering view strictly isolated: all {len(eng_list_res.json())} visible items belong to Dept #1 (Civil Engineering).")

    # 3. OHE (Traction Distribution) Dashboard Requirements
    print("\n[Step 3] Verifying OHE (Traction Distribution) Dashboard Workflows...")
    # 3a. Requisition OHE power block with 25kV isolation
    ohe_payload = {
        "department_id": 2,
        "section_id": 1,
        "work_type": "Contact & Catenary Wire Replacement",
        "location_details": "UP Line 25kV Catenary (Mast 118/14 to 122/08) · Power: YES (25kV Power De-energization Required)",
        "asset_id": "OHE-MAST-118-14",
        "priority": "HIGH",
        "duration_minutes": 150,
        "preferred_start": "02:00",
        "preferred_end": "04:30",
        "required_resources": "8-Wheeler Tower Wagon #TW-42 | Linemen: 18 Linemen",
        "reason": "Contact wire diameter measured below 8.2mm critical threshold.",
    }
    ohe_res = client.post(
        "/api/maintenance/requests",
        json=ohe_payload,
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert ohe_res.status_code == 200
    ohe_req = ohe_res.json()
    print(f"  ✓ OHE Requisition Created: {ohe_req['request_number']}")
    print(f"    - Power Isolation Details: {ohe_req['location_details']}")

    # 3b. OHE list filtering: OHE can only see Dept 2
    ohe_list_res = client.get(
        "/api/maintenance/requests",
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert ohe_list_res.status_code == 200
    for r in ohe_list_res.json():
        assert r["department_id"] == 2, f"OHE saw foreign dept item #{r['department_id']}"
    print(f"  ✓ OHE view strictly isolated: all {len(ohe_list_res.json())} visible items belong to Dept #2 (OHE / Traction).")

    # 3c. Joint block synergy verification on OHE
    joint_res = client.get(
        "/api/blocks/joint-opportunities",
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert joint_res.status_code == 200
    opps = joint_res.json()
    assert len(opps) > 0
    print(f"  ✓ OHE Joint Synergy Matcher active: {len(opps)} joint opportunity sections detected for zero-detention piggybacking.")

    # 4. S&T (Signaling & Telecom) Dashboard Requirements
    print("\n[Step 4] Verifying S&T (Signaling & Telecom) Dashboard Workflows...")
    # 4a. Statutory Form S&T-T/351 Disconnection notice demand
    st_payload = {
        "department_id": 3,
        "section_id": 1,
        "work_type": "Point Machine Overhaul & 3.25mm Obstruction Test",
        "location_details": "Lonavala Station Central Interlocking Cabin · Asset: Point #104 A/B · Notice: FORM S&T-T/351 Issued to Station Master",
        "asset_id": "SIG-Point-#104-A/B",
        "priority": "HIGH",
        "duration_minutes": 120,
        "preferred_start": "02:30",
        "preferred_end": "04:30",
        "required_resources": "Engineers: 1 Section Engineer (Sig) + 2 ESMs + 4 Helpers | Calibration Kit",
        "reason": "Motor throwing time on Point 104A exceeded 5.8 seconds (threshold 4.5s).",
    }
    st_res = client.post(
        "/api/maintenance/requests",
        json=st_payload,
        headers={"Authorization": f"Bearer {tokens['st_telecom']}"}
    )
    assert st_res.status_code == 200
    st_req = st_res.json()
    print(f"  ✓ S&T Disconnection Requisition Created: {st_req['request_number']}")
    print(f"    - Interlocking Details: {st_req['location_details']}")

    # 4b. S&T list filtering: S&T can only see Dept 3
    st_list_res = client.get(
        "/api/maintenance/requests",
        headers={"Authorization": f"Bearer {tokens['st_telecom']}"}
    )
    assert st_list_res.status_code == 200
    for r in st_list_res.json():
        assert r["department_id"] == 3, f"S&T saw foreign dept item #{r['department_id']}"
    print(f"  ✓ S&T view strictly isolated: all {len(st_list_res.json())} visible items belong to Dept #3 (S&T).")

    # 5. Field Progress Reporting & Boundary Enforcement
    print("\n[Step 5] Verifying Field Progress Reporting and Cross-Department Protection...")
    # 5a. Engineering updates own progress
    prog_ok = client.patch(
        f"/api/maintenance/requests/{eng_req['id']}/progress",
        json={"progress_pct": 50, "progress_notes": "1.2km tamping completed, ballast packing under way."},
        headers={"Authorization": f"Bearer {tokens['eng_track']}"}
    )
    assert prog_ok.status_code == 200
    assert prog_ok.json()["progress_pct"] == 50
    print(f"  ✓ Engineering updated progress on {eng_req['request_number']} to 50%.")

    # 5b. OHE attempts to tamper with Engineering request progress -> Must return 403 Forbidden!
    prog_tamper = client.patch(
        f"/api/maintenance/requests/{eng_req['id']}/progress",
        json={"progress_pct": 100, "progress_notes": "Unauthorized modification attempt"},
        headers={"Authorization": f"Bearer {tokens['ohe_traction']}"}
    )
    assert prog_tamper.status_code == 403, f"Expected 403, got {prog_tamper.status_code}"
    print(f"  ✓ Cross-department progress modification blocked with 403 Forbidden: {prog_tamper.json()['detail']}")

    print("\n" + "="*70)
    print("  ALL PHASE 5 DEPARTMENTAL DASHBOARD SPECIFICATIONS VERIFIED 100%!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_phase5_department_dashboards()
