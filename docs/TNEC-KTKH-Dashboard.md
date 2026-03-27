# Tiêu đề: TNEC-KTKH Dashboard
# Mô tả: Ứng dụng quản lý dự án nội bộ kết hợp Kanban và Báo cáo tài chính
# Tech Stack:
- Backend: FastAPI (Python), SQLAlchemy, PostgreSQL/SQLite
- Frontend: Next.js (React), Tailwind CSS
- UI/UX: Glassmorphism

# Yêu cầu cấu trúc:
1. Models:
- User (Google OAuth, @trungnamec.com.vn & @trungnamgroup.com.vn, Manager/Staff)
- Project (Name, Total Budget)
- TaskCard (Kanban logic, category, value_vnd, progress)
- ActivityLog (Comment khi kéo thả, nhất là cột Vướng mắc)

2. Layout:
- Sidebar & Navbar với hiệu ứng Glassmorphism.
- Bảng Kanban với các cột: Kế hoạch, Đang xử lý, Trình ký Nội bộ, Trình CĐT, Vướng mắc (Red blink), Hoàn thành.
