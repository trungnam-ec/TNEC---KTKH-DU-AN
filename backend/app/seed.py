"""
TNEC-KTKH Seed Data Script
============================
Tạo dữ liệu mẫu: 2 Users, 1 Project, 5 Tasks + Attachments + ActivityLogs.
Chạy: python -m app.seed
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, date
from decimal import Decimal

from app.database import engine, SessionLocal, reset_db
from app.models import (
    Base, User, Project, Task, Attachment, ActivityLog,
    RoleEnum, ProjectStatusEnum, TaskStatusEnum,
    TaskCategoryEnum, ActionTypeEnum, PriorityEnum, gen_uuid,
)


def seed():
    print("🗑️  Resetting database...")
    reset_db()

    db = SessionLocal()

    try:
        # ═══════════════════════════════════════════
        # 1. USERS (2 người)
        # ═══════════════════════════════════════════
        print("👤 Creating Users...")

        manager = User(
            id=gen_uuid(),
            email="manager@trungnamgroup.com.vn",
            full_name="Trần Quốc Minh",
            role=RoleEnum.Manager,
            is_active=True,
        )

        staff = User(
            id=gen_uuid(),
            email="nva@trungnamgroup.com.vn",
            full_name="Nguyễn Văn An",
            role=RoleEnum.Staff,
            is_active=True,
        )

        db.add_all([manager, staff])
        db.flush()
        print(f"   ✅ {manager}")
        print(f"   ✅ {staff}")

        # ═══════════════════════════════════════════
        # 2. PROJECT (1 dự án)
        # ═══════════════════════════════════════════
        print("📁 Creating Project...")

        project = Project(
            id=gen_uuid(),
            name="Nhà máy Điện gió Ea Nam",
            slug="dien-gio-ea-nam",
            client="Trungnam Group",
            location="Đắk Lắk",
            total_budget_vnd=Decimal("2500000000000"),  # 2,500 tỷ
            status=ProjectStatusEnum.DangThiCong,
        )

        db.add(project)
        db.flush()
        print(f"   ✅ {project}")

        # ═══════════════════════════════════════════
        # 3. TASKS (5 thẻ Kanban)
        # ═══════════════════════════════════════════
        print("📋 Creating Tasks...")

        task1 = Task(
            id=gen_uuid(),
            title="Lập Hồ sơ Đấu thầu Gói XL-05",
            description="Soạn HSMT theo mẫu chuẩn PMB. Yêu cầu: Tiêu chí kỹ thuật (30%), giá (40%), tiến độ (30%). File BoQ phải khớp với dự toán được duyệt.",
            project_id=project.id,
            assignee_id=staff.id,
            status=TaskStatusEnum.KeHoach,
            category=TaskCategoryEnum.DauThau,
            priority=PriorityEnum.High,
            value_vnd=Decimal("15500000000"),
            progress_percent=15,
            deadline=date(2026, 4, 20),
        )

        task2 = Task(
            id=gen_uuid(),
            title="Dự toán thi công Giai đoạn 2 — Khu TĐC",
            description="Bóc tách khối lượng theo bản vẽ TK Bước 2 (đã duyệt ngày 15/03). Lưu ý: đơn giá VLXD áp dụng theo Quyết định 08/QĐ-SXD cập nhật Quý 1/2026.",
            project_id=project.id,
            assignee_id=staff.id,
            status=TaskStatusEnum.DangXuLy,
            category=TaskCategoryEnum.DuToan,
            priority=PriorityEnum.Medium,
            value_vnd=Decimal("5200000000"),
            progress_percent=48,
            deadline=date(2026, 4, 30),
        )

        task3 = Task(
            id=gen_uuid(),
            title="Phê duyệt Hợp đồng Thầu phụ số 08",
            description="HĐ thầu phụ với Công ty Cầu đường Sông Hồng. Đã đàm phán giảm 3% giá trị so với báo giá ban đầu. Chờ Sếp ký duyệt trước 18/04.",
            project_id=project.id,
            assignee_id=manager.id,
            status=TaskStatusEnum.TrinhKyNoiBo,
            category=TaskCategoryEnum.HopDong,
            priority=PriorityEnum.Urgent,
            value_vnd=Decimal("8750000000"),
            progress_percent=85,
            deadline=date(2026, 4, 18),
        )

        task4 = Task(
            id=gen_uuid(),
            title="Hồ sơ Thanh toán Đợt 4 — Đường dây 110kV",
            description="Thanh toán theo đợt tiến độ 63%. Hồ sơ bao gồm BB nghiệm thu, nhật ký thi công, hóa đơn GTGT. CĐT yêu cầu gửi bản cứng trước 10/04.",
            project_id=project.id,
            assignee_id=staff.id,
            status=TaskStatusEnum.TrinhCDT,
            category=TaskCategoryEnum.ThanhQuyetToan,
            priority=PriorityEnum.High,
            value_vnd=Decimal("12300000000"),
            progress_percent=92,
            deadline=date(2026, 4, 10),
        )

        task5 = Task(
            id=gen_uuid(),
            title="Hồ sơ Nghiệm thu — CĐT trả về yêu cầu bổ sung",
            description="CĐT phản hồi: Thiếu Biên bản nghiệm thu nội bộ GĐ 2, thiếu chứng chỉ xuất xứ cáp điện. Cần bổ sung và gửi lại trước 05/03.",
            project_id=project.id,
            assignee_id=staff.id,
            status=TaskStatusEnum.VuongMac,
            category=TaskCategoryEnum.NghiemThu,
            priority=PriorityEnum.Urgent,
            value_vnd=Decimal("3400000000"),
            progress_percent=35,
            deadline=date(2026, 3, 5),
        )

        tasks = [task1, task2, task3, task4, task5]
        db.add_all(tasks)
        db.flush()
        for t in tasks:
            print(f"   ✅ {t}")

        # ═══════════════════════════════════════════
        # 4. ATTACHMENTS
        # ═══════════════════════════════════════════
        print("📎 Creating Attachments...")

        att1 = Attachment(
            id=gen_uuid(),
            task_id=task1.id,
            uploader_id=staff.id,
            file_name="HSMT_Goi_XL05_v1.pdf",
            file_url="/uploads/HSMT_Goi_XL05_v1.pdf",
            file_size="2.4 MB",
            file_type="pdf",
        )

        att2 = Attachment(
            id=gen_uuid(),
            task_id=task2.id,
            uploader_id=staff.id,
            file_name="Du_toan_GD2_Khu_TDC.xlsx",
            file_url="/uploads/Du_toan_GD2_Khu_TDC.xlsx",
            file_size="1.8 MB",
            file_type="excel",
        )

        att3 = Attachment(
            id=gen_uuid(),
            task_id=task2.id,
            uploader_id=staff.id,
            file_name="Ban_ve_thi_cong_GD2.pdf",
            file_url="/uploads/Ban_ve_thi_cong_GD2.pdf",
            file_size="5.2 MB",
            file_type="pdf",
        )

        att4 = Attachment(
            id=gen_uuid(),
            task_id=task5.id,
            uploader_id=staff.id,
            file_name="Bien_ban_NT_GD2_draft.docx",
            file_url="/uploads/Bien_ban_NT_GD2_draft.docx",
            file_size="320 KB",
            file_type="word",
        )

        attachments = [att1, att2, att3, att4]
        db.add_all(attachments)
        db.flush()
        for a in attachments:
            print(f"   ✅ {a}")

        # ═══════════════════════════════════════════
        # 5. ACTIVITY LOGS
        # ═══════════════════════════════════════════
        print("📝 Creating Activity Logs...")

        logs = [
            ActivityLog(
                id=gen_uuid(), task_id=task1.id, user_id=staff.id,
                action_type=ActionTypeEnum.Comment,
                content="Đã nhận yêu cầu, bắt đầu soạn HSMT",
            ),
            ActivityLog(
                id=gen_uuid(), task_id=task2.id, user_id=staff.id,
                action_type=ActionTypeEnum.StatusChange,
                content="Đã đổi trạng thái từ Kế hoạch sang Đang xử lý",
            ),
            ActivityLog(
                id=gen_uuid(), task_id=task2.id, user_id=staff.id,
                action_type=ActionTypeEnum.Comment,
                content="Đang bóc tách khối lượng hạng mục móng",
            ),
            ActivityLog(
                id=gen_uuid(), task_id=task3.id, user_id=manager.id,
                action_type=ActionTypeEnum.StatusChange,
                content="Manager duyệt và chuyển sang Trình ký Nội bộ",
            ),
            ActivityLog(
                id=gen_uuid(), task_id=task5.id, user_id=staff.id,
                action_type=ActionTypeEnum.StatusChange,
                content="Đã đổi trạng thái sang Vướng mắc",
            ),
            ActivityLog(
                id=gen_uuid(), task_id=task5.id, user_id=staff.id,
                action_type=ActionTypeEnum.Comment,
                content="CĐT yêu cầu bổ sung biên bản nghiệm thu nội bộ GĐ2",
            ),
        ]

        db.add_all(logs)
        db.commit()

        for log in logs:
            print(f"   ✅ {log}")

        # ═══════════════════════════════════════════
        # SUMMARY
        # ═══════════════════════════════════════════
        user_count = db.query(User).count()
        project_count = db.query(Project).count()
        task_count = db.query(Task).count()
        attachment_count = db.query(Attachment).count()
        log_count = db.query(ActivityLog).count()

        print("\n" + "=" * 50)
        print("🎉 SEED HOÀN TẤT!")
        print("=" * 50)
        print(f"   👤 Users:        {user_count}")
        print(f"   📁 Projects:     {project_count}")
        print(f"   📋 Tasks:        {task_count}")
        print(f"   📎 Attachments:  {attachment_count}")
        print(f"   📝 ActivityLogs: {log_count}")
        print("=" * 50)

    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
