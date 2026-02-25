// Shift definitions in CET (UTC+1)
// Morning:   10:00 - 18:00 CET
// Afternoon: 18:00 - 02:00 CET (next day)
// Night:     02:00 - 10:00 CET

export interface ShiftInfo {
    type: 'MORNING' | 'AFTERNOON' | 'NIGHT';
    startHourCET: number;
    endHourCET: number;
    label: string;
}

export const SHIFTS: ShiftInfo[] = [
    { type: 'MORNING', startHourCET: 10, endHourCET: 18, label: 'Morning Shift (10:00 - 18:00 CET)' },
    { type: 'AFTERNOON', startHourCET: 18, endHourCET: 2, label: 'Afternoon Shift (18:00 - 02:00 CET)' },
    { type: 'NIGHT', startHourCET: 2, endHourCET: 10, label: 'Night Shift (02:00 - 10:00 CET)' },
];

export function getCurrentCETHour(): number {
    const now = new Date();
    // CET = UTC + 1, CEST = UTC + 2
    // Use simple CET (UTC+1) for now
    const cetOffset = 1;
    const utcHour = now.getUTCHours();
    return (utcHour + cetOffset) % 24;
}

export function getCurrentShift(): ShiftInfo {
    const hour = getCurrentCETHour();

    if (hour >= 10 && hour < 18) return SHIFTS[0]; // Morning
    if (hour >= 18 || hour < 2) return SHIFTS[1];  // Afternoon
    return SHIFTS[2]; // Night
}

export function getShiftBoundariesUTC(shiftType: string): { start: Date; end: Date } {
    const now = new Date();
    const cetOffset = 1;
    const todayDateStr = now.toISOString().split('T')[0];

    let startHour: number, endHour: number;

    switch (shiftType) {
        case 'MORNING':
            startHour = 10 - cetOffset; // 9 UTC
            endHour = 18 - cetOffset;   // 17 UTC
            return {
                start: new Date(`${todayDateStr}T${String(startHour).padStart(2, '0')}:00:00Z`),
                end: new Date(`${todayDateStr}T${String(endHour).padStart(2, '0')}:00:00Z`),
            };
        case 'AFTERNOON':
            startHour = 18 - cetOffset; // 17 UTC
            endHour = 2 - cetOffset;    // 1 UTC (next day)
            const start = new Date(`${todayDateStr}T${String(startHour).padStart(2, '0')}:00:00Z`);
            const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // +8 hours
            return { start, end };
        case 'NIGHT':
            startHour = 2 - cetOffset; // 1 UTC
            endHour = 10 - cetOffset;  // 9 UTC
            return {
                start: new Date(`${todayDateStr}T${String(Math.max(0, startHour)).padStart(2, '0')}:00:00Z`),
                end: new Date(`${todayDateStr}T${String(endHour).padStart(2, '0')}:00:00Z`),
            };
        default:
            return { start: now, end: now };
    }
}

/**
 * Check if a break can be taken (not in first/last hour of shift)
 */
export function canTakeBreak(clockInTime: Date, shiftType: string): { allowed: boolean; reason?: string } {
    const now = new Date();
    const elapsedMs = now.getTime() - clockInTime.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Not allowed in first hour
    if (elapsedHours < 1) {
        const minutesLeft = Math.ceil(60 - (elapsedMs / (1000 * 60)));
        return { allowed: false, reason: `You cannot take a break in the first hour of your shift. Wait ${minutesLeft} more minutes.` };
    }

    // Determine shift end time
    const boundaries = getShiftBoundariesUTC(shiftType);
    const timeUntilEndMs = boundaries.end.getTime() - now.getTime();
    const hoursUntilEnd = timeUntilEndMs / (1000 * 60 * 60);

    // Not allowed in last hour
    if (hoursUntilEnd <= 1 && hoursUntilEnd > 0) {
        return { allowed: false, reason: `You cannot take a break in the last hour of your shift.` };
    }

    return { allowed: true };
}

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}
