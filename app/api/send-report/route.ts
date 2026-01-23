import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebaseClient';

export async function POST(req: NextRequest) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        return NextResponse.json({
            error: 'Missing EMAIL_USER or EMAIL_PASS in environment variables.'
        }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass,
        },
    });

    try {
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

        const now = new Date();
        const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
        const todayStr = bdTime.toISOString().slice(0, 10);

        const tasksRef = collection(db, 'tasks');
        const tasksSnap = await getDocs(query(tasksRef, orderBy('deadline', 'asc')));
        const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const overdueTasks = allTasks.filter(t => t.status === 'todo' && t.deadline && t.deadline < todayStr);
        const todayTasks = allTasks.filter(t => t.status === 'todo' && t.deadline && t.deadline === todayStr);

        if (overdueTasks.length === 0 && todayTasks.length === 0) {
            return NextResponse.json({ message: 'No tasks to report today.' });
        }

        const day = bdTime.getDate();
        const month = bdTime.toLocaleDateString('en-GB', { month: 'long' });
        const year = bdTime.getFullYear();
        const formattedDate = `${day} ${month}, ${year}`;
        const subject = `Operational Task - ${formattedDate}`;
        const uniqueId = now.getTime();

        const formatTaskCard = (t: any) => {
            const priorityColors: Record<string, string> = {
                high: '#ef4444',
                medium: '#f59e0b',
                low: '#3b82f6',
            };
            const priorityColor = priorityColors[t.priority] || '#9ca3af';
            const assignee = t.person || 'Turab';
            const initial = assignee.charAt(0).toUpperCase();

            return `
            <div style="display: inline-block; vertical-align: top; width: 48%; margin: 0 1% 12px 1%; background-color: #1e293b; border-radius: 12px; border-left: 4px solid ${priorityColor}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); box-sizing: border-box; min-width: 240px;">
                <div style="padding: 16px;">
                    <div style="color: #f8fafc; font-weight: 700; font-size: 14px; margin-bottom: 12px; line-height: 1.4; height: 40px; overflow: hidden;">
                        ${t.name}
                    </div>
                    <div style="margin-bottom: 12px;">
                        <table cellpadding="0" cellspacing="0" border="0" style="font-family: sans-serif;">
                            <tr>
                                <td valign="middle" width="28">
                                    <div style="width: 24px; height: 24px; background-color: #334155; border-radius: 50%; text-align: center; line-height: 24px;">
                                        <span style="color: #94a3b8; font-size: 11px; font-weight: 800;">${initial}</span>
                                    </div>
                                </td>
                                <td valign="middle">
                                    <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">${assignee}</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 4px 8px; display: inline-block; font-family: sans-serif;">
                        <span style="font-size: 11px; color: ${t.deadline < todayStr ? '#f87171' : '#fbbf24'}; font-weight: 600;">
                            ${t.deadline < todayStr ? '⚠️ Overdue' : '⏰ Today'} - ${new Date(t.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>
            </div>`;
        };

        const overdueHtml = overdueTasks.length > 0
            ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #f87171; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 15px; padding-left: 5px;">
                    OVERDUE <span style="background: rgba(248, 113, 113, 0.1); padding: 2px 8px; border-radius: 10px; font-size: 10px;">${overdueTasks.length}</span>
                </h3>
                <div style="font-size: 0; text-align: left; margin: 0 -1%;">
                    ${overdueTasks.map(formatTaskCard).join('')}
                </div>
            </div>`
            : '';

        const todayHtml = todayTasks.length > 0
            ? `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #6366f1; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 15px; padding-left: 5px;">
                    DUE TODAY <span style="background: rgba(99, 102, 241, 0.1); padding: 2px 8px; border-radius: 10px; font-size: 10px;">${todayTasks.length}</span>
                </h3>
                <div style="font-size: 0; text-align: left; margin: 0 -1%;">
                    ${todayTasks.map(formatTaskCard).join('')}
                </div>
            </div>`
            : '';

        const html = `
      <div style="background-color: #0f172a; font-family: Arial, sans-serif; padding: 40px 20px;">
        <div style="display:none; overflow:hidden; font-size:1px; color:#0f172a; line-height:1px; max-height:0px; max-width:0px; opacity:0; mso-hide:all;">ID: ${uniqueId} | ${now.toISOString()}</div>
        <div style="max-width: 800px; margin: 0 auto;">
            <div style="margin-bottom: 30px; border-bottom: 1px solid #1e293b; padding-bottom: 20px;">
                <h1 style="color: #f8fafc; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Operational Task</h1>
                <p style="color: #64748b; font-size: 14px; margin: 8px 0 20px 0;">${formattedDate}</p>
                <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6;">
                    Hello! Here is the summary of tasks that need your attention today. 
                    Please review the overdue items and focus on today's goals.
                </p>
            </div>
            ${overdueHtml}
            ${todayHtml}
            <div style="margin-top: 50px; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">
                <p style="color: #475569; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">This is an automated update from Portal | Ref: ${uniqueId}</p>
            </div>
        </div>
      </div>
    `;

        await transporter.sendMail({
            from: `"Task MGMT" <${emailUser}>`,
            to: settings.recipients.join(', '),
            subject: subject,
            html: html,
        });

        return NextResponse.json({ message: 'Report sent successfully!' });

    } catch (err: any) {
        console.error('Email Server Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to send automated report' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return POST(req);
}
