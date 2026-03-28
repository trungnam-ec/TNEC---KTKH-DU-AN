'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRole, useToast } from '../providers';
import { supabase } from '@/lib/supabase';

/** Build query param based on role to let backend resolve the user */
function userQuery(role: string) {
  return role === 'Staff' ? 'role=Staff' : '';
}

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

interface UserProfile {
  id: string; email: string; full_name: string; role: string;
  department: string | null; bio: string | null; is_active: boolean; created_at: string;
}

/* ═══════════════════════════════════════════
   CREATE USER MODAL
   ═══════════════════════════════════════════ */

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Staff');
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (val: string) => {
    if (!val) { setEmailError(''); return; }
    const allowed = ['@gmail.com', '@trungnamec.com.vn', '@trungnamgroup.com.vn'];
    const valid = allowed.some(domain => val.endsWith(domain));
    setEmailError(valid ? '' : 'Email phải có đuôi @gmail.com hoặc domain công ty (@trungnamec.com.vn / @trungnamgroup.com.vn)');
  };

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim() || emailError) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('users').insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        department: 'KTKH',
        is_active: true,
      });
      if (error) throw new Error(error.message);
      addToast('success', `Đã tạo nhân viên "${fullName.trim()}" thành công!`);
      onCreated();
    } catch (err: any) {
      addToast('error', `Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)', boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">👤 Tạo nhân viên mới</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Họ và Tên *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Thị Hương"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-slate-600" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email *</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); validateEmail(e.target.value); }}
              placeholder="nhanvien@gmail.com"
              className={`w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 transition-colors placeholder-slate-600 ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'}`} />
            {emailError && <p className="text-red-400 text-xs mt-1.5 font-medium">{emailError}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phân quyền</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
              <option value="Staff">👤 Staff (Nhân viên)</option>
              <option value="Manager">👑 Manager (Quản lý)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={!fullName.trim() || !email.trim() || !!emailError || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {saving ? '⏳ Đang lưu...' : '➕ Tạo nhân viên'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   USERS TAB CONTENT (Manager Only)
   ═══════════════════════════════════════════ */

function UsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      setUsers(data || []);
    } catch (err) {
      addToast('error', `Lỗi tải danh sách: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleActive = async (userId: string) => {
    try {
      const current = users.find(u => u.id === userId);
      if (!current) return;
      const { error } = await supabase
        .from('users')
        .update({ is_active: !current.is_active })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      addToast('success', 'Đã cập nhật trạng thái nhân viên!');
      fetchUsers();
    } catch (err: any) {
      addToast('error', `Lỗi: ${err.message}`);
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!window.confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA NHÂN VIÊN NÀY?\n\n- Nhân viên: ${user.full_name}\n- Tất cả công việc của người này sẽ mất liên kết assignee.\n\nHành động này không thể hoàn tác!`)) {
      return;
    }
    try {
      // Unassign tasks first to avoid FK constraint
      await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', user.id);
      const { error } = await supabase.from('users').delete().eq('id', user.id);
      if (error) throw new Error(error.message);
      addToast('success', `Đã xóa nhân viên ${user.full_name} thành công!`);
      fetchUsers();
    } catch (err: any) {
      addToast('error', `Lỗi khi xóa: ${err.message}`);
    }
  };

  const roleBadge = (role: string) => role === 'Manager'
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : 'bg-slate-500/20 text-slate-300 border-slate-500/30';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Danh sách Nhân sự</h3>
          <p className="text-sm text-slate-400 mt-0.5">{users.length} nhân viên trong hệ thống</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          Tạo nhân viên mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Nhân viên</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2 text-center">Phân quyền</div>
            <div className="col-span-1 text-center">Trạng thái</div>
            <div className="col-span-2 text-center">Thao tác</div>
          </div>

          {/* Table Body */}
          {users.map(u => (
            <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <div className="col-span-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-slate-700 ${u.role === 'Manager' ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white' : 'bg-gradient-to-br from-slate-600 to-slate-800 text-slate-200'}`}>
                  {u.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{u.full_name}</p>
                  <p className="text-[11px] text-slate-500">{u.department || 'KTKH'}</p>
                </div>
              </div>
              <div className="col-span-3 text-xs text-slate-400 truncate">{u.email}</div>
              <div className="col-span-2 flex justify-center">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${roleBadge(u.role)}`}>
                  {u.role === 'Manager' ? '👑 Manager' : '👤 Staff'}
                </span>
              </div>
              <div className="col-span-1 flex justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${u.is_active ? 'bg-green-500 shadow-green-500/50 shadow-sm' : 'bg-red-500 shadow-red-500/50 shadow-sm'}`}
                  title={u.is_active ? 'Active' : 'Inactive'} />
              </div>
              <div className="col-span-2 flex justify-center gap-2">
                <button onClick={() => toggleActive(u.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${u.is_active ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'}`}>
                  {u.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                </button>
                <button onClick={() => deleteUser(u)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20">
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchUsers(); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN SETTINGS PAGE
   ═══════════════════════════════════════════ */

export default function Settings() {
  const { user, isManager, isStaff } = useRole();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editBio, setEditBio] = useState('');

  // Fetch current user's profile
  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();
      if (error) throw new Error(error.message);
      setProfile(data);
      setEditName(data.full_name);
      setEditDept(data.department || 'KTKH');
      setEditBio(data.bio || '');
    } catch (err) {
      addToast('error', `Không thể tải profile: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [user.email, addToast]);

  useEffect(() => {
    if (!isStaff) fetchProfile();
  }, [fetchProfile, isStaff]);

  if (isStaff) {
    return (
      <div className="flex flex-col h-full bg-slate-950 rounded-3xl overflow-hidden relative border border-slate-800 shadow-2xl items-center justify-center p-8">
        <svg className="w-20 h-20 mb-6 opacity-30 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Truy cập bị từ chối</h2>
        <p className="font-medium text-slate-400">Tài khoản Staff không có quyền truy cập trang Cài đặt.</p>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editName.trim() || profile?.full_name,
          department: editDept.trim(),
          bio: editBio.trim() || null,
        })
        .eq('email', user.email);
      if (error) throw new Error(error.message);
      addToast('success', 'Cập nhật thông tin thành công!');
      fetchProfile();
    } catch (err: any) {
      addToast('error', `Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'PROFILE', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'notifications', label: 'NOTIFICATIONS', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    { id: 'security', label: 'SECURITY', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" /></svg> },
    // Users tab — Manager only
    ...(isManager ? [{
      id: 'users', label: 'USERS',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    }] : []),
  ];

  const initials = profile ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '...';

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-3xl overflow-hidden relative border border-slate-800 shadow-2xl">
      {/* Dark Ambient Lights */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

      {/* Header + Tabs */}
      <div className="p-8 pb-4 relative z-10 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Settings</h2>
        <p className="text-slate-400 font-medium">Cấu hình hồ sơ cá nhân và quản trị hệ thống.</p>

        <div className="flex mt-8 space-x-8">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`font-bold pb-3 flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 relative z-10">
        {activeTab === 'profile' && (
          <div className="max-w-3xl">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              </div>
            ) : profile ? (
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-xl">
                {/* Avatar Section */}
                <div className="flex items-center gap-6 mb-10 pb-10 border-b border-slate-800">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-4 border-slate-700 flex items-center justify-center text-3xl font-bold text-white overflow-hidden shadow-lg shadow-blue-500/20">
                      {initials}
                    </div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-2 border-slate-900 rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{profile.full_name}</h3>
                    <p className="text-blue-400 font-medium text-sm">{profile.role === 'Manager' ? '👑 Manager' : '👤 Staff'} · Phòng {profile.department || 'KTKH'}</p>
                    <p className="text-slate-500 text-xs mt-1">ID: {profile.id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Họ và Tên</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Email Address
                      <span className="ml-2 text-amber-500 text-[10px] normal-case">🔒 SSO — Chỉ đọc</span>
                    </label>
                    <input type="email" value={profile.email} readOnly
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-500 focus:outline-none cursor-not-allowed opacity-60" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phòng ban</label>
                    <input type="text" value={editDept} onChange={e => setEditDept(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Phân quyền
                      <span className="ml-2 text-amber-500 text-[10px] normal-case">🔒 Chỉ đọc</span>
                    </label>
                    <input type="text" value={profile.role === 'Manager' ? '👑 Manager (Quản lý)' : '👤 Staff (Nhân viên)'} readOnly
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-500 focus:outline-none cursor-not-allowed opacity-60" />
                  </div>

                  <div className="col-span-2 mt-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Giới thiệu bản thân (Bio)</label>
                    <textarea rows={4} value={editBio} onChange={e => setEditBio(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none placeholder-slate-600"
                      placeholder="VD: KS. Dự toán 5 năm kinh nghiệm, chuyên công trình năng lượng tái tạo..." />
                  </div>
                </div>

                {/* Save / Cancel */}
                <div className="mt-10 flex justify-end gap-4">
                  <button onClick={fetchProfile} className="px-6 py-3 bg-transparent hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition-colors">Đặt lại</button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2">
                    {saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-16">Không tìm thấy thông tin người dùng.</p>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-3xl">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2">🔔 Thông báo</h3>
              <p className="text-slate-400 text-sm">Tính năng cấu hình thông báo sẽ được bổ sung trong phiên bản tiếp theo.</p>
              <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-300 text-sm font-medium">💡 Dự kiến: Email thông báo khi có hồ sơ trễ hạn, comment mới, hoặc trạng thái thay đổi.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-3xl">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2">🔒 Bảo mật</h3>
              <p className="text-slate-400 text-sm mb-6">Đăng nhập qua Google SSO domain công ty — không cần quản lý mật khẩu.</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔐</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Google SSO</p>
                      <p className="text-xs text-slate-400">Đăng nhập bằng tài khoản @gmail.com hoặc công ty</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">Đã kích hoạt</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Two-Factor (2FA)</p>
                      <p className="text-xs text-slate-400">Bảo vệ thêm bằng Google Authenticator</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-600/30 text-slate-400 text-xs font-bold border border-slate-600/30">Chưa thiết lập</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && isManager && (
          <div className="max-w-5xl">
            <UsersTab />
          </div>
        )}
      </div>
    </div>
  );
}
