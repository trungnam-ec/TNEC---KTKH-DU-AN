import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { extractText } from 'unpdf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const MIN_TEXT_LENGTH = 100; // below this, treat as scanned PDF

/** Render all PDF pages to base64 PNG images using pdfjs-dist + node-canvas */
async function renderPdfToImages(buffer: Uint8Array): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
  
  // Must provide a NodeCanvasFactory for server-side rendering
  const { createCanvas } = await import('canvas');

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR accuracy
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d') as any;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    images.push(base64);
  }

  return images;
}

/** Build the AI messages payload — text mode or vision (OCR) mode */
function buildMessages(systemPrompt: string, pdfText: string | null, pageImages: string[]): any[] {
  if (pdfText && pdfText.length >= MIN_TEXT_LENGTH) {
    // Text mode: fast and cheap
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Đây là nội dung văn bản trích từ file PDF báo cáo ngày:\n\n${pdfText}` }
    ];
  }

  // Vision / OCR mode: send all page images to GPT-4o Vision
  const userContent: any[] = [
    {
      type: 'text',
      text: 'Đây là các trang của file PDF báo cáo ngày (ảnh scan). Hãy đọc toàn bộ nội dung và trả về JSON theo yêu cầu.'
    },
    ...pageImages.map((b64) => ({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' }
    }))
  ];

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { attachmentId } = await req.json();

    if (!attachmentId) {
      return NextResponse.json({ error: 'Missing attachmentId' }, { status: 400 });
    }

    // 0. Fetch AI Config from DB
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError || !settings || !settings.openai_api_key) {
      return NextResponse.json({ error: 'Hệ thống chưa được cấu hình API Key (Hoặc lỗi DB)' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: settings.openai_api_key });

    // 1. Fetch Attachment Metadata
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) {
      throw new Error(`Attachment not found: ${fetchError?.message}`);
    }

    if (attachment.file_type !== 'pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported for AI extraction right now' }, { status: 400 });
    }

    // 2. Download PDF
    const fileRes = await fetch(attachment.file_url);
    if (!fileRes.ok) throw new Error('Failed to download PDF from storage');
    const arrayBuffer = await fileRes.arrayBuffer();
    const uint8Buffer = new Uint8Array(arrayBuffer);

    // 3. Try text extraction first
    let pdfText = '';
    try {
      const { text } = await extractText(uint8Buffer, { mergePages: true });
      pdfText = typeof text === 'string' ? text : (text as string[]).join('\n');
      pdfText = pdfText.trim();
    } catch { /* text extraction failed — will fall back to OCR */ }

    const isScanned = pdfText.length < MIN_TEXT_LENGTH;

    // 4. If scanned PDF → render pages to images for GPT-4o Vision
    let pageImages: string[] = [];
    if (isScanned) {
      try {
        pageImages = await renderPdfToImages(uint8Buffer);
      } catch (ocrErr: any) {
        throw new Error(`Không thể render PDF để OCR: ${ocrErr.message}`);
      }
    }

    // 5. Build system prompt (DB first, then fallback)
    const systemPrompt = settings.system_prompt || `Bạn là trợ lý chuyên phân tích báo cáo thi công xây dựng hàng ngày bằng TIẾNG VIỆT.
Bạn nhận văn bản hoặc ảnh từ file PDF báo cáo ngày và trả về JSON với 5 trường sau.
Tìm kiếm kỹ các số liệu trong bảng tổng hợp hoặc phần kết báo cáo:
1. "report_date": Ngày ghi trên báo cáo ("Kế hoạch công việc ngày:", "Báo cáo ngày", "Công việc thực hiện ngày:"). Định dạng YYYY-MM-DD. Nếu không thấy trả về "".
2. "volume_today": Khối lượng thi công trong ngày, chỉ số, bỏ đơn vị. Nếu không thấy trả về 0.
3. "estimated_production": Sản lượng tạm tính lũy kế từ đầu HĐ, chỉ số, bỏ VNĐ. Nếu không thấy trả về 0.
4. "remaining_value": Giá trị HĐ chưa thực hiện = Giá trị HĐ - Sản lượng tạm tính. Chỉ số, bỏ đơn vị. Nếu không thấy trả về 0.
5. "raw_summary": 2-3 câu TIẾNG VIỆT:
   - Câu 1: Nêu khối lượng và đánh giá tiến độ (nhiều việc / ít việc / bình thường).
   - Câu 2: Liệt kê các hạng mục công việc chính trong ngày.
   - Câu 3: Thời tiết và sự cố nếu có, hoặc "Không có sự cố".

Chỉ trả về JSON thuần, không markdown, không giải thích:
{
  "report_date": "YYYY-MM-DD",
  "volume_today": number,
  "estimated_production": number,
  "remaining_value": number,
  "raw_summary": "string tiếng Việt"
}`;

    // 6. Call GPT-4o (text or vision)
    const messages = buildMessages(systemPrompt, isScanned ? null : pdfText, pageImages);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages,
      temperature: 0.1,
    });

    const aiContent = completion.choices[0]?.message?.content || '{}';
    let extractData: any;
    try {
      extractData = JSON.parse(aiContent);
    } catch {
      throw new Error('Failed to parse AI JSON response');
    }

    // 7. Determine report_date (AI-extracted → validate → fallback to today)
    const today = new Date().toISOString().split('T')[0];
    let reportDate = today;
    if (extractData.report_date && /^\d{4}-\d{2}-\d{2}$/.test(extractData.report_date)) {
      reportDate = extractData.report_date;
    }

    // 8. Save to daily_metrics
    const metricPayload = {
      task_id: attachment.task_id,
      attachment_id: attachment.id,
      volume_today: Number(extractData.volume_today) || 0,
      estimated_production: Number(extractData.estimated_production) || 0,
      remaining_value: Number(extractData.remaining_value) || 0,
      raw_summary: extractData.raw_summary || '',
      report_date: reportDate,
    };

    const { data: insertedMetric, error: insertError } = await supabase
      .from('daily_metrics')
      .insert(metricPayload)
      .select('*')
      .single();

    if (insertError) {
      throw new Error(`Failed to save metrics to database: ${insertError.message}`);
    }

    // 9. Auto-update task value_vnd = Giá trị HĐ = estimated_production + remaining_value
    const contractValue = (Number(extractData.estimated_production) || 0) + (Number(extractData.remaining_value) || 0);
    if (contractValue > 0) {
      await supabase
        .from('tasks')
        .update({ value_vnd: contractValue })
        .eq('id', attachment.task_id);
    }

    return NextResponse.json({
      success: true,
      data: insertedMetric,
      contract_value: contractValue,
      ocr_mode: isScanned,
      pages_processed: isScanned ? pageImages.length : null,
    });


  } catch (err: any) {
    console.error('AI Extraction Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
