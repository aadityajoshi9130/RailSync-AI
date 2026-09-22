from app.database import SessionLocal
from app.services import optimizer
from fastapi.testclient import TestClient
from app.main import app

def test_phase2():
    print("=== Phase 2: Scheduling Engine & Joint Block Verification ===")
    
    db = SessionLocal()
    try:
        # 1. Test Multi-Candidate Slot Generation
        candidates = optimizer.generate_candidate_windows(section_id=1, db=db)
        print(f"[OK] Generated {len(candidates)} candidate windows for Section 1")
        assert len(candidates) == 3, f"Expected 3 candidate windows, got {len(candidates)}"
        
        c1 = candidates[0]
        c2 = candidates[1]
        c3 = candidates[2]

        print(f"  - Candidate 1: {c1['start_time']}–{c1['end_time']} (Impact: {c1['train_impact_minutes']}m, Score: {c1['score']}, Safety: {c1['safety_status']}) - Recommended: {c1['is_recommended']}")
        assert c1["is_recommended"] is True
        assert c1["safety_status"] == "PASS"
        assert c1["conflicts_count"] == 0

        print(f"  - Candidate 2: {c2['start_time']}–{c2['end_time']} (Impact: {c2['train_impact_minutes']}m, Score: {c2['score']}, Safety: {c2['safety_status']}) - Conflicts: {c2['conflicts_count']}")
        assert c2["is_recommended"] is False
        assert c2["safety_status"] == "PASS"

        print(f"  - Candidate 3: {c3['start_time']}–{c3['end_time']} (Impact: {c3['train_impact_minutes']}m, Score: {c3['score']}, Safety: {c3['safety_status']}) - Conflicts: {c3['conflicts_count']}")
        assert c3["is_recommended"] is False
        assert c3["safety_status"] == "FAIL"
        assert c3["conflicts_count"] >= 2
        print("[OK] All 3 candidate windows evaluated accurately against safety and traffic headway!")

        # 2. Test Joint Department Block Detection
        joint = optimizer.detect_joint_blocks(section_id=1, db=db)
        print(f"[OK] Joint Block Detection: {joint['departments_count']} departments ({', '.join(joint['departments'])})")
        print(f"  - Possession time saved: {joint['possession_time_saved_minutes']} minutes")
        print(f"  - Train detention avoided: {joint['train_detention_avoided_minutes']} minutes")
        print(f"  - Joint safety status: {joint['joint_safety_status']}")
        assert joint["is_joint_opportunity"] is True, "Expected section 1 to have joint opportunity with seed tasks"
        assert joint["departments_count"] >= 2
        assert joint["possession_time_saved_minutes"] > 0
        assert len(joint["safety_clearance_matrix"]) >= 3
        print("[OK] Joint block detection & synergy calculation verified!")

    finally:
        db.close()

    # 3. Test API Endpoints via TestClient
    client = TestClient(app)

    res_candidates = client.get("/api/blocks/candidates?section_id=1")
    assert res_candidates.status_code == 200
    data_cand = res_candidates.json()
    assert "candidates" in data_cand
    assert "joint_opportunity" in data_cand
    assert len(data_cand["candidates"]) == 3
    print("[OK] GET /api/blocks/candidates returned valid multi-candidate breakdown!")

    res_joint = client.get("/api/blocks/joint-opportunities")
    assert res_joint.status_code == 200
    assert isinstance(res_joint.json(), list)
    print(f"[OK] GET /api/blocks/joint-opportunities returned {len(res_joint.json())} joint corridors!")

    res_rec = client.get("/api/blocks/recommendation?section_id=1")
    assert res_rec.status_code == 200
    data_rec = res_rec.json()
    assert "candidates" in data_rec
    assert "joint_opportunity" in data_rec
    print("[OK] GET /api/blocks/recommendation successfully enriched with candidates & joint synergy!")

    print("\n>>> ALL PHASE 2 TESTS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    test_phase2()
