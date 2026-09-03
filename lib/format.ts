export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export const aiInsights: { id: string; type: string; title: string; description: string; action: string }[] = [
  {
    id: 'ai-1',
    type: 'opportunity',
    title: 'High-value lead needs attention',
    description: 'James Wilson ($2.5M budget) has been inactive for 3 days. Reach out today to maintain momentum.',
    action: 'Contact lead',
  },
  {
    id: 'ai-2',
    type: 'trend',
    title: 'Website conversions up 35%',
    description: 'Your website leads are converting 35% better than last month. Consider increasing ad spend on top-performing channels.',
    action: 'View analytics',
  },
  {
    id: 'ai-3',
    type: 'alert',
    title: 'Response time above target',
    description: 'Average first-response time is 4.2h. Target is 2h. Assign more agents during peak hours.',
    action: 'Adjust schedules',
  },
];
