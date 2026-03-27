"""
TNEC-KTKH Database Models (SQLAlchemy ORM)
==========================================
Sử dụng UUID cho tất cả Primary Key.
Sử dụng Numeric/Decimal cho dữ liệu tiền tệ (tránh sai số Float).
"""

import uuid
from enum import Enum as PyEnum
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Boolean, Integer, Numeric, Date, DateTime,
    Enum, ForeignKey, Text, CheckConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ═══════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════

class RoleEnum(str, PyEnum):
    Manager = 'Manager'
    Staff = 'Staff'


class ProjectStatusEnum(str, PyEnum):
    KhoiDong = 'Khởi động'
    DangThiCong = 'Đang thi công'
    NghiemThu = 'Nghiệm thu'
    HoanThanh = 'Hoàn thành'


class TaskStatusEnum(str, PyEnum):
    KeHoach = 'Kế hoạch'
    DangXuLy = 'Đang xử lý'
    TrinhKyNoiBo = 'Trình ký Nội bộ'
    TrinhCDT = 'Trình CĐT'
    VuongMac = 'Vướng mắc'
    HoanThanh = 'Hoàn thành'


class TaskCategoryEnum(str, PyEnum):
    DauThau = 'Đấu thầu'
    DuToan = 'Dự toán'
    HopDong = 'Hợp đồng'
    ThanhQuyetToan = 'Thanh quyết toán'
    NghiemThu = 'Nghiệm thu'
    KhoiLuong = 'Khối lượng'


class PriorityEnum(str, PyEnum):
    Urgent = 'Khẩn cấp'
    High = 'Cao'
    Medium = 'Trung bình'
    Low = 'Thấp'


class ActionTypeEnum(str, PyEnum):
    Comment = 'Comment'
    StatusChange = 'Status_Change'
    ProgressUpdate = 'Progress_Update'
    FileUpload = 'File_Upload'


# ═══════════════════════════════════════════
# BẢNG USERS (Quản lý Nhân sự)
# ═══════════════════════════════════════════

class User(Base):
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.Staff, nullable=False)
    department = Column(String(255), default='KTKH', nullable=True)
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    uploaded_attachments = relationship("Attachment", back_populates="uploader")
    activity_logs = relationship("ActivityLog", back_populates="user")

    def __repr__(self):
        return f"<User {self.full_name} ({self.role.value})>"


# ═══════════════════════════════════════════
# BẢNG PROJECTS (Dự án)
# ═══════════════════════════════════════════

class Project(Base):
    __tablename__ = 'projects'

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(500), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    client = Column(String(500), nullable=True)
    location = Column(String(500), nullable=True)
    total_budget_vnd = Column(Numeric(precision=20, scale=2), default=0, nullable=False)
    status = Column(Enum(ProjectStatusEnum), default=ProjectStatusEnum.KhoiDong, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.name}>"


# ═══════════════════════════════════════════
# BẢNG TASKS (Cốt lõi - Thẻ Kanban)
# ═══════════════════════════════════════════

class Task(Base):
    __tablename__ = 'tasks'

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(String(36), ForeignKey('projects.id'), nullable=False, index=True)
    assignee_id = Column(String(36), ForeignKey('users.id'), nullable=True, index=True)

    status = Column(Enum(TaskStatusEnum), default=TaskStatusEnum.KeHoach, nullable=False)
    category = Column(Enum(TaskCategoryEnum), nullable=False)
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.Medium, nullable=False)
    value_vnd = Column(Numeric(precision=20, scale=2), default=0, nullable=False)
    progress_percent = Column(Integer, default=0, nullable=False)
    deadline = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Constraints
    __table_args__ = (
        CheckConstraint('progress_percent >= 0 AND progress_percent <= 100', name='ck_progress_range'),
    )

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    attachments = relationship("Attachment", back_populates="task", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Task {self.title} [{self.status.value}]>"


# ═══════════════════════════════════════════
# BẢNG ATTACHMENTS (Quản lý File đính kèm)
# ═══════════════════════════════════════════

class Attachment(Base):
    __tablename__ = 'attachments'

    id = Column(String(36), primary_key=True, default=gen_uuid)
    task_id = Column(String(36), ForeignKey('tasks.id'), nullable=False, index=True)
    uploader_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    file_name = Column(String(500), nullable=False)
    file_url = Column(String(1000), nullable=False)
    file_size = Column(String(50), nullable=True)
    file_type = Column(String(20), nullable=True)

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="attachments")
    uploader = relationship("User", back_populates="uploaded_attachments")

    def __repr__(self):
        return f"<Attachment {self.file_name}>"


# ═══════════════════════════════════════════
# BẢNG ACTIVITY_LOGS (Nhật ký & Bình luận)
# ═══════════════════════════════════════════

class ActivityLog(Base):
    __tablename__ = 'activity_logs'

    id = Column(String(36), primary_key=True, default=gen_uuid)
    task_id = Column(String(36), ForeignKey('tasks.id'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)

    action_type = Column(Enum(ActionTypeEnum), nullable=False)
    content = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="activity_logs")
    user = relationship("User", back_populates="activity_logs")

    def __repr__(self):
        return f"<ActivityLog [{self.action_type.value}] by user {self.user_id}>"
