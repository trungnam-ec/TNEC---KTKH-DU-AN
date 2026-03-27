'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRole, useToast } from '../providers';

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const API_BASE = 'http://localhost:8000';

interface TaskRow {
  id: string; title: string; description: string | null; project_id: string; project_name: string; project_slug: string;
  assignee_name: string; assignee_id: string | null; status: string; category: string;
  priority: string; value_vnd: string; progress_percent: number; deadline: string | null;
  attachment_count: number; created_at: string; updated_at: string;
}

interface AttachedFile {
  id: string; name: string; type: 'pdf' | 'excel' | 'word' | 'image' | 'other'; size: string; uploadedAt: string;
}

interface ActivityEntry {
  id: string; type: 'comment' | 'status_change' | 'progress_update' | 'file_upload'; user: string; content: string; timestamp: string;
}

const now = () => new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/* ═══════════════════════════════════════════
   STATUS / CATEGORY MAPS
   ═══════════════════════════════════════════ */

const statusColors: Record<string, string> = {
  'Kế hoạch': 'text-slate-600 border-slate-200 bg-slate-50',
  'Đang xử lý': 'text-blue-600 border-blue-200 bg-blue-50',
  'Trình ký Nội bộ': 'text-violet-600 border-violet-200 bg-violet-50',
  'Trình CĐT': 'text-teal-600 border-teal-200 bg-teal-50',
  'Vướng mắc': 'text-red-600 border-red-200 bg-red-50',
  'Hoàn thành': 'text-green-600 border-green-200 bg-green-50',
};

const statusDot: Record<string, string> = {
  'Kế hoạch': 'border-slate-300 bg-slate-100',
  'Đang xử lý': 'border-blue-500 bg-blue-100',
  'Trình ký Nội bộ': 'border-violet-500 bg-violet-100',
  'Trình CĐT': 'border-teal-500 bg-teal-100',
  'Vướng mắc': 'border-red-500 bg-red-100',
  'Hoàn thành': 'border-green-500 bg-green-100',
};

const categoryColors: Record<string, string> = {
  'Đấu thầu': 'bg-blue-100 text-blue-700',
  'Dự toán': 'bg-violet-100 text-violet-700',
  'Hợp đồng': 'bg-emerald-100 text-emerald-700',
  'Thanh quyết toán': 'bg-teal-100 text-teal-700',
  'Nghiệm thu': 'bg-red-100 text-red-700',
  'Khối lượng': 'bg-amber-100 text-amber-700',
};

const statusKeys = [
  { value: 'Kế hoạch', id: 'backlog' },
  { value: 'Đang xử lý', id: 'in-progress' },
  { value: 'Trình ký Nội bộ', id: 'internal-review' },
  { value: 'Trình CĐT', id: 'external-review' },
  { value: 'Vướng mắc', id: 'blocked' },
  { value: 'Hoàn thành', id: 'done' },
];

const categoryOptions = ['Đấu thầu', 'Dự toán', 'Hợp đồng', 'Thanh quyết toán', 'Nghiệm thu', 'Khối lượng'];

const priorityOptions = ['Khẩn cấp', 'Cao', 'Trung bình', 'Thấp'];

const priorityColors: Record<string, string> = {
  'Khẩn cấp': 'bg-red-100 text-red-700 border-red-200',
  'Cao': 'bg-orange-100 text-orange-700 border-orange-200',
  'Trung bình': 'bg-blue-100 text-blue-600 border-blue-200',
  'Thấp': 'bg-slate-100 text-slate-500 border-slate-200',
};

const priorityIcons: Record<string, string> = {
  'Khẩn cấp': '🔴', 'Cao': '🟠', 'Trung bình': '🔵', 'Thấp': '⚪',
};

/* ═══════════════════════════════════════════
   FILE TYPE ICON
   ═══════════════════════════════════════════ */

function FileIcon({ type }: { type: AttachedFile['type'] }) {
  const colors: Record<string, string> = { pdf: 'text-red-500 bg-red-50', excel: 'text-green-600 bg-green-50', word: 'text-blue-600 bg-blue-50', image: 'text-purple-500 bg-purple-50', other: 'text-slate-500 bg-slate-50' };
  const labels: Record<string, string> = { pdf: 'PDF', excel: 'XLS', word: 'DOC', image: 'IMG', other: 'FILE' };
  return <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${colors[type]} border border-white/50`}>{labels[type]}</div>;
}

/* ═══════════════════════════════════════════
   NEW TASK MODAL — PERSISTS TO BACKEND API
   ═══════════════════════════════════════════ */

interface ProjectOption { id: string; slug: string; name: string; }
interface UserOption { id: string; full_name: string; email: string; role: string; }

function NewTaskModal({ onClose, onSaved, projects }: { onClose: () => void; onSaved: () => void; projects: ProjectOption[] }) {
  const { user } = useRole();
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [priority, setPriority] = useState('Trung bình');
  const [valueVnd, setValueVnd] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch active users for assignee dropdown
  useEffect(() => {
    fetch(`${API_BASE}/api/users`)
      .then(r => r.json())
      .then((data: UserOption[]) => setUsers(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !projectId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          project_id: projectId,
          assignee_id: assigneeId || null,
          status: 'Kế hoạch',
          category,
          priority,
          value_vnd: parseFloat(valueVnd.replace(/,/g, '')) || 0,
          progress_percent: 0,
          deadline: deadline || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast('success', `Đã tạo công việc "${title.trim()}" và lưu vào Database!`);
      onSaved();
    } catch (err) {
      addToast('error', `Lỗi tạo task: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 8px 60px rgba(0, 0, 0, 0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <h2 className="text-lg font-bold text-slate-800">✏️ Tạo công việc mới</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/50 text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tên công việc *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Lập hồ sơ đấu thầu..." className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả chi tiết</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Yêu cầu cụ thể, lưu ý đặc biệt, file mẫu cần tham khảo..." className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40 resize-none" style={{ background: 'rgba(255,255,255,0.5)' }} />
          </div>
          {/* Assignee Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">👤 Người phụ trách</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <option value="">— Chưa giao cho ai —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dự án</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loại công việc</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mức độ ưu tiên</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {priorityOptions.map(p => <option key={p} value={p}>{priorityIcons[p]} {p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Giá trị (VNĐ)</label>
              <input type="text" value={valueVnd} onChange={e => setValueVnd(e.target.value)} placeholder="0" className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/30">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/50">Hủy</button>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20 disabled:opacity-50 flex items-center gap-2">
            {saving ? '⏳ Đang lưu...' : '➕ Tạo Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TASK DETAIL MODAL
   ═══════════════════════════════════════════ */

function TaskDetailModal({ task, onClose, onSaved }: { task: TaskRow; onClose: () => void; onSaved: () => void }) {
  const { user, canTransitionTo, canEditValue, isManager } = useRole();
  const { addToast } = useToast();
  const [editStatus, setEditStatus] = useState(task.status);
  const [editProgress, setEditProgress] = useState(task.progress_percent);
  const [editValue, setEditValue] = useState(task.value_vnd);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editPriority, setEditPriority] = useState(task.priority || 'Trung bình');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusIdMap: Record<string, string> = { 'Kế hoạch': 'backlog', 'Đang xử lý': 'in-progress', 'Trình ký Nội bộ': 'internal-review', 'Trình CĐT': 'external-review', 'Vướng mắc': 'blocked', 'Hoàn thành': 'done' };
  const valueEditable = isManager || task.assignee_name === user.name;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const getFileType = (name: string): AttachedFile['type'] => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf'; if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel'; if (['doc', 'docx'].includes(ext)) return 'word'; if (['png', 'jpg', 'jpeg'].includes(ext)) return 'image'; return 'other';
  };

  const addFiles = (fileList: FileList) => {
    const newFiles: AttachedFile[] = Array.from(fileList).map((f, i) => ({
      id: `u-${Date.now()}-${i}`, name: f.name, type: getFileType(f.name),
      size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
      uploadedAt: new Date().toLocaleDateString('vi-VN'),
    }));
    setFiles(prev => [...newFiles, ...prev]);
    newFiles.forEach(f => setActivities(prev => [{ id: `a-${Date.now()}`, type: 'file_upload', user: user.name, content: `Đã tải lên: ${f.name}`, timestamp: now() }, ...prev]));
  };

  const handleStatusChange = (val: string) => {
    const colId = statusIdMap[val] || 'backlog';
    if (!canTransitionTo(colId)) { addToast('error', `Lỗi phân quyền: Bạn không có quyền chuyển sang "${val}".`); return; }
    setEditStatus(val);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    setActivities(prev => [{ id: `a-${Date.now()}`, type: 'comment', user: user.name, content: commentText.trim(), timestamp: now() }, ...prev]);
    setCommentText('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update status if changed
      if (editStatus !== task.status) {
        const res = await fetch(`${API_BASE}/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: editStatus }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || `HTTP ${res.status}`); }
      }
      // Update progress if changed
      if (editProgress !== task.progress_percent) {
        await fetch(`${API_BASE}/api/tasks/${task.id}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress_percent: editProgress }),
        });
      }
      // Update value if changed
      if (editValue !== task.value_vnd) {
        await fetch(`${API_BASE}/api/tasks/${task.id}/value`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value_vnd: parseFloat(editValue.replace(/,/g, '')) || 0 }),
        });
      }
      // Update description/priority if changed
      if (editDescription !== (task.description || '') || editPriority !== (task.priority || 'Trung bình')) {
        await fetch(`${API_BASE}/api/tasks/${task.id}/details`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: editDescription || null, priority: editPriority }),
        });
      }
      addToast('success', `Đã lưu "${task.title}" vào Database!`);
      onSaved();
    } catch (err: any) {
      addToast('error', `Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activityIcons: Record<string, string> = { comment: '💬', status_change: '🔄', progress_update: '📈', file_upload: '📎' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 8px 60px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${categoryColors[task.category] || 'bg-slate-100 text-slate-600'}`}>{task.category}</span>
            <h2 className="text-lg font-bold text-slate-800 truncate">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${isManager ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'}`}>{isManager ? '👑 Manager' : '👤 Staff'}</span>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/50 text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>

        {/* Body 60/40 */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT */}
          <div className="w-[60%] p-6 overflow-y-auto border-r border-white/30 space-y-5">
            {/* Priority & Status row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Trạng thái</label>
                <select value={editStatus} onChange={e => handleStatusChange(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                  {statusKeys.map(s => {
                    const forbidden = !canTransitionTo(s.id);
                    return <option key={s.id} value={s.value} disabled={forbidden}>{s.value}{forbidden ? ' 🔒' : ''}</option>;
                  })}
                </select>
                {!isManager && <p className="text-[10px] text-amber-600 mt-1 font-medium">🔒 Staff chỉ được chuyển: Kế hoạch ↔ Đang xử lý ↔ Trình ký Nội bộ</p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Mức độ ưu tiên</label>
                <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                  {priorityOptions.map(p => <option key={p} value={p}>{priorityIcons[p]} {p}</option>)}
                </select>
              </div>
            </div>
            {/* Description */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">📝 Mô tả chi tiết / Yêu cầu</label>
              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4}
                placeholder="Thêm mô tả chi tiết, yêu cầu cụ thể, lưu ý đặc biệt..."
                className="w-full px-4 py-3 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40 resize-none leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
            {/* Project */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Dự án</label>
              <div className="px-4 py-2.5 rounded-xl border border-white/50 text-sm font-medium text-slate-600" style={{ background: 'rgba(255,255,255,0.4)' }}>{task.project_name}</div>
            </div>
            {/* Value + Progress */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Giá trị (VNĐ) {!valueEditable && <span className="text-amber-500 ml-1">🔒</span>}</label>
                <div className="relative">
                  <input type="text" value={editValue} onChange={e => valueEditable && setEditValue(e.target.value)} readOnly={!valueEditable}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold border border-white/50 focus:outline-none pr-14 ${valueEditable ? 'text-slate-800 focus:ring-2 focus:ring-primary-400/40' : 'text-slate-400 cursor-not-allowed'}`}
                    style={{ background: valueEditable ? 'rgba(255,255,255,0.5)' : 'rgba(241,245,249,0.4)', fontFamily: 'Inter' }} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">VNĐ</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tiến độ — <span className="text-primary-600 text-sm">{editProgress}%</span></label>
                <input type="range" min={0} max={100} value={editProgress} onChange={e => setEditProgress(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary-500 mt-2" style={{ background: `linear-gradient(to right, #1976D2 0%, #1976D2 ${editProgress}%, rgba(203,213,225,0.5) ${editProgress}%, rgba(203,213,225,0.5) 100%)` }} />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
              </div>
            </div>
            {task.deadline && (
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Deadline</label>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/50" style={{ background: 'rgba(255,255,255,0.4)' }}>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm font-semibold text-slate-700">{new Date(task.deadline).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="w-[40%] p-6 overflow-y-auto flex flex-col gap-5">
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📎 Tài liệu đính kèm ({files.length})</h3>
              <div onDragOver={e => { e.preventDefault(); setIsFileDragOver(true); }} onDragLeave={() => setIsFileDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsFileDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 ${isFileDragOver ? 'border-primary-400 bg-primary-50/40 scale-[1.02]' : 'border-slate-200/60 hover:border-primary-300'}`}>
                <svg className={`w-8 h-8 ${isFileDragOver ? 'text-primary-500' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="text-xs text-slate-500 font-medium">{isFileDragOver ? <span className="text-primary-600 font-bold">Thả file</span> : <>Kéo thả hoặc <span className="text-primary-500 font-semibold">chọn file</span></>}</p>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); }} accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg" />
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/40">
                      <FileIcon type={f.type} />
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p><p className="text-[10px] text-slate-400">{f.size}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📝 Nhật ký làm việc</h3>
              <div className="flex gap-2 mb-3">
                <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitComment(); }} placeholder="Ghi chú..." className="flex-1 px-3 py-2 rounded-lg text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40 placeholder:text-slate-300" style={{ background: 'rgba(255,255,255,0.5)' }} />
                <button onClick={submitComment} disabled={!commentText.trim()} className="px-3 py-2 rounded-lg bg-primary-500 text-white text-xs font-bold hover:bg-primary-600 disabled:opacity-40 shadow-sm">Gửi</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-48">
                {activities.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Chưa có hoạt động</p>}
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3">
                    <span className="text-sm">{activityIcons[a.type]}</span>
                    <div><div className="flex items-baseline gap-2"><span className="text-xs font-bold text-slate-700">{a.user}</span><span className="text-[10px] text-slate-400">{a.timestamp}</span></div><p className="text-xs text-slate-600 mt-0.5">{a.content}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/30 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/50">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20 disabled:opacity-60 flex items-center gap-2">
            {saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE — FETCHES FROM BACKEND API
   ═══════════════════════════════════════════ */

export default function MyTasks() {
  const { user } = useRole();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const perPage = 10;

  // Fetch tasks from API
  const fetchTasks = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks/my-tasks?page=${p}&per_page=${perPage}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
    } catch (err) {
      addToast('error', `Không thể tải dữ liệu: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [perPage, addToast]);

  // Fetch projects for the New Task modal
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data.map((p: any) => ({ id: p.id, slug: p.slug, name: p.name })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchTasks(1); fetchProjects(); }, [fetchTasks, fetchProjects]);

  const showingFrom = total === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, total);

  const formatDeadline = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isOverdue = (d: string | null) => {
    if (!d) return false;
    return new Date(d) < new Date();
  };

  const formatVND = (v: string) => {
    const num = parseFloat(v.replace(/,/g, ''));
    if (isNaN(num)) return v;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)} tỷ`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(0)} tr`;
    return v;
  };

  const handleTaskCreated = () => {
    setShowNewTask(false);
    fetchTasks(1);  // Re-fetch page 1 from DB
  };

  const handleTaskSaved = () => {
    setSelectedTask(null);
    fetchTasks(page);  // Re-fetch current page from DB
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    fetchTasks(p);
  };

  return (
    <>
      <div className="flex flex-col h-full space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/50 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
          <div>
            <h2 className="text-2xl font-bold text-heading text-slate-800 mb-1">Công việc của tôi</h2>
            <p className="text-slate-500 font-medium text-sm">Quản lý và theo dõi tất cả công việc được giao — xin chào, <span className="text-primary-600 font-semibold">{user.name}</span></p>
          </div>
          <button onClick={() => setShowNewTask(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-primary-500/20 flex items-center gap-2 hover:scale-105 active:scale-95">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tạo mới
          </button>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl flex-1 overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-white/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/20">
            <div className="col-span-1">Trạng thái</div>
            <div className="col-span-3">Tên công việc</div>
            <div className="col-span-2">Dự án</div>
            <div className="col-span-1 text-center">Ưu tiên</div>
            <div className="col-span-2 text-right">Giá trị</div>
            <div className="col-span-1 text-center">Deadline</div>
            <div className="col-span-1 text-center">Tiến độ</div>
            <div className="col-span-1 text-center">Thao tác</div>
          </div>

          {/* Table Body */}
          <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4" />
                <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="font-medium">Chưa có công việc nào</p>
              </div>
            ) : tasks.map(task => (
              <div key={task.id} onClick={() => setSelectedTask(task)}
                className="grid grid-cols-12 gap-3 px-3 py-3 items-center hover:bg-white/40 rounded-xl transition-all cursor-pointer group">
                <div className="col-span-1 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${statusDot[task.status] || 'border-slate-300 bg-slate-100'}`} />
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${statusColors[task.status] || 'text-slate-600 border-slate-200 bg-slate-50'}`}>
                    {task.status === 'Trình ký Nội bộ' ? 'Trình NB' : task.status}
                  </span>
                </div>
                <div className="col-span-3">
                  <p className="font-semibold text-sm text-slate-700 truncate group-hover:text-primary-600 transition-colors">{task.title}</p>
                  {task.attachment_count > 0 && <span className="text-[10px] text-slate-400">📎 {task.attachment_count} file</span>}
                </div>
                <div className="col-span-2 text-xs text-slate-500 truncate">{task.project_name}</div>
                <div className="col-span-1 flex justify-center">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${priorityColors[task.priority] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {priorityIcons[task.priority] || '⚪'} {task.priority || 'TB'}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-bold text-slate-700 tabular-nums" style={{ fontFamily: 'Inter' }}>{formatVND(task.value_vnd)}</span>
                </div>
                <div className="col-span-1 text-center">
                  <span className={`text-xs font-medium ${isOverdue(task.deadline) && task.status !== 'Hoàn thành' ? 'text-red-500' : 'text-slate-500'}`}>
                    {formatDeadline(task.deadline)}
                    {isOverdue(task.deadline) && task.status !== 'Hoàn thành' && <span className="block text-[8px] text-red-500 font-bold">TRỄ HẠN</span>}
                  </span>
                </div>
                <div className="col-span-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500">{task.progress_percent}%</span>
                  <div className="w-full bg-slate-100/80 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${task.progress_percent === 100 ? 'bg-green-500' : task.status === 'Vướng mắc' ? 'bg-red-400' : 'bg-primary-500'}`} style={{ width: `${task.progress_percent}%` }} />
                  </div>
                </div>
                <div className="col-span-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setSelectedTask(task); }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-primary-600 transition-colors" title="Xem chi tiết">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); setSelectedTask(task); }} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-amber-600 transition-colors" title="Chỉnh sửa">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-white/20 flex justify-between items-center bg-white/10 flex-shrink-0">
            <span className="text-xs font-medium text-slate-500">
              Hiển thị <span className="font-bold text-slate-700">{showingFrom}</span> đến <span className="font-bold text-slate-700">{showingTo}</span> trong tổng <span className="font-bold text-primary-600">{total}</span> công việc
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium bg-white/50 text-slate-500 rounded-lg hover:bg-white hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} onClick={() => goToPage(i + 1)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${page === i + 1 ? 'bg-primary-500 text-white shadow-sm' : 'bg-white/50 text-slate-500 hover:bg-white'}`}>{i + 1}</button>
              ))}
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium bg-white/50 text-slate-500 rounded-lg hover:bg-white hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
                Sau
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} onSaved={handleTaskCreated} projects={projects} />}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} onSaved={handleTaskSaved} />}
    </>
  );
}
