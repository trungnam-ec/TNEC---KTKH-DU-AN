'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from './providers';

const API_BASE = 'http://localhost:8000';

/* ═══════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════ */

interface KPI {
  total_budget: string; total_budget_raw: number;
  total_task_value: string; total_task_value_raw: number;
  disbursed: string; disbursed_raw: number; disbursed_pct: number;
  project_count: number; active_tasks: number; total_tasks: number; overdue_count: number;
}

interface StatusItem { label: string; count: number; pct: number; }
interface OverdueAlert { task_id: string; task: string; project: string; days_late: number; assignee: string; priority: string; }
interface LeaderboardEntry { name: string; role: string; total_tasks: number; completed: number; in_progress: number; on_time_pct: number; initials: string; }

interface DashboardData {
  kpi: KPI;
  status_distribution: StatusItem[];
  overdue_alerts: OverdueAlert[];
  leaderboard: LeaderboardEntry[];
}

/* ═══════════════════════════════════════════
   PRIORITY COLORS
   ═══════════════════════════════════════════ */
const priorityBadge: Record<string, string> = {
  'Khẩn cấp': 'bg-red-100 text-red-700',
  'Cao': 'bg-orange-100 text-orange-700',
  'Trung bình': 'bg-blue-100 text-blue-600',
  'Thấp': 'bg-slate-100 text-slate-500',
};

/* ═══════════════════════════════════════════
   MINI BAR CHART COMPONENT (CSS-only)
   — keeps cashflow static since DB has no monthly data yet
   ═══════════════════════════════════════════ */

function MiniBarChart({ totalValue, disbursed }: { totalValue: number; disbursed: number }) {
  const remaining = totalValue - disbursed;
  const months = [
    { month: 'Đã giải ngân', value: disbursed, color: 'bg-primary-500/80 border-primary-600/40' },
    { month: 'Còn lại', value: remaining, color: 'bg-primary-200/60 border-primary-300/40' },
  ];
  const maxVal = Math.max(disbursed, remaining, 1);

  return (
    <div className="flex items-end gap-6 h-44 px-4">
      {months.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full h-36 flex items-end justify-center">
            <div className={`w-full rounded-t-lg border transition-all duration-700 ${d.color}`}
              style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: '8px' }} />
          </div>
          <span className="text-[10px] font-bold text-slate-500 text-center">{d.month}</span>
          <span className="text-xs font-bold text-slate-700" style={{ fontFamily: 'Inter' }}>
            {d.value >= 1e9 ? `${(d.value / 1e9).toFixed(1)} tỷ` : d.value >= 1e6 ? `${(d.value / 1e6).toFixed(0)} tr` : d.value.toLocaleString('vi-VN')}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DONUT CHART COMPONENT (CSS-only)
   ═══════════════════════════════════════════ */

const statusColorMap: Record<string, string> = {
  'Hoàn thành': '#22c55e',
  'Đang xử lý': '#3b82f6',
  'Trình ký Nội bộ': '#a855f7',
  'Trình CĐT': '#14b8a6',
  'Kế hoạch': '#94a3b8',
  'Vướng mắc': '#ef4444',
};

const statusDotColor: Record<string, string> = {
  'Hoàn thành': 'bg-green-500',
  'Đang xử lý': 'bg-blue-500',
  'Trình ký Nội bộ': 'bg-purple-500',
  'Trình CĐT': 'bg-teal-500',
  'Kế hoạch': 'bg-slate-400',
  'Vướng mắc': 'bg-red-500',
};

function DonutChart({ data, total }: { data: StatusItem[]; total: number }) {
  let cumulative = 0;
  const segments = data.map(d => {
    const start = cumulative;
    cumulative += d.pct;
    return { ...d, start, end: cumulative };
  });

  const gradientStops = segments.map(s =>
    `${statusColorMap[s.label] || '#ccc'} ${s.start}% ${s.end}%`
  );

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-36 h-36 flex-shrink-0">
        <div className="w-full h-full rounded-full"
          style={{ background: total > 0 ? `conic-gradient(${gradientStops.join(', ')})` : '#e2e8f0' }} />
        <div className="absolute inset-4 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col">
          <span className="text-2xl font-extrabold text-slate-800">{total}</span>
          <span className="text-[10px] text-slate-500 font-medium">Tasks</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.filter(d => d.count > 0).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDotColor[d.label] || 'bg-slate-300'}`} />
            <span className="text-xs text-slate-600 font-medium">{d.label}</span>
            <span className="text-xs font-bold text-slate-800 ml-auto">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════ */

function KPISkeleton() {
  return (
    <div className="glass-card p-5 rounded-2xl animate-pulse">
      <div className="h-3 w-32 bg-slate-200 rounded mb-4" />
      <div className="h-8 w-24 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD PAGE — REAL DATA
   ═══════════════════════════════════════════ */

export default function Dashboard() {
  const { addToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      addToast('error', `Không thể tải Dashboard: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <KPISkeleton key={i} />)}
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const { kpi, status_distribution, overdue_alerts, leaderboard } = data;

  const kpiWidgets = [
    {
      title: 'Ngân sách Dự án',
      value: kpi.total_budget,
      sub: `${kpi.project_count} dự án trong hệ thống`,
      icon: '💰',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      textColor: 'text-blue-700',
    },
    {
      title: 'Tổng Giá trị Hồ sơ',
      value: kpi.total_task_value,
      sub: `Giải ngân: ${kpi.disbursed} (${kpi.disbursed_pct}%)`,
      icon: '📊',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      textColor: 'text-emerald-700',
    },
    {
      title: 'Hồ sơ Đang xử lý',
      value: String(kpi.active_tasks),
      sub: `/ ${kpi.total_tasks} tasks tổng cộng`,
      icon: '📋',
      gradient: 'from-amber-500/20 to-orange-500/20',
      textColor: 'text-amber-700',
    },
    {
      title: 'Cảnh báo Trễ hạn',
      value: String(kpi.overdue_count),
      sub: kpi.overdue_count > 0 ? 'tasks cần xử lý gấp' : 'Không có task trễ hạn 🎉',
      icon: '🚨',
      gradient: 'from-red-500/20 to-rose-500/20',
      textColor: kpi.overdue_count > 0 ? 'text-red-600' : 'text-green-600',
    },
  ];

  // Generate rank gradient colors
  const rankGradients = [
    'from-amber-400 to-yellow-500',   // 1st
    'from-slate-300 to-slate-400',     // 2nd
    'from-amber-600 to-amber-700',     // 3rd
  ];

  const userGradients = [
    'from-blue-400 to-blue-600',
    'from-emerald-400 to-emerald-600',
    'from-rose-400 to-rose-600',
    'from-violet-400 to-violet-600',
    'from-amber-400 to-amber-600',
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ── KPI Widgets ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiWidgets.map((w, i) => (
          <div key={i} className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br ${w.gradient} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{w.title}</p>
                <span className="text-xl">{w.icon}</span>
              </div>
              <p className={`text-3xl font-extrabold tracking-tight ${w.textColor}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                {w.value}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{w.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cashflow / Giải ngân */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-heading text-slate-800">Giải ngân vs Còn lại</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tất cả dự án — Dữ liệu thực từ Database</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-medium">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary-500/80" /> Đã giải ngân</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary-200/80 border border-primary-300/50" /> Còn lại</span>
            </div>
          </div>
          <MiniBarChart totalValue={kpi.total_task_value_raw} disbursed={kpi.disbursed_raw} />
        </div>

        {/* Task Distribution Donut */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-heading text-slate-800">Phân bổ Trạng thái Công việc</h3>
            <p className="text-xs text-slate-400 mt-0.5">Dữ liệu thực — tất cả dự án</p>
          </div>
          <DonutChart data={status_distribution} total={kpi.total_tasks} />
        </div>
      </div>

      {/* ── Bottom Row: Leaderboard + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Leaderboard */}
        <div className="lg:col-span-3 glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-heading text-slate-800">🏆 Nhân sự & Hiệu suất</h3>
              <p className="text-xs text-slate-400 mt-0.5">Số hồ sơ hoàn thành — dữ liệu từ Database</p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Chưa có dữ liệu nhân sự</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((emp, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-white/30 hover:bg-white/50 transition-colors group">
                  {/* Rank */}
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-sm ${
                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' :
                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                    idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                    'bg-white/60 text-slate-500 border border-white/50'
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${userGradients[idx % userGradients.length]} text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white/60 shadow-md`}>
                    {emp.initials.slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{emp.role} · {emp.total_tasks} tasks</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{emp.completed} <span className="text-[10px] text-slate-400 font-normal">hoàn thành</span></p>
                    <p className={`text-[10px] font-bold ${emp.on_time_pct >= 90 ? 'text-green-600' : emp.on_time_pct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                      {emp.on_time_pct}% đúng hạn
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Alerts */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border-red-200/30">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-heading text-red-600">⚠️ Cảnh báo Trễ hạn</h3>
              <p className="text-xs text-slate-400 mt-0.5">Dữ liệu thực từ Database</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              overdue_alerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
            }`}>
              {overdue_alerts.length}
            </span>
          </div>

          {overdue_alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-4xl mb-3">🎉</span>
              <p className="text-sm font-semibold text-green-600">Không có task trễ hạn!</p>
              <p className="text-xs text-slate-400 mt-1">Tất cả hồ sơ đang đúng tiến độ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdue_alerts.map((alert, i) => (
                <div key={i} className="p-3 rounded-xl bg-red-50/40 border border-red-200/30 hover:bg-red-50/60 transition-colors">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-semibold text-slate-800 leading-snug flex-1 mr-2">{alert.task}</p>
                    <span className="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      -{alert.days_late} ngày
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium flex-wrap">
                    <span>📁 {alert.project}</span>
                    <span>👤 {alert.assignee}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${priorityBadge[alert.priority] || 'bg-slate-100 text-slate-500'}`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
