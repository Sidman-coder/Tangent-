export function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const bucket = hour >= 5 && hour < 12 ? 'morning'
    : hour >= 12 && hour < 17 ? 'afternoon'
    : hour >= 17 && hour < 21 ? 'evening'
    : 'late';

  const options: Record<string, string[]> = {
    morning: [
      `Good morning, ${name}.`,
      `Rise and shine, ${name}.`,
      `Morning, ${name} — let's get after it.`,
      `Hey ${name}, ready for today?`,
      `Let's make it count, ${name}.`
    ],
    afternoon: [
      `Good afternoon, ${name}.`,
      `Afternoon, ${name}.`,
      `How's the day going, ${name}?`,
      `Halfway there, ${name}.`,
      `Keep the momentum going, ${name}.`
    ],
    evening: [
      `Good evening, ${name}.`,
      `Evening, ${name}.`,
      `Winding down, ${name}?`,
      `Nice work today, ${name}.`,
      `Evening check-in, ${name}.`
    ],
    late: [
      `Still going, ${name}.`,
      `Burning the midnight oil, ${name}?`,
      `Late one, ${name}.`,
      `Still up, ${name}? Don't forget to rest.`,
      `Night owl mode, ${name}.`
    ]
  };
  const list = options[bucket];
  return list[Math.floor(Math.random() * list.length)];
}
