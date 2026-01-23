
export function formatDeadline(deadline?: string | null) {
    if (!deadline) return 'No deadline';

    // deadline is stored as 'YYYY-MM-DD'
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return 'No deadline';

    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }); // e.g. 11 December 2025
}

export function getRelativeDeadlineLabel(deadline: string, todayDateStr: string): string {
    const deadlineDate = new Date(deadline);
    const todayDate = new Date(todayDateStr);

    // Reset time to compare dates only
    deadlineDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const day = deadlineDate.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[deadlineDate.getMonth()];
    const dateStr = `${day} ${month}`;

    if (diffDays < 0) {
        const daysOverdue = Math.abs(diffDays);
        return `${daysOverdue}d overdue · ${dateStr}`;
    } else if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return `Tomorrow · ${dateStr}`;
    } else if (diffDays < 7) {
        return `In ${diffDays}d · ${dateStr}`;
    } else {
        return `${dateStr} · In ${diffDays}d`;
    }
}
