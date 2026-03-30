import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/supabase/projects → List all projects (with task count) OR single project by slug
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  try {
    if (slug) {
      // Get single project
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    // Get all projects with task counts and total budget
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(count)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Supabase returns tasks: [{count: X}] when using tasks(count)
    const projects = data.map((p: any) => ({
      ...p,
      task_count: p.tasks && p.tasks.length > 0 ? p.tasks[0].count : 0
    }));

    // Cleanup the tasks array relation before sending to client
    const output = projects.map((p: any) => {
      const { tasks, ...rest } = p;
      return rest;
    });

    return NextResponse.json(output);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/supabase/projects → Create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, client, location, status, total_budget_vnd, start_date, deadline } = body;
    
    // Auto-generate slug from name
    const baseSlug = (name || 'project').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = baseSlug + '-' + Math.floor(Math.random() * 10000);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        slug,
        client: client || null,
        location: location || null,
        status: status || 'Khởi động',
        total_budget_vnd: total_budget_vnd || 0,
        start_date: start_date || null,
        deadline: deadline || null
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
