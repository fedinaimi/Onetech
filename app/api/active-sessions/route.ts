import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const BACKEND_URL =
            process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

        // Try to get active sessions from backend
        const response = await fetch(
            `${BACKEND_URL}/extraction/batch-sessions/`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        );

        if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
                success: true,
                sessions: data.sessions || [],
                total: data.total || 0,
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    sessions: [],
                    error: 'Backend sessions endpoint not available',
                },
                { status: 404 },
            );
        }
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        return NextResponse.json(
            {
                success: false,
                sessions: [],
                error: 'Failed to fetch active sessions',
            },
            { status: 500 },
        );
    }
}
