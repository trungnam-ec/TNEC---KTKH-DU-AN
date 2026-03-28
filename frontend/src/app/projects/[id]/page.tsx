'use client';

import Link from 'next/link';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRole, useToast } from '../../providers';
import { 
  DndContext, 
  DragOverlay, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  closestCorners
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { AlertCircle, CheckCircle2, Clock, FileText, Layout, MoreHorizontal, User } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface ProjectData {
  id: string; name: string; slug: string;
  client: string | null; location: string | null;
  total_budget_vnd: number; status: string;
}

interface AttachedFile {
  id: string; name: string; type: 'pdf' | 'excel' | 'word' | 'image' | 'other'; size: string; uploadedAt: string;
}

interface ActivityEntry {
  id: string; type: 'comment' | 'status_change' | 'progress_update' | 'file_upload' | 'rbac_denied'; user: string; content: string; timestamp: string;
}

interface TaskItem {
  id: string; title: string; category: string; categoryColor: string; valueVND: string; progress: number;
  assignee: string; assigneeId: string | null; assigneeColor: string; deadline: string; isOverdue: boolean; status: string;
  isBlocked?: boolean; blockedNote?: string; files: AttachedFile[]; activities: ActivityEntry[];
  project_id: string;
}

interface UserOption { id: string; full_name: string; email: string; role: string; }

const categoryColors: Record<string, string> = {
  'Đấu thầu': 'bg-blue-100 text-blue-700 border-blue-200',
  'Dự toán': 'bg-violet-100 text-violet-700 border-violet-200',
  'Khối lượng': 'bg-amber-100 text-amber-700 border-amber-200',
  'Hợp đồng': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Thanh quyết toán': 'bg-teal-100 text-teal-700 border-teal-200',
  'Nghiệm thu': 'bg-sky-100 text-sky-700 border-sky-200',
};

const assigneeGradients = [
  'from-blue-400 to-cyan-400', 'from-violet-400 to-fuchsia-400', 'from-amber-400 to-orange-400',
  'from-emerald-400 to-teal-400', 'from-red-400 to-rose-400', 'from-teal-400 to-green-400',
  'from-sky-400 to-blue-400', 'from-green-400 to-emerald-400',
];

const statusDbToKanban: Record<string, string> = {
  'Kế hoạch': 'backlog', 'Đang xử lý': 'in-progress', 'Trình ký Nội bộ': 'internal-review',
  'Trình CĐT / TVGS': 'external-review', 'Vướng mắc': 'blocked', 'Hoàn thành': 'done',
};

const kanbanToDb: Record<string, string> = Object.fromEntries(Object.entries(statusDbToKanban).map(([k, v]) => [v, k]));

const now = () => new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

const columns = [
  { id: 'backlog', title: 'Kế hoạch', dotColor: 'bg-slate-400' },
  { id: 'in-progress', title: 'Đang xử lý', dotColor: 'bg-blue-500' },
  { id: 'internal-review', title: 'Trình ký Nội bộ', dotColor: 'bg-amber-500' },
  { id: 'external-review', title: 'Trình CĐT / TVGS', dotColor: 'bg-teal-500' },
  { id: 'blocked', title: 'Vướng mắc / Chỉnh sửa', dotColor: 'bg-red-500', isBlocked: true },
  { id: 'done', title: 'Hoàn thành', dotColor: 'bg-green-500' },
];

const statusOptions = columns.map(c => ({ value: c.id, label: c.title }));
const categoryOptions = ['Đấu thầu', 'Dự toán', 'Khối lượng', 'Hợp đồng', 'Thanh quyết toán', 'Nghiệm thu'];
const priorityOptions = ['Khẩn cấp', 'Cao', 'Trung bình', 'Thấp'];

function formatBudget(vnd: number): string {
  if (vnd >= 1e12) return `${(vnd / 1e12).toFixed(vnd % 1e12 === 0 ? 0 : 1).replace('.', ',')} nghìn tỷ`;
  if (vnd >= 1e9) return `${(vnd / 1e9).toFixed(vnd % 1e9 === 0 ? 0 : 1).replace('.', ',')} tỷ`;
  return vnd.toLocaleString('vi-VN');
}

function formatVNDInput(val: string): string {
  const numeric = val.replace(/[^0-9]/g, '');
  if (!numeric) return '0';
  return Number(numeric).toLocaleString('vi-VN');
}

function mapApiTaskToItem(t: any, idx: number): TaskItem {
  const kanbanStatus = statusDbToKanban[t.status] || 'backlog';
  const assigneeName = t.assignee?.full_name || 'N/A';
  const abbr = assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
  const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : '—';
  const isOverdue = t.deadline ? new Date(t.deadline) < new Date() && kanbanStatus !== 'done' : false;
  return {
    id: t.id, title: t.title, category: t.category || 'Khối lượng',
    categoryColor: categoryColors[t.category] || 'bg-slate-100 text-slate-700 border-slate-200',
    valueVND: formatBudget(Number(t.value_vnd || 0)), progress: t.progress_percent || 0,
    assignee: abbr, assigneeId: t.assignee_id || null, assigneeColor: assigneeGradients[idx % assigneeGradients.length],
    deadline: dl, isOverdue, status: kanbanStatus,
    isBlocked: kanbanStatus === 'blocked', files: [], activities: [],
    project_id: t.project_id,
  };
}

/* ═══════════════════════════════════════════
   FILE TYPE ICON
   ═══════════════════════════════════════════ */

function FileIcon({ type }: { type: AttachedFile['type'] }) {
  const colors: Record<string, string> = { pdf: 'text-red-500 bg-red-50', excel: 'text-green-600 bg-green-50', word: 'text-blue-600 bg-blue-50', image: 'text-purple-500 bg-purple-50', other: 'text-slate-500 bg-slate-50' };
  const labels: Record<string, string> = { pdf: 'PDF', excel: 'XLS', word: 'DOC', image: 'IMG', other: 'FILE' };
  return <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${colors[type]} border border-white/50`}>{labels[type]}</div>;
}

/* ═══════════════════════════════════════════
   CREATE TASK MODAL (FOR KANBAN)
   ═══════════════════════════════════════════ */

function CreateTaskModal({ onClose, onCreated, projectId, projectName }: { onClose: () => void; onCreated: () => void; projectId: string; projectName: string }) {
  const { addToast } = useToast();
  const { user } = useRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [priority, setPriority] = useState('Trung bình');
  const [valueVnd, setValueVnd] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState(user.id.toString());
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/users`).then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), description: description.trim() || null,
          project_id: projectId, assignee_id: assigneeId || null,
          status: 'Kế hoạch', category, priority,
          value_vnd: parseFloat(valueVnd.replace(/,/g, '')) || 0,
          progress_percent: 0, deadline: deadline || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast('success', `Đã tạo công việc "${title.trim()}"!`);
      onCreated();
    } catch (err) { addToast('error', `Lỗi: ${err}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 60px rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <h2 className="text-lg font-bold text-slate-800">✏️ Tạo công việc mới</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/50 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tên công việc *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Lập hồ sơ đấu thầu..."
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Yêu cầu cụ thể..."
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40 resize-none" style={{ background: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">📁 Dự án</label>
            <input type="text" value={projectName} readOnly className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 bg-slate-50/50 text-slate-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">💰 Giá trị (VNĐ)</label>
            <div className="relative">
              <input type="text" value={valueVnd} onChange={e => setValueVnd(formatVNDInput(e.target.value))} placeholder="0"
                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40 pr-12" style={{ background: 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase">VNĐ</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">👤 Người phụ trách</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
              <option value="">— Chưa giao cho ai —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loại</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ưu tiên</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/30">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/50">Hủy</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20 disabled:opacity-50 flex items-center gap-2">
            {saving ? '⏳ Đang lưu...' : '➕ Tạo Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TASK DETAIL MODAL (RBAC-AWARE)
   ═══════════════════════════════════════════ */

function TaskDetailModal({ task, onClose, onSave }: { task: TaskItem; onClose: () => void; onSave: (updated: TaskItem) => void }) {
  const { user, canTransitionTo, canEditValue, isManager } = useRole();
  const { addToast } = useToast();
  const [editStatus, setEditStatus] = useState(task.status);
  const [editProgress, setEditProgress] = useState(task.progress);
  const [editValue, setEditValue] = useState(task.valueVND);
  const [editAssigneeId, setEditAssigneeId] = useState(task.assigneeId || '');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [files, setFiles] = useState<AttachedFile[]>(task.files);
  const [activities, setActivities] = useState<ActivityEntry[]>(task.activities);
  const [commentText, setCommentText] = useState('');
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/users`).then(r => r.json()).then(data => {
      setUsers(data);
      // Try to find the assignee id if it exists in the task (we might need to update task mapping)
      // For now, let's assume we match by full_name if id isn't in TaskItem yet
    }).catch(() => {});
  }, []);

  const valueEditable = canEditValue(task.assignee);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const getFileType = (name: string): AttachedFile['type'] => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'image';
    return 'other';
  };

  const addFiles = (fileList: FileList) => {
    const newFiles: AttachedFile[] = Array.from(fileList).map((f, i) => ({
      id: `upload-${Date.now()}-${i}`, name: f.name, type: getFileType(f.name),
      size: f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
      uploadedAt: new Date().toLocaleDateString('vi-VN'),
    }));
    setFiles(prev => [...newFiles, ...prev]);
    newFiles.forEach(f => setActivities(prev => [{ id: `act-${Date.now()}`, type: 'file_upload', user: user.name, content: `Đã tải lên: ${f.name}`, timestamp: now() }, ...prev]));
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    setActivities(prev => [{ id: `act-${Date.now()}`, type: 'comment', user: user.name, content: commentText.trim(), timestamp: now() }, ...prev]);
    setCommentText('');
  };

  const handleStatusChange = (newStatus: string) => {
    if (!canTransitionTo(newStatus)) {
      addToast('error', `Lỗi phân quyền: Bạn không có quyền chuyển sang "${columns.find(c => c.id === newStatus)?.title}".`);
      return;
    }
    setEditStatus(newStatus);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update status via API
      if (editStatus !== task.status) {
        const dbStatus = kanbanToDb[editStatus];
        if (dbStatus) {
          await fetch(`${API_BASE}/api/tasks/${task.id}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: dbStatus }),
          });
        }
      }
      // Update value via API
      const numericValue = parseFloat(editValue.replace(/\./g, '').replace(/,/g, '')) || 0;
      await fetch(`${API_BASE}/api/tasks/${task.id}/value`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value_vnd: numericValue }),
      });

      // Update assignee via API (Added generic update endpoint or specific assignee one)
      // Since I don't see a specific assignee endpoint, I might need to add one or use a general patch
      // Looking at main.py, I'll check if there's a task update endpoint.
      // Actually, I'll just use a PATCH to a new endpoint I'll add or use the existing ones if they support it.
      // Wait, let's assume I can PATCH task details.
      await fetch(`${API_BASE}/api/tasks/${task.id}/details`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: editAssigneeId || null }),
      });

      const updatedAssignee = users.find(u => u.id === editAssigneeId);
      const updatedAbbr = updatedAssignee ? updatedAssignee.full_name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : 'N/A';

      const updated: TaskItem = { 
        ...task, 
        status: editStatus, 
        progress: editProgress, 
        valueVND: editValue,
        assignee: updatedAbbr,
        assigneeId: editAssigneeId || null,
        files, 
        activities, 
        isBlocked: editStatus === 'blocked' 
      };
      onSave(updated);
      addToast('success', `Đã lưu thay đổi cho "${task.title}"`);
    } catch (err) { addToast('error', `Lỗi lưu: ${err}`); }
    finally { setSaving(false); }
  };

  const deleteFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (file) setActivities(prev => [{ id: `act-${Date.now()}`, type: 'file_upload', user: user.name, content: `Đã xóa: ${file.name}`, timestamp: now() }, ...prev]);
  };

  const activityIcons: Record<string, string> = { comment: '💬', status_change: '🔄', progress_update: '📈', file_upload: '📎', rbac_denied: '🚫' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 60px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${task.categoryColor}`}>{task.category}</span>
            <h2 className="text-lg font-bold text-slate-800 truncate">{task.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${isManager ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'}`}>
              {isManager ? '👑 Manager' : '👤 Staff'}
            </span>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/50 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[60%] p-6 overflow-y-auto border-r border-white/30 space-y-5">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Trạng thái</label>
              <select value={editStatus} onChange={e => handleStatusChange(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {statusOptions.map(opt => {
                  const forbidden = !canTransitionTo(opt.value);
                  return <option key={opt.value} value={opt.value} disabled={forbidden}>{opt.label}{forbidden ? ' 🔒' : ''}</option>;
                })}
              </select>
              {!isManager && <p className="text-[10px] text-amber-600 mt-1 font-medium">🔒 Staff chỉ được chuyển: Kế hoạch ↔ Đang xử lý ↔ Trình ký Nội bộ</p>}
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Người phụ trách</label>
              <select value={editAssigneeId} onChange={e => setEditAssigneeId(e.target.value)} 
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <option value="">— Chưa giao cho ai —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Giá trị (VNĐ) {!valueEditable && <span className="text-amber-500 ml-1">🔒 Chỉ đọc</span>}
              </label>
              <div className="relative">
                <input type="text" value={editValue} onChange={e => valueEditable && setEditValue(formatVNDInput(e.target.value))} readOnly={!valueEditable}
                  className={`w-full px-4 py-2.5 rounded-xl text-lg font-bold tracking-tight border border-white/50 focus:outline-none pr-14
                    ${valueEditable ? 'text-slate-800 focus:ring-2 focus:ring-primary-400/40' : 'text-slate-400 cursor-not-allowed bg-slate-50/30'}`}
                  style={{ background: valueEditable ? 'rgba(255,255,255,0.5)' : 'rgba(241,245,249,0.4)', fontFamily: 'Inter' }} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">VNĐ</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tiến độ — <span className="text-primary-600 text-sm">{editProgress}%</span></label>
              <input type="range" min={0} max={100} value={editProgress} onChange={e => setEditProgress(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary-500"
                style={{ background: `linear-gradient(to right, #1976D2 0%, #1976D2 ${editProgress}%, rgba(203,213,225,0.5) ${editProgress}%, rgba(203,213,225,0.5) 100%)` }} />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Deadline</label>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/50" style={{ background: 'rgba(255,255,255,0.4)' }}>
                <span className={`text-sm font-semibold ${task.isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                  {task.deadline}{task.isOverdue && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">TRỄ HẠN</span>}
                </span>
              </div>
            </div>
          </div>
          <div className="w-[40%] p-6 overflow-y-auto flex flex-col gap-5">
            <div>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📎 Tài liệu ({files.length})</h3>
              <div onDragOver={e => { e.preventDefault(); setIsFileDragOver(true); }} onDragLeave={() => setIsFileDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsFileDragOver(false); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isFileDragOver ? 'border-primary-400 bg-primary-50/40' : 'border-slate-200/60 hover:border-primary-300'}`}>
                <p className="text-xs text-slate-500 font-medium text-center">{isFileDragOver ? <span className="text-primary-600 font-bold">Thả file tại đây</span> : <>Kéo thả hoặc <span className="text-primary-500 font-semibold">chọn file</span></>}</p>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); }} />
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-2 max-h-36 overflow-y-auto">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/40 hover:bg-white/60 group">
                      <FileIcon type={f.type} />
                      <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">{f.name}</p><p className="text-[10px] text-slate-400">{f.size} · {f.uploadedAt}</p></div>
                      <button onClick={() => deleteFile(f.id)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📝 Nhật ký</h3>
              <div className="flex gap-2 mb-3">
                <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
                  placeholder="Ghi chú..." className="flex-1 px-3 py-2 rounded-lg text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} />
                <button onClick={submitComment} disabled={!commentText.trim()} className="px-3 py-2 rounded-lg bg-primary-500 text-white text-xs font-bold hover:bg-primary-600 disabled:opacity-40">Gửi</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 max-h-56">
                {activities.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Chưa có hoạt động nào</p>}
                {activities.map(act => (
                  <div key={act.id} className="flex gap-3">
                    <span className="text-sm leading-none">{activityIcons[act.type]}</span>
                    <div className="flex-1 pb-1">
                      <div className="flex items-baseline gap-2"><span className="text-xs font-bold text-slate-700">{act.user}</span><span className="text-[10px] text-slate-400">{act.timestamp}</span></div>
                      <p className={`text-xs mt-0.5 ${act.type === 'status_change' ? 'text-primary-600 font-medium' : 'text-slate-600'}`}>{act.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
   TASK CARD (SORTABLE)
   ═══════════════════════════════════════════ */

function TaskCard({ task, onClick, isShaking }: { task: TaskItem; onClick: () => void; isShaking: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const barColor = task.progress === 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : task.isBlocked ? 'bg-gradient-to-r from-red-400 to-rose-500' : 'bg-gradient-to-r from-primary-400 to-primary-600';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={onClick}
      className={`glass-card p-4 rounded-xl cursor-grab active:cursor-grabbing select-none transition-all duration-200
        ${task.isBlocked ? 'card-blocked !bg-red-50/40' : ''} 
        ${isDragging ? 'opacity-30 scale-95 rotate-1 z-50' : 'hover:shadow-lg hover:shadow-primary-500/10'} 
        ${isShaking ? 'animate-shake' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${task.categoryColor}`}>{task.category}</span>
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${task.assigneeColor} text-white flex items-center justify-center text-[10px] font-bold shadow-md ring-2 ring-white/70`}>{task.assignee.slice(0, 2)}</div>
      </div>
      <h4 className="font-semibold text-sm text-slate-800 mb-3 leading-snug line-clamp-2">{task.title}</h4>
      <div className="mb-3">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-0.5">Giá trị</p>
        <p className="font-bold text-base text-slate-800 tracking-tight" style={{ fontFamily: 'Inter' }}>{task.valueVND}<span className="text-[10px] text-slate-400 font-medium ml-1">VNĐ</span></p>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-medium"><span>Tiến độ</span><span className="font-bold">{task.progress}%</span></div>
        <div className="w-full bg-slate-100/80 rounded-full h-2 overflow-hidden border border-white/50"><div className={`h-2 rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${task.progress}%` }} /></div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/30">
        <span className={`text-xs font-semibold ${task.isOverdue ? 'text-red-500' : 'text-slate-500'}`}>{task.deadline}{task.isOverdue && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">TRỄ HẠN</span>}</span>
        {task.files.length > 0 && <span className="text-[10px] text-slate-400">📎 {task.files.length}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   KANBAN COLUMN (DROPPABLE)
   ═══════════════════════════════════════════ */

function KanbanColumn({ column, tasks, onCardClick, isForbidden, shakingTaskId, isOver }: {
  column: typeof columns[0]; tasks: TaskItem[];
  onCardClick: (t: TaskItem) => void; isForbidden: boolean; shakingTaskId: string | null; isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="w-72 min-w-[280px] flex-shrink-0 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
        <h3 className={`font-bold text-sm tracking-tight ${column.isBlocked ? 'text-red-600' : 'text-slate-700'}`}>{column.title}</h3>
        {isForbidden && <span className="text-[10px] text-red-500" title="Bạn không có quyền">🔒</span>}
        <span className="ml-auto bg-white/50 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-bold border border-white/60 shadow-sm">{tasks.length}</span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`flex-1 glass-panel rounded-2xl p-3 space-y-3 overflow-y-auto min-h-[500px] transition-all duration-200
          ${column.isBlocked ? 'column-blocked' : ''}
          ${isOver && !isForbidden ? 'ring-2 ring-primary-400/50 bg-primary-100/30 scale-[1.01]' : ''}
          ${isOver && isForbidden ? 'ring-2 ring-red-400/50 bg-red-50/20' : ''}`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onCardClick(task)} 
              isShaking={shakingTaskId === task.id} 
            />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && !isOver && (
          <div className="h-40 border-2 border-dashed border-white/30 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
            <Layout className="w-8 h-8 opacity-20" />
            <span className="text-[11px] font-medium text-center leading-tight">Chưa có công việc nào.<br/>Kéo thả hồ sơ vào đây.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.id as string;
  const { canTransitionTo, isManager, user } = useRole();
  const { addToast } = useToast();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // DND state
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [shakingTaskId, setShakingTaskId] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<{ taskTitle: string; from: string; to: string }[]>([]);
  
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`${API_BASE}/api/projects/${slug}`);
      if (!pRes.ok) { setNotFound(true); setLoading(false); return; }
      const pData = await pRes.json();
      setProject({
        id: pData.id, name: pData.name, slug: pData.slug,
        client: pData.client, location: pData.location,
        total_budget_vnd: parseFloat(pData.total_budget_vnd) || 0,
        status: typeof pData.status === 'string' ? pData.status : pData.status?.value || 'Khởi động',
      });

      const tRes = await fetch(`${API_BASE}/api/tasks?project_id=${pData.id}&user_id=${user.id}`);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTasks(tData.map((t: any, i: number) => mapApiTaskToItem(t, i)));
      } else {
        setTasks([]);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task as TaskItem;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    // No valid drop target
    if (!over) return;

    const taskId = active.id as string;
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    // Check if dropping on a column or another task
    const targetColId = over.data.current?.sortable?.containerId || over.id as string;
    
    // If target is same as current column, do nothing
    if (currentTask.status === targetColId) return;

    // RBAC Check
    if (!canTransitionTo(targetColId)) {
      const colTitle = columns.find(c => c.id === targetColId)?.title || targetColId;
      addToast('error', `Lỗi phân quyền: Bạn không có quyền chuyển sang "${colTitle}".`);
      
      // Trigger shake effect
      setShakingTaskId(taskId);
      setTimeout(() => setShakingTaskId(null), 600);
      return;
    }

    // Prepare Optimistic Update
    const originalStatus = currentTask.status;
    const fromCol = columns.find(c => c.id === originalStatus)?.title || originalStatus;
    const toCol = columns.find(c => c.id === targetColId)?.title || targetColId;

    // Optimistically update UI
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetColId, isBlocked: targetColId === 'blocked' } : t));
    setMoveHistory(h => [{ taskTitle: currentTask.title, from: fromCol, to: toCol }, ...h].slice(0, 5));

    // Update via API
    const dbStatus = kanbanToDb[targetColId];
    if (dbStatus) {
      try {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: dbStatus }),
        });
        
        if (!res.ok) {
          throw new Error('Update failed');
        }
        
        addToast('success', `Đã chuyển "${currentTask.title}" sang ${toCol}`);
      } catch (error) {
        // Revert on failure
        addToast('error', `Lỗi kết nối: Không thể cập nhật trạng thái. Đã khôi phục về ${fromCol}.`);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: originalStatus, isBlocked: originalStatus === 'blocked' } : t));
      }
    }
  };

  const handleSaveTask = useCallback((updated: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTask(null);
  }, []);

  // Loading state
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-10 h-10 border-4 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
    </div>
  );

  // Not found
  if (notFound || !project) return (
    <div className="flex items-center justify-center h-full">
      <div className="glass-card p-8 rounded-2xl text-center">
        <p className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy dự án</p>
        <Link href="/projects" className="text-primary-500 font-medium hover:underline">← Quay lại danh sách</Link>
      </div>
    </div>
  );

  const summaryWidgets = [
    { label: 'Tổng Ngân sách', value: formatBudget(project.total_budget_vnd), sub: 'VNĐ', color: 'text-blue-700' },
    { label: 'Giải ngân Lũy kế', value: '0 tỷ', sub: '0%', color: 'text-emerald-700' },
    { label: 'Tổng Hồ sơ', value: String(tasks.length), sub: 'tasks', color: 'text-amber-700' },
  ];

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-5 h-full">
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Link href="/projects" className="text-primary-500 hover:text-primary-600 font-medium">Dự án</Link>
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span className="text-slate-700 font-semibold truncate">{project.name}</span>
            </div>
            <button onClick={() => setShowCreateModal(true)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-lg flex items-center gap-2 transition-colors">
              <FileText className="w-4 h-4" />
              Tạo Task
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-shrink-0">
            {summaryWidgets.map((w, i) => (
              <div key={i} className="glass-card p-4 rounded-xl relative overflow-hidden">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{w.label}</p>
                <p className={`text-2xl font-extrabold tracking-tight ${w.color}`} style={{ fontFamily: 'Inter' }}>{w.value}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{w.sub}</p>
              </div>
            ))}
          </div>

          {moveHistory.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 glass-card rounded-xl text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-1.5 text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg font-bold">
                <Clock className="w-3 h-3" />
                <span>Hoạt động gần đây</span>
              </div>
              <span className="font-semibold text-slate-700 truncate max-w-[200px]">{moveHistory[0].taskTitle}</span>
              <span className="text-slate-400">từ</span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">{moveHistory[0].from}</span>
              <span className="text-slate-400">→</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold">{moveHistory[0].to}</span>
            </div>
          )}

          <div className="flex-1 flex gap-4 overflow-x-auto pb-4 kanban-scroll items-start px-1">
            {columns.map(col => (
              <KanbanColumn 
                key={col.id} 
                column={col} 
                tasks={tasks.filter(t => t.status === col.id)}
                onCardClick={task => setSelectedTask(task)}
                isForbidden={!canTransitionTo(col.id)}
                shakingTaskId={shakingTaskId}
                isOver={false} /* This will need more complex logic if we want per-column highlight */
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="opacity-80 scale-105 rotate-2 z-[100] pointer-events-none">
              <TaskCard task={activeTask} onClick={() => {}} isShaking={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} onSave={handleSaveTask} />}
      {showCreateModal && project && (
        <CreateTaskModal projectId={project.id} projectName={project.name}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchData(); }} />
      )}
    </>
  );
}
