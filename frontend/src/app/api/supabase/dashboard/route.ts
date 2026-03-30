import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

function formatVND(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} tỷ`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)} triệu`;
  return value.toLocaleString('vi-VN') + ' đ';
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [projectsRes, tasksRes, usersRes] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('tasks').select('*, assignee:users(full_name, role, email)'),
      supabase.from('users').select('*').eq('is_active', true),
    ]);

    const projects = projectsRes.data || [];
    const tasks = tasksRes.data || [];
    const users = usersRes.data || [];

    // KPI calculations
    const total_budget_raw = projects.reduce((s: number, p: any) => s + Number(p.total_budget_vnd || 0), 0);
    const total_task_value_raw = tasks.reduce((s: number, t: any) => s + Number(t.value_vnd || 0), 0);

    const completedTasks = tasks.filter((t: any) => t.status === 'Hoàn thành');
    const disbursed_raw = completedTasks.reduce((s: number, t: any) => s + Number(t.value_vnd || 0), 0);
    const disbursed_pct = total_task_value_raw > 0 ? Math.round((disbursed_raw / total_task_value_raw) * 100) : 0;

    const activeTasks = tasks.filter((t: any) => t.status !== 'Hoàn thành' && t.status !== 'Kế hoạch');
    const now = new Date();
    const overdueTasks = tasks.filter((t: any) => {
      if (!t.deadline || t.status === 'Hoàn thành') return false;
      return new Date(t.deadline) < now;
    });

    const kpi = {
      total_budget: formatVND(total_budget_raw),
      total_budget_raw,
      total_task_value: formatVND(total_task_value_raw),
      total_task_value_raw,
      disbursed: formatVND(disbursed_raw),
      disbursed_raw,
      disbursed_pct,
      project_count: projects.length,
      active_tasks: activeTasks.length,
      total_tasks: tasks.length,
      overdue_count: overdueTasks.length,
    };

    // Status distribution
    const statusCounts: Record<string, number> = {};
    tasks.forEach((t: any) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });
    const status_distribution = Object.entries(statusCounts).map(([label, count]) => ({
      label,
      count,
      pct: tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0,
    }));

    // Overdue alerts
    const overdue_alerts = overdueTasks.map((t: any) => {
      const daysLate = Math.ceil((now.getTime() - new Date(t.deadline).getTime()) / (1000 * 60 * 60 * 24));
      const project = projects.find((p: any) => p.id === t.project_id);
      return {
        task_id: t.id,
        task: t.title,
        project: project?.name || 'N/A',
        days_late: daysLate,
        assignee: t.assignee?.full_name || 'Chưa giao',
        priority: t.priority || 'Trung bình',
      };
    }).sort((a: any, b: any) => b.days_late - a.days_late);

    // Leaderboard
    const leaderboard = users.map((u: any) => {
      const userTasks = tasks.filter((t: any) => t.assignee_id === u.id);
      const completed = userTasks.filter((t: any) => t.status === 'Hoàn thành').length;
      const inProgress = userTasks.filter((t: any) => t.status === 'Đang xử lý').length;
      const onTimeTasks = userTasks.filter((t: any) => {
        if (t.status !== 'Hoàn thành' || !t.deadline) return false;
        return new Date(t.updated_at) <= new Date(t.deadline);
      });
      const on_time_pct = completed > 0 ? Math.round((onTimeTasks.length / completed) * 100) : 0;
      const initials = u.full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase();

      return {
        name: u.full_name,
        role: u.role,
        total_tasks: userTasks.length,
        completed,
        in_progress: inProgress,
        on_time_pct,
        initials,
      };
    }).sort((a: any, b: any) => b.completed - a.completed);

    return NextResponse.json({ kpi, status_distribution, overdue_alerts, leaderboard });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
