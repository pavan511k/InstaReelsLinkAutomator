import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * POST /api/email/welcome
 * Called after a user successfully signs up.
 * Sends a branded welcome email via Resend from support@autodm.pro.
 *
 * Body: { email: string, name?: string }
 */
export async function POST(request) {
    try {
        const { email, name } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        await sendWelcomeEmail({ to: email, name });

        return NextResponse.json({ success: true });
    } catch (err) {
        // Non-critical — log but never fail the signup flow
        console.error('[Email/Welcome] Failed to send welcome email:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
