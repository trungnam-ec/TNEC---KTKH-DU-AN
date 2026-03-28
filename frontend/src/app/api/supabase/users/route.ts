import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/supabase/users → List all users
export async function GET() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/supabase/users → Create a new user
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { full_name, email, role } = body;

  if (!full_name || !email) {
    return NextResponse.json({ error: 'Missing full_name or email' }, { status: 400 });
  }

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Email đã tồn tại trong hệ thống' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name,
      email: email.toLowerCase(),
      role: role || 'Staff',
      department: 'KTKH',
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/supabase/users → Toggle active or update profile
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  }

  if (action === 'toggle-active') {
    const { data: current } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', id)
      .single();

    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('users')
      .update({ is_active: !current.is_active })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Generic update (profile)
  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/supabase/users → Delete a user
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  }

  // Unassign tasks first
  await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', id);

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
