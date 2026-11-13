// Features that exist in the code but are switched off for now. Flip a flag to
// bring its feature back; nothing else needs to change.

/** "Today's summary" (the daily brief) is hidden for now (Round 4 §5.2): no
 *  button or pinned brief in the notification list, no popups or desktop
 *  notifications for it, and neither the on-demand route nor the daily cron
 *  writes one. The code in lib/daily-brief.ts stays as it is. */
export const TODAYS_SUMMARY_ENABLED = false;

/** The notifications the list, popups and desktop alerts may show. */
export function visibleNotifications<T extends { type: string }>(list: readonly T[], summaryEnabled = TODAYS_SUMMARY_ENABLED): T[] {
  return summaryEnabled ? [...list] : list.filter((n) => n.type !== "daily_brief");
}
