import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET: Check if league has a draft reset record
export async function GET(request, { params }) {
    try {
        const { leagueId } = await params;

        const { data, error } = await supabase
            .from('league_draft_reset')
            .select('*')
            .eq('league_id', leagueId)
            .order('reset_at', { ascending: false })
            .limit(1);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            needsReset: data && data.length > 0,
            resetRecord: data?.[0] || null,
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Update the draft time and remove the reset record
export async function POST(request, { params }) {
    try {
        const { leagueId } = await params;
        const { newDraftTime } = await request.json();

        if (!newDraftTime) {
            return NextResponse.json({ success: false, error: 'newDraftTime is required' }, { status: 400 });
        }

        // Convert datetime-local (Taiwan time) to ISO UTC
        const [datePart, timePart] = newDraftTime.split('T');
        if (!datePart || !timePart) {
            return NextResponse.json({ success: false, error: 'Invalid datetime format' }, { status: 400 });
        }
        const iso = `${datePart}T${timePart}:00+08:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
            return NextResponse.json({ success: false, error: 'Invalid datetime' }, { status: 400 });
        }

        // Update league_settings with the new draft time
        const { error: updateError } = await supabase
            .from('league_settings')
            .update({ live_draft_time: d.toISOString() })
            .eq('league_id', leagueId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // Delete the reset record(s) for this league
        const { error: deleteError } = await supabase
            .from('league_draft_reset')
            .delete()
            .eq('league_id', leagueId);

        if (deleteError) {
            console.error('Failed to delete draft reset record:', deleteError);
        }

        // Update league status back to pre-draft
        const { error: statusError } = await supabase
            .from('league_statuses')
            .update({ status: 'pre-draft' })
            .eq('league_id', leagueId);

        if (statusError) {
            console.error('Failed to update league status:', statusError);
        }

        return NextResponse.json({
            success: true,
            message: 'Draft time updated successfully',
            newDraftTime: d.toISOString(),
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
