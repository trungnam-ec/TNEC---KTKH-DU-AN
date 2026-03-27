"""
TNEC-KTKH Pydantic Schemas (Request/Response DTOs)
===================================================
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from app.models import (
    RoleEnum, ProjectStatusEnum, TaskStatusEnum,
    TaskCategoryEnum, ActionTypeEnum, PriorityEnum,
)


# ═══════════════════════════════════════════
# USER SCHEMAS
# ═══════════════════════════════════════════

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: RoleEnum = RoleEnum.Staff

class UserCreate(UserBase):
    pass

class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: RoleEnum = RoleEnum.Staff

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None

class UserResponse(UserBase):
    id: str
    department: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════
# PROJECT SCHEMAS
# ═══════════════════════════════════════════

class ProjectBase(BaseModel):
    name: str
    slug: str
    client: Optional[str] = None
    location: Optional[str] = None
    total_budget_vnd: Decimal = Decimal("0")
    status: ProjectStatusEnum = ProjectStatusEnum.KhoiDong

class ProjectCreate(ProjectBase):
    pass

class ProjectCreateRequest(BaseModel):
    name: str
    client: Optional[str] = None
    location: Optional[str] = None
    total_budget_vnd: Decimal = Decimal("0")
    status: str = 'Khởi động'

class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    id: str
    name: str
    slug: str
    client: Optional[str] = None
    location: Optional[str] = None
    total_budget_vnd: Decimal
    status: ProjectStatusEnum
    task_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════
# ATTACHMENT SCHEMAS
# ═══════════════════════════════════════════

class AttachmentBase(BaseModel):
    file_name: str
    file_url: str
    file_size: Optional[str] = None
    file_type: Optional[str] = None

class AttachmentCreate(AttachmentBase):
    task_id: str
    uploader_id: str

class AttachmentResponse(AttachmentBase):
    id: str
    task_id: str
    uploader_id: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════
# ACTIVITY LOG SCHEMAS
# ═══════════════════════════════════════════

class ActivityLogBase(BaseModel):
    action_type: ActionTypeEnum
    content: Optional[str] = None

class ActivityLogCreate(ActivityLogBase):
    task_id: str
    user_id: str

class ActivityLogResponse(ActivityLogBase):
    id: str
    task_id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════
# TASK SCHEMAS
# ═══════════════════════════════════════════

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: str
    assignee_id: Optional[str] = None
    status: TaskStatusEnum = TaskStatusEnum.KeHoach
    category: TaskCategoryEnum
    priority: PriorityEnum = PriorityEnum.Medium
    value_vnd: Decimal = Decimal("0")
    progress_percent: int = Field(default=0, ge=0, le=100)
    deadline: Optional[date] = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: str
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserResponse] = None
    attachments: List[AttachmentResponse] = []
    activity_logs: List[ActivityLogResponse] = []

    class Config:
        from_attributes = True

class TaskCardResponse(TaskBase):
    """Lightweight response for Kanban card (no nested relations)"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════
# REQUEST BODIES
# ═══════════════════════════════════════════

class StatusUpdateRequest(BaseModel):
    status: TaskStatusEnum
    comment: Optional[str] = None

class ValueUpdateRequest(BaseModel):
    value_vnd: Decimal
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)

class ProgressUpdateRequest(BaseModel):
    progress_percent: int = Field(ge=0, le=100)

class DescriptionUpdateRequest(BaseModel):
    description: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    assignee_id: Optional[str] = None
