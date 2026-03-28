"""
TNEC-KTKH Dashboard API
========================
FastAPI backend with RBAC enforcement.
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal

from app.database import engine, get_db, init_db
from app import models, schemas

app = FastAPI(title="TNEC-KTKH Dashboard API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def read_root():
    return {"message": "Welcome to TNEC-KTKH API v2", "status": "ok"}


# ═══════════════════════════════════════════
# RBAC RULES
# ═══════════════════════════════════════════

STAFF_ALLOWED_STATUSES = {
    models.TaskStatusEnum.KeHoach,
    models.TaskStatusEnum.DangXuLy,
    models.TaskStatusEnum.TrinhKyNoiBo,
}

STAFF_FORBIDDEN_STATUSES = {
    models.TaskStatusEnum.TrinhCDT,
    models.TaskStatusEnum.VuongMac,
    models.TaskStatusEnum.HoanThanh,
}


def get_current_user(db: Session, user_id: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user


def check_status_permission(role: models.RoleEnum, new_status: models.TaskStatusEnum) -> bool:
    if role in (models.RoleEnum.Admin, models.RoleEnum.Manager):
        return True
    if role == models.RoleEnum.Staff:
        return new_status not in STAFF_FORBIDDEN_STATUSES
    return False


def check_value_edit_permission(role: models.RoleEnum, user_id: str, task_assignee_id: str) -> bool:
    if role in (models.RoleEnum.Admin, models.RoleEnum.Manager):
        return True
    return user_id == task_assignee_id


# ═══════════════════════════════════════════
# USER APIs
# ═══════════════════════════════════════════

@app.get("/api/users", response_model=List[schemas.UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.is_active == True).all()


@app.get("/api/users/me", response_model=schemas.UserResponse)
def get_current_user_profile(
    user_id: Optional[str] = Query(None, description="Current user ID (UUID)"),
    role: Optional[str] = Query(None, description="Fallback: resolve by role"),
    db: Session = Depends(get_db),
):
    """Get current user's profile. Resolves by user_id > role > first Admin > first Manager."""
    user = None
    if user_id and len(user_id) > 10:
        user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user and role == 'Staff':
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Staff).first()
    if not user and role == 'Manager':
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Manager).first()
    if not user:
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Admin).first()
    if not user:
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Manager).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/api/users/update-profile", response_model=schemas.UserResponse)
def update_user_profile(
    body: schemas.UserProfileUpdate,
    user_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Update current user's profile (name, department, bio)."""
    user = None
    if user_id and len(user_id) > 10:
        user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user and role == 'Staff':
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Staff).first()
    if not user and role == 'Manager':
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Manager).first()
    if not user:
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Admin).first()
    if not user:
        user = db.query(models.User).filter(models.User.role == models.RoleEnum.Manager).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.department is not None:
        user.department = body.department
    if body.bio is not None:
        user.bio = body.bio

    db.commit()
    db.refresh(user)
    return user


@app.get("/api/users/all", response_model=List[schemas.UserResponse])
def list_all_users(db: Session = Depends(get_db)):
    """List ALL users (including inactive) for Manager user management table."""
    return db.query(models.User).order_by(models.User.created_at.asc()).all()


@app.post("/api/users/create", response_model=schemas.UserResponse, status_code=201)
def create_user(body: schemas.UserCreateRequest, db: Session = Depends(get_db)):
    """Create a new user. Email must end with @trungnamec.com.vn or @trungnamgroup.com.vn."""
    email_lower = body.email.lower()
    valid_domains = ['@gmail.com', '@trungnamec.com.vn', '@trungnamgroup.com.vn']
    if not any(email_lower.endswith(d) for d in valid_domains):
        raise HTTPException(
            status_code=400,
            detail=f"Email phải có đuôi @gmail.com hoặc domain công ty (@trungnamec.com.vn / @trungnamgroup.com.vn)"
        )

    existing = db.query(models.User).filter(models.User.email == email_lower).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Email {email_lower} đã tồn tại trong hệ thống.")

    new_user = models.User(
        id=models.gen_uuid(),
        email=email_lower,
        full_name=body.full_name,
        role=body.role,
        department='KTKH',
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.patch("/api/users/{user_id}/toggle-active", response_model=schemas.UserResponse)
def toggle_user_active(user_id: str, db: Session = Depends(get_db)):
    """Toggle user active/inactive status."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    """
    Hard delete a user safely.
    Before deleting, sets assignee_id to NULL for all their assigned tasks.
    Their activity logs and attachments will be cascade deleted based on DB schema or handled gracefully.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Unassign tasks
    tasks = db.query(models.Task).filter(models.Task.assignee_id == user_id).all()
    for task in tasks:
        task.assignee_id = None
    
    # Delete user
    db.delete(user)
    db.commit()
    return None


@app.get("/api/users/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/api/users/check-email/{email}", response_model=schemas.UserResponse)
def check_user_email(email: str, db: Session = Depends(get_db)):
    """Check if a user exists by email (used by SSO)."""
    user = db.query(models.User).filter(models.User.email == email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Tài khoản chưa được phân quyền. Vui lòng liên hệ Trưởng phòng.")
    return user


# ═══════════════════════════════════════════
# PROJECT APIs
# ═══════════════════════════════════════════

@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    """List all projects with task stats."""
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    result = []
    for p in projects:
        task_count = db.query(models.Task).filter(models.Task.project_id == p.id).count()
        result.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "client": p.client,
            "location": p.location,
            "total_budget_vnd": float(p.total_budget_vnd),
            "status": p.status.value if p.status else "Khởi động",
            "task_count": task_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return result


@app.get("/api/projects/{slug}")
def get_project_by_slug(slug: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.slug == slug).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.post("/api/projects/create", status_code=201)
def create_project(body: schemas.ProjectCreateRequest, db: Session = Depends(get_db)):
    """Create a new project. Auto-generates slug from name."""
    import re, unicodedata
    # Generate slug
    slug_base = unicodedata.normalize('NFD', body.name.lower())
    slug_base = slug_base.encode('ascii', 'ignore').decode('ascii')
    slug_base = re.sub(r'[^a-z0-9]+', '-', slug_base).strip('-')
    # Ensure uniqueness
    slug = slug_base
    counter = 1
    while db.query(models.Project).filter(models.Project.slug == slug).first():
        slug = f"{slug_base}-{counter}"
        counter += 1

    new_project = models.Project(
        id=models.gen_uuid(),
        name=body.name.strip(),
        slug=slug,
        client=body.client.strip() if body.client else None,
        location=body.location.strip() if body.location else None,
        total_budget_vnd=body.total_budget_vnd,
        status=models.ProjectStatusEnum(body.status) if body.status else models.ProjectStatusEnum.KhoiDong,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {
        "id": new_project.id,
        "name": new_project.name,
        "slug": new_project.slug,
        "client": new_project.client,
        "location": new_project.location,
        "total_budget_vnd": float(new_project.total_budget_vnd),
        "status": new_project.status.value,
        "task_count": 0,
        "created_at": new_project.created_at.isoformat(),
    }


# ═══════════════════════════════════════════
# DASHBOARD STATS API
# ═══════════════════════════════════════════

@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Aggregated data for Dashboard — all from DB, zero mock."""
    from datetime import datetime, date as date_type
    from collections import Counter

    if user_id:
        user = get_current_user(db, user_id)
        if user and user.role == models.RoleEnum.Staff:
            raise HTTPException(status_code=403, detail="Staff cannot view full dashboard stats")

    projects = db.query(models.Project).all()
    tasks = db.query(models.Task).options(
        joinedload(models.Task.project),
        joinedload(models.Task.assignee),
    ).all()
    users = db.query(models.User).filter(models.User.is_active == True).all()

    today = date_type.today()

    # ── KPI Widgets ──
    total_budget = sum(float(p.total_budget_vnd) for p in projects)
    total_task_value = sum(float(t.value_vnd) for t in tasks)
    disbursed = sum(float(t.value_vnd) for t in tasks if t.status == models.TaskStatusEnum.HoanThanh)
    active_tasks = [t for t in tasks if t.status != models.TaskStatusEnum.HoanThanh]
    overdue_tasks = [t for t in active_tasks if t.deadline and t.deadline < today]

    # ── Task Status Distribution (for donut chart) ──
    status_counts = Counter(t.status.value for t in tasks)
    total_tasks = len(tasks)
    status_distribution = []
    for status_val in ['Hoàn thành', 'Đang xử lý', 'Trình ký Nội bộ', 'Trình CĐT', 'Kế hoạch', 'Vướng mắc']:
        count = status_counts.get(status_val, 0)
        pct = round(count / total_tasks * 100) if total_tasks > 0 else 0
        status_distribution.append({"label": status_val, "count": count, "pct": pct})

    # ── Overdue Alerts ──
    overdue_alerts = []
    for t in overdue_tasks:
        days_late = (today - t.deadline).days
        overdue_alerts.append({
            "task_id": t.id,
            "task": t.title,
            "project": t.project.name if t.project else "",
            "days_late": days_late,
            "assignee": t.assignee.full_name if t.assignee else "Chưa giao",
            "priority": t.priority.value if t.priority else "Trung bình",
        })
    overdue_alerts.sort(key=lambda x: x["days_late"], reverse=True)

    # ── Leaderboard (per-user stats) ──
    leaderboard = []
    for u in users:
        user_tasks = [t for t in tasks if t.assignee_id == u.id]
        completed = [t for t in user_tasks if t.status == models.TaskStatusEnum.HoanThanh]
        on_time = [t for t in completed if not t.deadline or t.deadline >= today]
        on_time_pct = round(len(on_time) / len(completed) * 100) if completed else 100
        leaderboard.append({
            "name": u.full_name,
            "role": u.role.value,
            "total_tasks": len(user_tasks),
            "completed": len(completed),
            "in_progress": len([t for t in user_tasks if t.status == models.TaskStatusEnum.DangXuLy]),
            "on_time_pct": on_time_pct,
            "initials": "".join(w[0].upper() for w in u.full_name.split() if w),
        })
    leaderboard.sort(key=lambda x: x["completed"], reverse=True)

    def fmt_vnd(v: float) -> str:
        if v >= 1e12: return f"{v / 1e12:,.1f} nghìn tỷ"
        if v >= 1e9: return f"{v / 1e9:,.1f} tỷ"
        if v >= 1e6: return f"{v / 1e6:,.0f} tr"
        return f"{v:,.0f}"

    return {
        "kpi": {
            "total_budget": fmt_vnd(total_budget),
            "total_budget_raw": total_budget,
            "total_task_value": fmt_vnd(total_task_value),
            "total_task_value_raw": total_task_value,
            "disbursed": fmt_vnd(disbursed),
            "disbursed_raw": disbursed,
            "disbursed_pct": round(disbursed / total_task_value * 100, 1) if total_task_value > 0 else 0,
            "project_count": len(projects),
            "active_tasks": len(active_tasks),
            "total_tasks": total_tasks,
            "overdue_count": len(overdue_tasks),
        },
        "status_distribution": status_distribution,
        "overdue_alerts": overdue_alerts,
        "leaderboard": leaderboard,
    }


# ═══════════════════════════════════════════
# PROJECT APIs
# ═══════════════════════════════════════════

@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


@app.get("/api/projects/{project_slug}")
def get_project_by_slug(project_slug: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.slug == project_slug).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = db.query(models.Task).filter(models.Task.project_id == project.id).all()

    total_value = sum(t.value_vnd for t in tasks)
    disbursed = sum(t.value_vnd for t in tasks if t.status == models.TaskStatusEnum.HoanThanh)

    return {
        "id": project.id,
        "name": project.name,
        "slug": project.slug,
        "total_budget_vnd": str(project.total_budget_vnd),
        "status": project.status.value,
        "task_count": len(tasks),
        "total_task_value": str(total_value),
        "disbursed": str(disbursed),
    }


# ═══════════════════════════════════════════
# TASK APIs
# ═══════════════════════════════════════════

@app.get("/api/tasks/my-tasks")
def get_my_tasks(
    user_id: Optional[str] = Query(None, description="Current user ID"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get tasks. If Staff, highly restricted to only assigned tasks."""
    query = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.project),
            joinedload(models.Task.assignee),
            joinedload(models.Task.attachments),
        )
    )

    if user_id:
        user = get_current_user(db, user_id)
        if user and user.role == models.RoleEnum.Staff:
            query = query.filter(models.Task.assignee_id == user.id)

    query = query.order_by(models.Task.deadline.asc().nullslast())

    total = query.count()
    tasks = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "project_id": t.project_id,
                "project_name": t.project.name if t.project else "",
                "project_slug": t.project.slug if t.project else "",
                "assignee_name": t.assignee.full_name if t.assignee else "",
                "assignee_id": t.assignee_id,
                "status": t.status.value,
                "category": t.category.value,
                "priority": t.priority.value if t.priority else "Trung bình",
                "value_vnd": str(t.value_vnd),
                "progress_percent": t.progress_percent,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "attachment_count": len(t.attachments),
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat(),
            }
            for t in tasks
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@app.get("/api/tasks", response_model=List[schemas.TaskCardResponse])
def list_tasks(
    project_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Task)
    if project_id:
        query = query.filter(models.Task.project_id == project_id)
    
    if user_id:
        user = get_current_user(db, user_id)
        if user and user.role == models.RoleEnum.Staff:
            query = query.filter(models.Task.assignee_id == user.id)

    return query.order_by(models.Task.created_at.desc()).all()


@app.get("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.assignee),
            joinedload(models.Task.attachments),
            joinedload(models.Task.activity_logs),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/tasks", response_model=schemas.TaskCardResponse, status_code=201)
def create_task(body: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**body.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.patch("/api/tasks/{task_id}/status", response_model=schemas.TaskCardResponse)
def update_task_status(
    task_id: str,
    body: schemas.StatusUpdateRequest,
    user_id: Optional[str] = Query(None, description="Current user ID"),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user = None
    if user_id:
        user = get_current_user(db, user_id)
    if not user:
        user = db.query(models.User).filter(models.User.role.in_([models.RoleEnum.Admin, models.RoleEnum.Manager])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # ── RBAC CHECK ──
    if not check_status_permission(user.role, body.status):
        raise HTTPException(
            status_code=403,
            detail=f"Lỗi phân quyền: Bạn (Staff) không có quyền chuyển trạng thái sang '{body.status.value}'. Chỉ Manager mới được duyệt/trả về hồ sơ."
        )

    # Vướng mắc requires comment
    if body.status == models.TaskStatusEnum.VuongMac and not body.comment:
        raise HTTPException(
            status_code=400,
            detail="Bắt buộc phải có comment khi chuyển trạng thái Vướng mắc"
        )

    old_status = task.status
    task.status = body.status
    db.commit()

    log = models.ActivityLog(
        task_id=task_id,
        user_id=user.id,
        action_type=models.ActionTypeEnum.StatusChange,
        content=body.comment or f"Đổi trạng thái từ {old_status.value} sang {body.status.value}",
    )
    db.add(log)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}/value", response_model=schemas.TaskCardResponse)
def update_task_value(
    task_id: str,
    body: schemas.ValueUpdateRequest,
    user_id: Optional[str] = Query(None, description="Current user ID"),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user = None
    if user_id:
        user = get_current_user(db, user_id)
    if not user:
        user = db.query(models.User).filter(models.User.role.in_([models.RoleEnum.Admin, models.RoleEnum.Manager])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # ── RBAC CHECK: Value edit ──
    if not check_value_edit_permission(user.role, user.id, task.assignee_id):
        raise HTTPException(
            status_code=403,
            detail="Lỗi phân quyền: Chỉ người phụ trách hoặc Manager mới được sửa Giá trị VNĐ."
        )

    task.value_vnd = body.value_vnd
    if body.progress_percent is not None:
        task.progress_percent = body.progress_percent
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}/progress", response_model=schemas.TaskCardResponse)
def update_task_progress(
    task_id: str,
    body: schemas.ProgressUpdateRequest,
    user_id: Optional[str] = Query(None, description="Current user ID"),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user = None
    if user_id:
        user = get_current_user(db, user_id)
    if not user:
        user = db.query(models.User).filter(models.User.role.in_([models.RoleEnum.Admin, models.RoleEnum.Manager])).first()

    old_progress = task.progress_percent
    task.progress_percent = body.progress_percent
    db.commit()

    if user:
        log = models.ActivityLog(
            task_id=task_id,
            user_id=user.id,
            action_type=models.ActionTypeEnum.ProgressUpdate,
            content=f"Cập nhật tiến độ từ {old_progress}% lên {body.progress_percent}%",
        )
        db.add(log)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}/details", response_model=schemas.TaskCardResponse)
def update_task_details(
    task_id: str,
    body: schemas.DescriptionUpdateRequest,
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.description is not None:
        task.description = body.description
    if body.priority is not None:
        task.priority = body.priority
    if body.assignee_id is not None:
        task.assignee_id = body.assignee_id

    db.commit()
    db.refresh(task)
    return task


# ═══════════════════════════════════════════
# ATTACHMENT APIs
# ═══════════════════════════════════════════

@app.get("/api/tasks/{task_id}/attachments", response_model=List[schemas.AttachmentResponse])
def list_attachments(task_id: str, db: Session = Depends(get_db)):
    return db.query(models.Attachment).filter(models.Attachment.task_id == task_id).all()


@app.post("/api/tasks/{task_id}/attachments", response_model=schemas.AttachmentResponse, status_code=201)
def create_attachment(
    task_id: str,
    body: schemas.AttachmentCreate,
    db: Session = Depends(get_db),
):
    att = models.Attachment(
        task_id=task_id,
        uploader_id=body.uploader_id,
        file_name=body.file_name,
        file_url=body.file_url,
        file_size=body.file_size,
        file_type=body.file_type,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


# ═══════════════════════════════════════════
# ACTIVITY LOG APIs
# ═══════════════════════════════════════════

@app.get("/api/tasks/{task_id}/logs", response_model=List[schemas.ActivityLogResponse])
def list_activity_logs(task_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.task_id == task_id)
        .order_by(models.ActivityLog.created_at.desc())
        .all()
    )


@app.post("/api/tasks/{task_id}/logs", response_model=schemas.ActivityLogResponse, status_code=201)
def create_activity_log(
    task_id: str,
    body: schemas.ActivityLogCreate,
    db: Session = Depends(get_db),
):
    log = models.ActivityLog(
        task_id=task_id,
        user_id=body.user_id,
        action_type=body.action_type,
        content=body.content,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ═══════════════════════════════════════════
# RBAC CHECK ENDPOINT
# ═══════════════════════════════════════════

@app.get("/api/rbac/check-status")
def check_rbac_status(
    new_status: models.TaskStatusEnum,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    allowed = check_status_permission(user.role, new_status)
    return {
        "allowed": allowed,
        "role": user.role.value,
        "target_status": new_status.value,
    }
