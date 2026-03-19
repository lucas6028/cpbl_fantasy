'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check if user is admin
async function checkAdmin(userId) {
  try {
    const { data, error } = await supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', userId)
      .single();

    return !error && !!data;
  } catch (e) {
    console.error('Admin check error:', e);
    return false;
  }
}

// GET - 获取所有公告（仅限 Admin，包括非活跃的）
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, is_active, created_at, updated_at, created_by')
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
    console.error('Admin announcements fetch error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST - 创建新公告
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content, is_active } = body;

    if (!title || !content) {
      return Response.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        is_active: is_active !== undefined ? is_active : true,
        created_by: userId
      })
      .select();

    if (error) {
      console.error('Error creating announcement:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      announcement: data[0],
      message: 'Announcement created successfully'
    });
  } catch (e) {
    console.error('Create announcement error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - 更新公告
export async function PUT(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const announcementId = searchParams.get('id');

    if (!userId || !announcementId) {
      return Response.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content, is_active } = body;

    if (!title || !content) {
      return Response.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('announcements')
      .update({
        title,
        content,
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', announcementId)
      .select();

    if (error) {
      console.error('Error updating announcement:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return Response.json({ success: false, error: 'Announcement not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      announcement: data[0],
      message: 'Announcement updated successfully'
    });
  } catch (e) {
    console.error('Update announcement error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - 删除公告
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const announcementId = searchParams.get('id');

    if (!userId || !announcementId) {
      return Response.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) {
      console.error('Error deleting announcement:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (e) {
    console.error('Delete announcement error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
