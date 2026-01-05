import Stripe from 'stripe';
import {headers} from 'next/headers';
import {NextResponse} from 'next/server';

import {stripe} from '@/lib/stripe';
import {db} from '@/lib/db';

export async function POST(request: Request) {
    const body = await request.text();
    const signature = (await headers()).get('Stripe-Signature') as string;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        console.log('Error verifying webhook signature:', error.message);
        return new NextResponse('Webhook Error', {status: 400});
    }
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session?.metadata?.userId;
        const courseId = session?.metadata?.courseId;

        if (event.type === 'checkout.session.completed') {
            if (!userId || !courseId) {
                return new NextResponse(`Webhook Error: Missing metadata`, {status: 400});
            }

            await db.purchase.create({
                data: {
                    userId: userId,
                    courseId: courseId,
                },
            });
        } else {
            return new NextResponse(`Webhook Error: Unhandled event type: ${event.type}`, {status: 200});
        
    }
    return new NextResponse(null, {status: 200});
}