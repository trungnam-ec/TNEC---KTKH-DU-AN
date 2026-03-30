import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Fetch all metrics for the project, newest inserted first within each date
    const { data: rawMetrics, error } = await supabase
      .from('daily_metrics')
      .select(`
        *,
        tasks!inner (
          project_id
        )
      `)
      .eq('tasks.project_id', projectId)
      .order('report_date', { ascending: true })
      .order('created_at', { ascending: false }); // latest inserted first per date

    if (error) throw new Error(error.message);

    // Step 1: Deduplicate — per (task_id × report_date) keep LATEST inserted row.
    // Re-running AI on same PDF always wins with the freshest data.
    const dedupMap: Record<string, any> = {};
    rawMetrics.forEach((m: any) => {
      const key = `${m.task_id}__${m.report_date}`;
      if (!dedupMap[key]) {
        dedupMap[key] = m; // first = latest because sorted by created_at DESC
      }
    });
    const dedupedMetrics = Object.values(dedupMap);

    // Step 2: Aggregate deduped rows by date (multiple tasks can share same report_date)
    const aggregated: Record<string, any> = {};
    const rawSummaries: any[] = [];
    
    dedupedMetrics.forEach((m: any) => {
      const date = m.report_date;
      if (!aggregated[date]) {
        aggregated[date] = { date, volume_today: 0, estimated_production: 0, remaining_value: 0, contract_value: 0 };
      }
      aggregated[date].volume_today += Number(m.volume_today) || 0;
      // Cumulative figures: use the largest value seen for the day (most accurate)
      const prod = Number(m.estimated_production) || 0;
      const rem  = Number(m.remaining_value) || 0;
      if (prod > aggregated[date].estimated_production) aggregated[date].estimated_production = prod;
      if (rem  > aggregated[date].remaining_value)      aggregated[date].remaining_value      = rem;
      aggregated[date].contract_value = aggregated[date].estimated_production + aggregated[date].remaining_value;

      if (m.raw_summary && m.raw_summary.trim().length > 0) {
        rawSummaries.push({ date, taskId: m.task_id, summary: m.raw_summary });
      }
    });

    // Step 3: Sort by report_date ascending for the chart timeline
    const sorted: any[] = Object.values(aggregated).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Step 4: Compute daily production delta (sản lượng đẩy lên)
    const chartData = sorted.map((day, idx) => {
      const prev = idx > 0 ? sorted[idx - 1] : null;
      const production_delta = prev
        ? Math.max(0, day.estimated_production - prev.estimated_production)
        : day.estimated_production; // first day: full value is the base
      const volume_delta = prev
        ? Math.max(0, day.volume_today - prev.volume_today)
        : day.volume_today;
      return {
        ...day,
        production_delta,
        volume_delta,
        prev_estimated_production: prev ? prev.estimated_production : 0,
      };
    });

    // Step 5: Sort summaries by report_date DESC so latest appears first
    const sortedSummaries = rawSummaries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({ success: true, data: { chartData, rawSummaries: sortedSummaries, rawMetrics } });

  } catch (err: any) {
    console.error('Metrics GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
