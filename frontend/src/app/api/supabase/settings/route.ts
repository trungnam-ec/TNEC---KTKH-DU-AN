import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message); // PGRST116 is not found

    return NextResponse.json(settings || {});
  } catch (err: any) {
    console.error('System settings GET ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // We only ever update record with id 1
    const { data: updatedSettings, error } = await supabase
      .from('system_settings')
      .upsert({ id: 1, ...body, updated_at: new Date().toISOString() })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: updatedSettings });
  } catch (err: any) {
    console.error('System settings POST ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
