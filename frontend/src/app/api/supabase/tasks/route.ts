import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/supabase/tasks → List tasks (supports my-tasks with user_id filter)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('per_page') || '50');

  try {
    let query = supabase
      .from('tasks')
      .select('*, assignee:users(id, full_name, email, role), project:projects(id, name, slug)', { count: 'exact' });

    if (userId) {
      query = query.eq('assignee_id', userId);
    }
    
    const projectId = searchParams.get('project_id');
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Transform to match expected frontend format
    const tasks = (data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      project_id: t.project_id,
      project_name: t.project?.name || 'N/A',
      project_slug: t.project?.slug || '',
      assignee_name: t.assignee?.full_name || 'Chưa giao',
      assignee_id: t.assignee_id,
      status: t.status,
      category: t.category,
      priority: t.priority,
      value_vnd: t.value_vnd ? Number(t.value_vnd) : 0,
      progress_percent: t.progress_percent || 0,
      deadline: t.deadline,
      attachment_count: 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    return NextResponse.json({
      tasks,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/supabase/tasks → Create a new task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, project_id, assignee_id, status, category, priority, value_vnd, deadline } = body;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        project_id,
        assignee_id: assignee_id || null,
        status: status || 'Kế hoạch',
        category,
        priority: priority || 'Trung bình',
        value_vnd: value_vnd || 0,
        deadline: deadline || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/supabase/tasks → Update a task (status, progress, value, details)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/supabase/tasks → Delete a task
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
