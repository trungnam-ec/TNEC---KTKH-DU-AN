'use client';

import Link from 'next/link';
import React, { useState, useEffect, useCallback } from 'react';
import { useRole, useToast } from '../providers';



const statusOptions = ['Khởi động', 'Đang thi công', 'Nghiệm thu', 'Hoàn thành'];
const statusColor: Record<string, string> = {
  'Khởi động': 'text-slate-600 bg-slate-100 border-slate-200',
  'Đang thi công': 'text-blue-600 bg-blue-100 border-blue-200',
  'Nghiệm thu': 'text-amber-600 bg-amber-100 border-amber-200',
  'Hoàn thành': 'text-green-600 bg-green-100 border-green-200',
};

interface ProjectData {
  id: string; name: string; slug: string;
  client: string | null; location: string | null;
  total_budget_vnd: number; status: string;
  task_count: number; created_at: string | null;
}

/* ═══════════════════════════════════════════
   CREATE PROJECT MODAL
   ═══════════════════════════════════════════ */

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState(statusOptions[0]);
  const [saving, setSaving] = useState(false);

  const formatBudget = (val: string) => {
    const num = val.replace(/[^\d]/g, '');
    return num ? parseInt(num).toLocaleString('vi-VN') : '';
  };

  const handleBudgetChange = (val: string) => {
    setBudget(formatBudget(val));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const budgetNum = parseFloat(budget.replace(/\./g, '').replace(/,/g, '')) || 0;
      const res = await fetch('/api/supabase/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          client: client.trim() || null,
          location: location.trim() || null,
          total_budget_vnd: budgetNum,
          status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      addToast('success', `Đã tạo dự án "${name.trim()}" thành công!`);
      onCreated();
    } catch (err: any) {
      addToast('error', `Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 8px 60px rgba(0, 0, 0, 0.12)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
          <h2 className="text-lg font-bold text-slate-800">🏗️ Tạo dự án mới</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/50 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tên dự án *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Nhà máy Điện gió Ea Nam"
              className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">🏢 Chủ đầu tư</label>
              <input type="text" value={client} onChange={e => setClient(e.target.value)} placeholder="VD: Trungnam Group"
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">📍 Địa điểm</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="VD: Đắk Lắk"
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">💰 Tổng ngân sách (VNĐ)</label>
              <input type="text" value={budget} onChange={e => handleBudgetChange(e.target.value)} placeholder="VD: 2,500,000,000,000"
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Trạng thái</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/50 focus:outline-none focus:ring-2 focus:ring-primary-400/40" style={{ background: 'rgba(255,255,255,0.5)' }}>
                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/30">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white/50 transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? '⏳ Đang lưu...' : '🏗️ Tạo dự án'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FORMAT HELPERS
   ═══════════════════════════════════════════ */

function formatBudgetDisplay(vnd: number): string {
  if (vnd >= 1e12) return `${(vnd / 1e12).toFixed(vnd % 1e12 === 0 ? 0 : 1).replace('.', ',')} nghìn tỷ`;
  if (vnd >= 1e9) return `${(vnd / 1e9).toFixed(vnd % 1e9 === 0 ? 0 : 1).replace('.', ',')} tỷ`;
  if (vnd >= 1e6) return `${(vnd / 1e6).toFixed(0)} triệu`;
  return vnd.toLocaleString('vi-VN');
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function Projects() {
  const { isManager } = useRole();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/supabase/projects');
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Lỗi HTTP ${res.status}: Không thể tạo dự án`);
      }
      setProjects(await res.json());
    } catch (err) {
      addToast('error', `Lỗi tải dự án: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br from-primary-500/10 to-cyan-500/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-heading text-slate-800 mb-1">Danh sách Dự án</h2>
          <p className="text-sm text-slate-400 font-medium">
            {loading ? 'Đang tải...' : `${projects.length} dự án trong hệ thống`}
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowCreateModal(true)}
            className="relative z-10 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors shadow-lg flex items-center gap-2 text-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tạo dự án mới
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <div className="glass-card p-16 rounded-2xl text-center">
          <p className="text-5xl mb-4">🏗️</p>
          <p className="text-lg font-bold text-slate-700 mb-2">Chưa có dự án nào</p>
          <p className="text-sm text-slate-400">Bấm "Tạo dự án mới" để bắt đầu.</p>
        </div>
      )}

      {/* Project Cards Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {projects.map(p => (
            <Link href={`/projects/${p.slug}`} key={p.id} className="block group">
              <div className="glass-card p-6 rounded-2xl relative overflow-hidden cursor-pointer h-full">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-primary-500/5 to-teal-500/5 rounded-full blur-2xl group-hover:from-primary-500/15 group-hover:to-teal-500/15 transition-colors" />

                {/* Top Row: Name + Status */}
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="flex-1 mr-3">
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary-600 transition-colors leading-tight mb-1">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                      {p.client && <span>🏢 {p.client}</span>}
                      {p.location && <span>📍 {p.location}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusColor[p.status] || 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                    {p.status}
                  </span>
                </div>

                {/* Budget */}
                <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Tổng Ngân sách</p>
                    <p className="text-xl font-extrabold text-slate-800 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {formatBudgetDisplay(p.total_budget_vnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Công việc</p>
                    <p className="text-xl font-extrabold text-primary-600 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {p.task_count} <span className="text-xs text-slate-400 font-medium">tasks</span>
                    </p>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchProjects(); }}
        />
      )}
    </div>
  );
}
