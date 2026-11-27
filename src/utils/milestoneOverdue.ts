export type MilestoneOverdueSeverity =
  | 'critical'
  | 'warning'
  | 'due_today'
  | 'due_soon'
  | 'on_track'
  | 'completed';

export interface MilestoneOverdueResult {
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  daysOverdue: number;
  daysRemaining: number;
  diffDays: number;
  severity: MilestoneOverdueSeverity;
  shortLabel: string;
  badgeLabel: string;
  warningMessage: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Parses a date string into a local-midnight Date object to avoid UTC timezone day shifts.
 */
export const parseMilestoneLocalDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const localDate = new Date(year, month, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/**
 * Calculates whether a project milestone is overdue by comparing 'Target Design'
 * against the current (or provided reference) date at local midnight.
 */
export const calculateProjectMilestoneOverdue = (
  targetDesignDate?: string,
  status?: string,
  referenceDate: Date = new Date()
): MilestoneOverdueResult => {
  if (status === 'Selesai') {
    return {
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      daysOverdue: 0,
      daysRemaining: 0,
      diffDays: 0,
      severity: 'completed',
      shortLabel: 'Selesai',
      badgeLabel: 'Selesai',
      warningMessage: 'Proyek sudah selesai.'
    };
  }

  const target = parseMilestoneLocalDate(targetDesignDate);
  if (!target) {
    return {
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      daysOverdue: 0,
      daysRemaining: 0,
      diffDays: 0,
      severity: 'on_track',
      shortLabel: '-',
      badgeLabel: '-',
      warningMessage: ''
    };
  }

  const todayMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / MS_PER_DAY);

  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    const severity: MilestoneOverdueSeverity = daysOverdue >= 7 ? 'critical' : 'warning';
    return {
      isOverdue: true,
      isDueToday: false,
      isDueSoon: false,
      daysOverdue,
      daysRemaining: 0,
      diffDays,
      severity,
      shortLabel: `Telat ${daysOverdue}h`,
      badgeLabel: `Overdue (${daysOverdue}h)`,
      warningMessage: `Target Design terlewat ${daysOverdue} hari (${targetDesignDate})`
    };
  }

  if (diffDays === 0) {
    return {
      isOverdue: false,
      isDueToday: true,
      isDueSoon: true,
      daysOverdue: 0,
      daysRemaining: 0,
      diffDays: 0,
      severity: 'due_today',
      shortLabel: 'Hari Ini',
      badgeLabel: 'Target Hari Ini',
      warningMessage: `Target Design jatuh tempo hari ini (${targetDesignDate})`
    };
  }

  if (diffDays <= 3) {
    const shortLabel = diffDays === 1 ? 'Besok' : `H-${diffDays}`;
    const badgeLabel = diffDays === 1 ? 'Target Besok' : `H-${diffDays}`;
    return {
      isOverdue: false,
      isDueToday: false,
      isDueSoon: true,
      daysOverdue: 0,
      daysRemaining: diffDays,
      diffDays,
      severity: 'due_soon',
      shortLabel,
      badgeLabel,
      warningMessage:
        diffDays === 1
          ? `Target Design besok / H-1 (${targetDesignDate})`
          : `Target Design dalam ${diffDays} hari lagi (${targetDesignDate})`
    };
  }

  return {
    isOverdue: false,
    isDueToday: false,
    isDueSoon: false,
    daysOverdue: 0,
    daysRemaining: diffDays,
    diffDays,
    severity: 'on_track',
    shortLabel: `H-${diffDays}`,
    badgeLabel: 'On Track',
    warningMessage: `Target Design dalam ${diffDays} hari (${targetDesignDate})`
  };
};
