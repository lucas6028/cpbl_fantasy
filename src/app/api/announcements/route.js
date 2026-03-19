'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - 获取所有活跃公告（公开）
export async function GET(req) {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      announcements: data || []
    });
  } catch (e) {
    console.error('Announcements fetch error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
