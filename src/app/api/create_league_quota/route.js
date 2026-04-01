 import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || searchParams.get('manager_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Bypass all quota checks and database lookups
    // Creating leagues is now free
    console.log(`[create_league_quota] Free league creation enabled for user ${userId}. Bypassing quota check.`);
    
    return NextResponse.json({
      success: true,
      quota: 999, // Provide a high quota number to satisfy frontend validation
      products: []
    });

  } catch (error) {
    console.error('[create_league_quota] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}