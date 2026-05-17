"""
Demo data population script — run once after seed.py
Creates rich, realistic data for all three roles so judges can see complete user journeys.

Run from backend/ directory (with venv activated and DATABASE_URL set):
    python scripts/demo_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.goal import (
    GoalSheet, Goal, ThrustArea, Cycle, CyclePhase,
    SheetStatus, UoMType, GoalStatus, QuarterlyActual, CheckinComment
)
from sqlalchemy import text
from datetime import date, datetime, timezone


def run():
    db = SessionLocal()
    try:
        # ── Fetch reference data ──────────────────────────────────────────────
        cycle_gs   = db.query(Cycle).filter_by(year=2026, phase=CyclePhase.GOAL_SETTING).first()
        cycle_q1   = db.query(Cycle).filter_by(year=2026, phase=CyclePhase.Q1).first()
        cycle_q2   = db.query(Cycle).filter_by(year=2026, phase=CyclePhase.Q2).first()

        if not cycle_gs:
            print("❌ 2026 GOAL_SETTING cycle not found — run seed.py first.")
            return

        ta = {t.name: t for t in db.query(ThrustArea).all()}

        admin   = db.query(User).filter_by(email="admin@demo.com").first()
        manager = db.query(User).filter_by(email="manager@demo.com").first()
        employee= db.query(User).filter_by(email="employee@demo.com").first()

        if not all([admin, manager, employee]):
            print("❌ Demo users not found — run seed.py first.")
            return

        # ── Create / upsert Priyam Singh ──────────────────────────────────────
        priyam = db.query(User).filter_by(email="priyamsingh723@gmail.com").first()
        if not priyam:
            priyam = User(
                name="Priyam Singh",
                email="priyamsingh723@gmail.com",
                hashed_password=hash_password("Priyam@123"),
                role="employee",
                department="Sales",
                manager_id=manager.id,
                is_active=True,
            )
            db.add(priyam)
            db.flush()
            print("  ✓ Priyam Singh created")
        else:
            priyam.manager_id = manager.id
            db.flush()
            print("  – Priyam Singh already exists (manager linked)")

        # ── Helper: delete existing sheet for a user+cycle ────────────────────
        def clear_sheet(user_id, cycle_id):
            old = db.query(GoalSheet).filter_by(employee_id=user_id, cycle_id=cycle_id).first()
            if old:
                # Delete checkin_comments first (no cascade on the relationship)
                db.query(CheckinComment).filter_by(goal_sheet_id=old.id).delete()
                db.delete(old)
                db.flush()

        now = datetime.now(timezone.utc)

        # ══════════════════════════════════════════════════════════════════════
        # JOURNEY 1 — Employee (employee@demo.com)
        # Sheet: APPROVED, goals locked, Q1 actuals logged, Q2 actuals partial
        # ══════════════════════════════════════════════════════════════════════
        clear_sheet(employee.id, cycle_gs.id)

        emp_sheet = GoalSheet(
            employee_id=employee.id,
            cycle_id=cycle_gs.id,
            status=SheetStatus.APPROVED,
            submitted_at=datetime(2026, 4, 5, 10, 0, tzinfo=timezone.utc),
            approved_at=datetime(2026, 4, 8, 14, 30, tzinfo=timezone.utc),
            approved_by=manager.id,
        )
        db.add(emp_sheet)
        db.flush()

        emp_goals = [
            Goal(goal_sheet_id=emp_sheet.id, thrust_area_id=ta["Revenue Growth"].id,
                 title="Achieve Monthly Sales Target of ₹50L",
                 description="Drive revenue growth through new client acquisition and upselling.",
                 uom_type=UoMType.MIN, target_numeric=50.0, weightage=25.0, is_locked=True),
            Goal(goal_sheet_id=emp_sheet.id, thrust_area_id=ta["Customer Satisfaction"].id,
                 title="Improve Customer NPS to 80+",
                 description="Increase net promoter score through proactive service and follow-ups.",
                 uom_type=UoMType.MIN, target_numeric=80.0, weightage=20.0, is_locked=True),
            Goal(goal_sheet_id=emp_sheet.id, thrust_area_id=ta["Operational Excellence"].id,
                 title="Reduce Average Complaint TAT to under 24 hrs",
                 description="Faster resolution of customer complaints.",
                 uom_type=UoMType.MAX, target_numeric=24.0, weightage=20.0, is_locked=True),
            Goal(goal_sheet_id=emp_sheet.id, thrust_area_id=ta["People Development"].id,
                 title="Complete Product Certification by Sep 2026",
                 description="Obtain certified product specialist badge.",
                 uom_type=UoMType.TIMELINE, target_date=date(2026, 9, 30), weightage=20.0, is_locked=True),
            Goal(goal_sheet_id=emp_sheet.id, thrust_area_id=ta["Safety & Compliance"].id,
                 title="Zero Safety Incidents in FY2026",
                 description="Maintain zero reportable safety incidents throughout the year.",
                 uom_type=UoMType.ZERO, target_numeric=0.0, weightage=15.0, is_locked=True),
        ]
        for g in emp_goals:
            db.add(g)
        db.flush()

        # Q1 actuals for employee
        q1_actuals = [
            QuarterlyActual(goal_id=emp_goals[0].id, cycle_id=cycle_q1.id,
                            actual_numeric=42.0, status=GoalStatus.ON_TRACK, progress_score=84.0),
            QuarterlyActual(goal_id=emp_goals[1].id, cycle_id=cycle_q1.id,
                            actual_numeric=74.0, status=GoalStatus.AT_RISK, progress_score=92.5),
            QuarterlyActual(goal_id=emp_goals[2].id, cycle_id=cycle_q1.id,
                            actual_numeric=28.0, status=GoalStatus.BEHIND, progress_score=85.7),
            QuarterlyActual(goal_id=emp_goals[3].id, cycle_id=cycle_q1.id,
                            actual_date=None, status=GoalStatus.ON_TRACK, progress_score=70.0),
            QuarterlyActual(goal_id=emp_goals[4].id, cycle_id=cycle_q1.id,
                            actual_numeric=0.0, status=GoalStatus.ON_TRACK, progress_score=100.0),
        ]
        for a in q1_actuals:
            db.add(a)

        # Q1 manager check-in comment
        if cycle_q1:
            db.add(CheckinComment(
                goal_sheet_id=emp_sheet.id,
                cycle_id=cycle_q1.id,
                manager_id=manager.id,
                comment="Good progress overall. Sales target slightly behind — focus on pipeline acceleration in Q2. NPS improvement plan needs more structured customer feedback loops. Safety record is excellent — keep it up!",
            ))

        print("  ✓ Employee journey: APPROVED sheet + Q1 actuals + manager check-in comment")

        # ══════════════════════════════════════════════════════════════════════
        # JOURNEY 2 — Priyam Singh (pending approval — manager can approve live)
        # ══════════════════════════════════════════════════════════════════════
        clear_sheet(priyam.id, cycle_gs.id)

        priyam_sheet = GoalSheet(
            employee_id=priyam.id,
            cycle_id=cycle_gs.id,
            status=SheetStatus.SUBMITTED,
            submitted_at=datetime(2026, 4, 12, 9, 0, tzinfo=timezone.utc),
        )
        db.add(priyam_sheet)
        db.flush()

        priyam_goals = [
            Goal(goal_sheet_id=priyam_sheet.id, thrust_area_id=ta["Revenue Growth"].id,
                 title="Close ₹30L in New Business Revenue",
                 description="Acquire at least 5 new enterprise clients this FY.",
                 uom_type=UoMType.MIN, target_numeric=30.0, weightage=30.0, is_locked=False),
            Goal(goal_sheet_id=priyam_sheet.id, thrust_area_id=ta["Customer Satisfaction"].id,
                 title="Maintain Customer Satisfaction Score above 85",
                 description="Track CSAT monthly and ensure >= 85 across all interactions.",
                 uom_type=UoMType.MIN, target_numeric=85.0, weightage=25.0, is_locked=False),
            Goal(goal_sheet_id=priyam_sheet.id, thrust_area_id=ta["Operational Excellence"].id,
                 title="Reduce Operational Cost by 10%",
                 description="Identify and eliminate inefficiencies in daily workflows.",
                 uom_type=UoMType.MAX, target_numeric=10.0, weightage=25.0, is_locked=False),
            Goal(goal_sheet_id=priyam_sheet.id, thrust_area_id=ta["People Development"].id,
                 title="Complete Compliance Certification by Aug 2026",
                 description="Pass the mandatory compliance and data privacy certification.",
                 uom_type=UoMType.TIMELINE, target_date=date(2026, 8, 31), weightage=20.0, is_locked=False),
        ]
        for g in priyam_goals:
            db.add(g)

        print("  ✓ Priyam Singh: SUBMITTED sheet (pending manager approval — live demo trigger)")

        # ══════════════════════════════════════════════════════════════════════
        # JOURNEY 3 — Manager (manager@demo.com) also has their own goals
        # Sheet: SUBMITTED (pending admin review)
        # ══════════════════════════════════════════════════════════════════════
        clear_sheet(manager.id, cycle_gs.id)

        mgr_sheet = GoalSheet(
            employee_id=manager.id,
            cycle_id=cycle_gs.id,
            status=SheetStatus.SUBMITTED,
            submitted_at=datetime(2026, 4, 10, 11, 0, tzinfo=timezone.utc),
        )
        db.add(mgr_sheet)
        db.flush()

        mgr_goals = [
            Goal(goal_sheet_id=mgr_sheet.id, thrust_area_id=ta["People Development"].id,
                 title="Achieve 90% Team Goal Completion Rate",
                 description="Ensure all direct reports meet or exceed 90% of their KPI targets.",
                 uom_type=UoMType.MIN, target_numeric=90.0, weightage=40.0, is_locked=False),
            Goal(goal_sheet_id=mgr_sheet.id, thrust_area_id=ta["Revenue Growth"].id,
                 title="Drive Team Revenue of ₹2Cr",
                 description="Lead the sales team to collectively achieve ₹2Cr in FY2026.",
                 uom_type=UoMType.MIN, target_numeric=200.0, weightage=35.0, is_locked=False),
            Goal(goal_sheet_id=mgr_sheet.id, thrust_area_id=ta["Operational Excellence"].id,
                 title="Complete 12 Development Sessions for Team",
                 description="Conduct monthly 1:1s and quarterly team training workshops.",
                 uom_type=UoMType.MIN, target_numeric=12.0, weightage=25.0, is_locked=False),
        ]
        for g in mgr_goals:
            db.add(g)

        print("  ✓ Manager journey: SUBMITTED sheet (judges can see manager also sets goals)")

        # ══════════════════════════════════════════════════════════════════════
        # JOURNEY 4 — Pranay Singh (singhpranay2004@gmail.com)
        # Sheet: SUBMITTED — second live approval + email demo
        # ══════════════════════════════════════════════════════════════════════
        pranay = db.query(User).filter_by(email="singhpranay2004@gmail.com").first()
        if not pranay:
            pranay = User(
                name="Pranay Singh",
                email="singhpranay2004@gmail.com",
                hashed_password=hash_password("Pranay@123"),
                role="employee",
                department="Operations",
                manager_id=manager.id,
                is_active=True,
            )
            db.add(pranay)
            db.flush()
            print("  ✓ Pranay Singh created")
        else:
            pranay.manager_id = manager.id
            db.flush()
            print("  – Pranay Singh already exists (manager linked)")

        clear_sheet(pranay.id, cycle_gs.id)

        pranay_sheet = GoalSheet(
            employee_id=pranay.id,
            cycle_id=cycle_gs.id,
            status=SheetStatus.SUBMITTED,
            submitted_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
        )
        db.add(pranay_sheet)
        db.flush()

        pranay_goals = [
            Goal(goal_sheet_id=pranay_sheet.id, thrust_area_id=ta["Operational Excellence"].id,
                 title="Reduce Process TAT by 20%",
                 description="Streamline operational workflows to reduce turnaround time.",
                 uom_type=UoMType.MAX, target_numeric=20.0, weightage=35.0, is_locked=False),
            Goal(goal_sheet_id=pranay_sheet.id, thrust_area_id=ta["Revenue Growth"].id,
                 title="Increase Upsell Revenue to ₹15L",
                 description="Drive revenue through cross-sell and upsell opportunities.",
                 uom_type=UoMType.MIN, target_numeric=15.0, weightage=35.0, is_locked=False),
            Goal(goal_sheet_id=pranay_sheet.id, thrust_area_id=ta["Safety & Compliance"].id,
                 title="Zero Compliance Violations in FY2026",
                 description="Maintain zero regulatory and compliance violations.",
                 uom_type=UoMType.ZERO, target_numeric=0.0, weightage=30.0, is_locked=False),
        ]
        for g in pranay_goals:
            db.add(g)

        print("  ✓ Pranay Singh: SUBMITTED sheet (approve as manager → email to singhpranay2004@gmail.com)")

        # ══════════════════════════════════════════════════════════════════════
        # JOURNEY 5 — Himesh Pandey (pandeyhimesh09@gmail.com)
        # Sheet: SUBMITTED — judge can approve as manager to verify email delivery
        # ══════════════════════════════════════════════════════════════════════
        himesh = db.query(User).filter_by(email="pandeyhimesh09@gmail.com").first()
        if not himesh:
            himesh = User(
                name="Himesh Pandey",
                email="pandeyhimesh09@gmail.com",
                hashed_password=hash_password("Himesh@123"),
                role="employee",
                department="Engineering",
                manager_id=manager.id,
                is_active=True,
            )
            db.add(himesh)
            db.flush()
            print("  ✓ Himesh Pandey created")
        else:
            himesh.manager_id = manager.id
            db.flush()
            print("  – Himesh Pandey already exists (manager linked)")

        clear_sheet(himesh.id, cycle_gs.id)

        himesh_sheet = GoalSheet(
            employee_id=himesh.id,
            cycle_id=cycle_gs.id,
            status=SheetStatus.SUBMITTED,
            submitted_at=datetime(2026, 4, 16, 9, 0, tzinfo=timezone.utc),
        )
        db.add(himesh_sheet)
        db.flush()

        himesh_goals = [
            Goal(goal_sheet_id=himesh_sheet.id, thrust_area_id=ta["Revenue Growth"].id,
                 title="Launch 2 New Product Features by Q3",
                 description="Deliver two customer-facing features to drive revenue growth.",
                 uom_type=UoMType.MIN, target_numeric=2.0, weightage=40.0, is_locked=False),
            Goal(goal_sheet_id=himesh_sheet.id, thrust_area_id=ta["Operational Excellence"].id,
                 title="Reduce System Downtime to under 0.1%",
                 description="Improve system reliability through proactive monitoring.",
                 uom_type=UoMType.MAX, target_numeric=0.1, weightage=35.0, is_locked=False),
            Goal(goal_sheet_id=himesh_sheet.id, thrust_area_id=ta["People Development"].id,
                 title="Complete AWS Certification by Aug 2026",
                 description="Obtain AWS Solutions Architect certification.",
                 uom_type=UoMType.TIMELINE, target_date=date(2026, 8, 31), weightage=25.0, is_locked=False),
        ]
        for g in himesh_goals:
            db.add(g)

        print("  ✓ Himesh Pandey: SUBMITTED sheet (approve as manager → email to pandeyhimesh09@gmail.com)")

        db.commit()
        print("\n✅ Demo data populated successfully!")
        print("\nComplete user journeys ready:")
        print("  Employee  → employee@demo.com / Employee@123")
        print("             APPROVED sheet, Q1 actuals logged, check-in comment from manager")
        print("  Manager   → manager@demo.com  / Manager@123")
        print("             Priyam Singh's sheet pending approval (approve it to trigger email)")
        print("             Manager's own SUBMITTED goals visible")
        print("  Admin     → admin@demo.com    / Admin@123")
        print("             Full org dashboard, 3 employees, reports downloadable")
        print("  Priyam    → priyamsingh723@gmail.com / Priyam@123")
        print("             SUBMITTED sheet awaiting manager approval")
        print("  Pranay    → singhpranay2004@gmail.com / Pranay@123")
        print("             SUBMITTED sheet awaiting manager approval")
        print("  Himesh    → pandeyhimesh09@gmail.com / Himesh@123")
        print("             SUBMITTED sheet — approve as manager to verify email delivery")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Failed: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
