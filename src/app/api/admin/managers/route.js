
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import supabase from '@/lib/supabaseServer';

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '-';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0] || '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', userId)
      .single();

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: managers, error: managersError } = await supabase
      .from('managers')
      .select('manager_id, name, email_address, must_change_password, email_verified, verification_token, verification_token_expires, created_at, verification_email_sent_count, last_verification_email_sent_at')
      .order('created_at', { ascending: false });

    if (managersError) {
      return NextResponse.json({ error: 'Failed to fetch managers', details: managersError.message }, { status: 500 });
    }

    const now = new Date();
    const rows = (managers || []).map((m) => {
      const hasToken = !!m.verification_token;
      const tokenExpiresAt = m.verification_token_expires ? new Date(m.verification_token_expires) : null;
      const tokenExpired = hasToken && tokenExpiresAt ? tokenExpiresAt < now : false;
      const tokenActive = hasToken && tokenExpiresAt ? tokenExpiresAt >= now : hasToken;

      return {
        manager_id: m.manager_id,
        name: m.name || '-',
        email_address: m.email_address || '-',
        email_masked: maskEmail(m.email_address),
        must_change_password: !!m.must_change_password,
        email_verified: !!m.email_verified,
        has_verification_token: hasToken,
        verification_token_expires: m.verification_token_expires,
        verification_token_expired: tokenExpired,
        verification_token_active: tokenActive,
        created_at: m.created_at,
        verification_email_sent_count: m.verification_email_sent_count || 0,
        last_verification_email_sent_at: m.last_verification_email_sent_at,
      };
    });

    const summary = {
      total: rows.length,
      verified: rows.filter((r) => r.email_verified).length,
      unverified: rows.filter((r) => !r.email_verified).length,
      mustChangePassword: rows.filter((r) => r.must_change_password).length,
      hasToken: rows.filter((r) => r.has_verification_token).length,
      tokenActive: rows.filter((r) => r.verification_token_active).length,
      tokenExpired: rows.filter((r) => r.verification_token_expired).length,
      resendHeavy: rows.filter((r) => (r.verification_email_sent_count || 0) >= 3).length,
    };

    return NextResponse.json({ success: true, summary, managers: rows });
  } catch (error) {
    console.error('Admin managers error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
