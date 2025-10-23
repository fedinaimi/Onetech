import { NextResponse } from 'next/server';

export async function POST() {
    try {
        console.log('🗑️ Clearing stuck processing sessions');

        // This endpoint helps clear stuck sessions on the frontend
        return NextResponse.json({
            success: true,
            message: 'Session cleared. Please refresh the page.',
        });
    } catch (error) {
        console.error('[ERROR] Session cleanup failed:', error);
        return NextResponse.json(
            { error: 'Failed to clear session' },
            { status: 500 },
        );
    }
}
