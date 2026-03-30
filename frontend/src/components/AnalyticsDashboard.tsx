'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AnalyticsDashboardProps { projectId: string; }

const fmt = (val: number) => {
  if (!val && val !== 0) return '—';
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2) + ' Tỷ';
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + ' Tr';
  return val.toLocaleString('vi-VN');
};
const fmtDate = (s: string) => {
  try { return format(parseISO(s), 'dd/MM/yyyy', { locale: vi }); }
  catch { return s; }
};

export default function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
  const [data, setData] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const go = async () => {
      try {
        const res = await fetch(`/api/supabase/metrics?projectId=${projectId}`);
        const r = await res.json();
        if (res.ok) { setData(r.data?.chartData || []); setSummaries(r.data?.rawSummaries || []); }
      } catch { } finally { setLoading(false); }
    };
    go();
    const t = setInterval(go, 30000);
    return () => clearInterval(t);
  }, [projectId]);

  if (loading || data.length === 0) return null;

  const latest = data[data.length - 1] || {};
  // rawSummaries is sorted DESC (newest first) → index [0] = latest report date
  const latestSummary = summaries.length > 0 ? summaries[0] : null;

  const cards = [
    {
      label: 'SẢN LƯỢNG TẠM TÍNH',
      sublabel: 'Lũy kế từ đầu hợp đồng',
      value: fmt(latest.estimated_production || 0),
      unit: 'VNĐ',
      icon: '💰',
      accent: '#6366f1',
      bg: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
      border: 'rgba(99,102,241,0.18)',
      dot: '#6366f1',
    },
    {
      label: 'SẢN LƯỢNG ĐẨY LÊN',
      sublabel: 'So với kỳ báo cáo trước',
      value: fmt(latest.production_delta || 0),
      unit: 'VNĐ',
      icon: '📈',
      accent: '#059669',
      bg: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
      border: 'rgba(5,150,105,0.18)',
      dot: '#10b981',
    },
    {
      label: 'GIÁ TRỊ CÒN LẠI',
      sublabel: 'Chưa thực hiện',
      value: fmt(latest.remaining_value || 0),
      unit: 'VNĐ',
      icon: '📋',
      accent: '#b45309',
      bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fff 100%)',
      border: 'rgba(180,83,9,0.18)',
      dot: '#f59e0b',
    },
    {
      label: 'NHẬT KÝ AI MỚI NHẤT',
      sublabel: latestSummary ? fmtDate(latestSummary.date) : '—',
      value: null,
      summary: latestSummary?.summary || 'Chưa có tóm tắt.',
      icon: '🤖',
      accent: '#0284c7',
      bg: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
      border: 'rgba(2,132,199,0.18)',
      dot: '#38bdf8',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: card.bg,
          border: `1px solid ${card.border}`,
          borderRadius: 14,
          padding: '14px 16px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 96,
        }}>
          {/* Decorative circle */}
          <div style={{
            position: 'absolute', top: -18, right: -18,
            width: 72, height: 72, borderRadius: '50%',
            background: card.dot,
            opacity: 0.08,
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: card.accent, letterSpacing: '0.6px' }}>
                {card.label}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
                {card.sublabel}
              </div>
            </div>
          </div>

          {/* Value or Summary */}
          {card.value !== null ? (
            <div style={{ marginTop: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: card.accent, letterSpacing: '-0.5px', lineHeight: 1 }}>
                {card.value}
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4, fontWeight: 600 }}>
                {card.unit}
              </span>
            </div>
          ) : (
            <div style={{
              fontSize: 11, color: '#475569', lineHeight: 1.55,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              borderLeft: `2px solid ${card.dot}`,
              paddingLeft: 8, marginTop: 2,
            }}>
              {card.summary}
            </div>
          )}

          {/* Bottom accent line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${card.dot}, transparent)`,
            opacity: 0.6,
          }} />
        </div>
      ))}
    </div>
  );
}
