import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/supabase/upload → Upload file to Storage and insert record
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('task_id') as string | null;
    const uploaderId = formData.get('uploader_id') as string | null;

    if (!file || !taskId || !uploaderId) {
      return NextResponse.json({ error: 'Missing file, task_id, or uploader_id' }, { status: 400 });
    }

    // Prepare filename and storage path
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const storagePath = `${taskId}/${uniqueName}`;

    // Upload to Supabase Storage bucket 'task_attachments'
    const { data: storageData, error: storageError } = await supabase.storage
      .from('task_attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) throw new Error(`Storage error: ${storageError.message}`);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('task_attachments')
      .getPublicUrl(storagePath);

    // Get file size formatted
    const sizeBytes = file.size;
    const fileSizeFormatted = sizeBytes > 1024 * 1024 
      ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB` 
      : `${Math.round(sizeBytes / 1024)} KB`;

    // Guess simple type
    const ext = fileExt?.toLowerCase() || '';
    let fileType = 'other';
    if (['pdf'].includes(ext)) fileType = 'pdf';
    else if (['xlsx', 'xls', 'csv'].includes(ext)) fileType = 'excel';
    else if (['doc', 'docx'].includes(ext)) fileType = 'word';
    else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) fileType = 'image';

    // Insert into 'attachments' table
    const { data: dbData, error: dbError } = await supabase
      .from('attachments')
      .insert({
        task_id: taskId,
        uploader_id: uploaderId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: fileSizeFormatted,
        file_type: fileType
      })
      .select('*, uploader:users(id, full_name)')
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    return NextResponse.json(dbData, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/supabase/upload → Delete file from Storage and DB record
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get('id');

    if (!attachmentId) {
      return NextResponse.json({ error: 'Missing attachment id' }, { status: 400 });
    }

    // 1. Get attachment record to find storage path
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    // Reconstruct Storage Path from URL: 
    // publicUrl looks like: https://[project].supabase.co/storage/v1/object/public/task_attachments/[task_id]/[file_name]
    // The storage path is what comes after the bucket name
    const pathParts = attachment.file_url.split('/task_attachments/');
    if (pathParts.length > 1) {
      const storagePath = pathParts[1];
      
      // 2. Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('task_attachments')
        .remove([storagePath]);
      
      if (storageError) console.error("Could not remove from storage:", storageError.message); 
      // even if storage fails (e.g. file missing), we should still delete the DB record
    }

    // 3. Delete from Database
    const { error: deleteError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) throw new Error(`Delete error: ${deleteError.message}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
