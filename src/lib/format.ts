export function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })
    .format(new Date());
}

export function relativeDue(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);

  if (diff <= 0) return "due now";
  if (days === 0) return "later today";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "in a month" : `in ${months} months`;
}

export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
