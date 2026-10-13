export const goLiveAt = (iso: string): Date => new Date(iso);

export const isScheduled = (iso: string, now: Date = new Date()): boolean =>
  goLiveAt(iso).getTime() > now.getTime();
