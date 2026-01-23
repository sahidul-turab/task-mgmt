import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebaseClient';

// Initialize Resend inside the handler to prevent early crashes if key is missing

export async function POST(req: NextRequest) {
    // Check for API key first
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
        return NextResponse.json({
            error: 'Missing RESEND_API_KEY. Please add it to your .env file.'
        }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        // 1. Fetch settings from Firestore
        // Note: In a production environment with strict rules, 
        // you'd use firebase-admin with a service account.
        const settingsRef = collection(db, 'settings');
        const settingsSnap = await getDocs(query(settingsRef));
        const emailSettingsDoc = settingsSnap.docs.find(d => d.id === 'email');

        if (!emailSettingsDoc) {
            return NextResponse.json({ error: 'Email settings not found' }, { status: 404 });
        }

        const settings = emailSettingsDoc.data();
        if (!settings.isEnabled || !settings.recipients || settings.recipients.length === 0) {
            return NextResponse.json({ message: 'Email reports are disabled or no recipients found.' });
        }

        // 2. Fetch Tasks
        const todayStr = new Date().toISOString().slice(0, 10);
        const tasksRef = collection(db, 'tasks');
        const tasksSnap = await getDocs(query(tasksRef, orderBy('deadline', 'asc')));

        const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const overdueTasks = allTasks.filter(t => t.status === 'todo' && t.deadline && t.deadline < todayStr);
        const todayTasks = allTasks.filter(t => t.status === 'todo' && t.deadline && t.deadline === todayStr);

        if (overdueTasks.length === 0 && todayTasks.length === 0) {
            return NextResponse.json({ message: 'No tasks to report today.' });
        }

        // 3. Helper to format a single task card (Portal Style)
        const formatTaskCard = (t: any) => {
            const priorityColors: Record<string, string> = {
                high: '#ef4444',
                medium: '#f59e0b',
                low: '#3b82f6',
            };
            const borderColor = priorityColors[t.priority] || '#9ca3af';

            // Format assignee initials
            const assignee = t.person || 'Me';
            const initial = assignee.charAt(0).toUpperCase();

            return `
            <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 12px; border-left: 4px solid ${borderColor}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">
                <div style="color: #f8fafc; font-weight: 700; font-size: 15px; margin-bottom: 12px; line-height: 1.4;">
                    ${t.name}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <div style="width: 24px; height: 24px; background-color: #334155; border-radius: 50%; color: #94a3b8; font-size: 12px; font-weight: 800; display: -webkit-flex; -webkit-justify-content: center; -webkit-align-items: center; display: flex; justify-content: center; align-items: center;">
                        ${initial}
                    </div>
                    <span style="color: #94a3b8; font-size: 13px; font-weight: 500;">${assignee}</span>
                </div>
                <div style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px; color: ${t.deadline < todayStr ? '#f87171' : '#fbbf24'}; font-weight: 600;">
                        ${t.deadline < todayStr ? '⚠️ Overdue' : '⏰ Today'} - ${new Date(t.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                </div>
            </div>`;
        };

        const overdueHtml = overdueTasks.length > 0
            ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #f87171; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 15px; display: flex; align-items: center; gap: 6px;">
                    OVERDUE <span style="background: rgba(248, 113, 113, 0.1); padding: 2px 8px; border-radius: 10px; font-size: 10px;">${overdueTasks.length}</span>
                </h3>
                ${overdueTasks.map(formatTaskCard).join('')}
            </div>`
            : '';

        const todayHtml = todayTasks.length > 0
            ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #6366f1; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 15px; display: flex; align-items: center; gap: 6px;">
                    DUE TODAY <span style="background: rgba(99, 102, 241, 0.1); padding: 2px 8px; border-radius: 10px; font-size: 10px;">${todayTasks.length}</span>
                </h3>
                ${todayTasks.map(formatTaskCard).join('')}
            </div>`
            : '';

        const html = `
      <div style="background-color: #0f172a; font-family: 'Inter', -apple-system, sans-serif; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto;">
            <div style="margin-bottom: 30px; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
                <h1 style="color: #f8fafc; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Task Report</h1>
                <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            
            ${overdueHtml}
            ${todayHtml}
            
            <div style="margin-top: 50px; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">
                <p style="color: #475569; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">This is an automated update from Portal</p>
            </div>
        </div>
      </div>
    `;

        // 4. Send Email
        const { data, error } = await resend.emails.send({
            from: 'Task MGMT <onboarding@resend.dev>', // You can use your custom domain once verified
            to: settings.recipients,
            subject: `Daily Task Report - ${todayStr}`,
            html: html,
        });

        if (error) {
            console.error('Resend Error:', error);
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ message: 'Report sent successfully!', data });

    } catch (err: any) {
        console.error('Server Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// To allow Vercel Cron or other external triggers, we also support GET if needed
export async function GET(req: NextRequest) {
    // You might want to add a secret token check here for security
    // if (req.nextUrl.searchParams.get('token') !== process.env.CRON_SECRET) { ... }
    return POST(req);
}
