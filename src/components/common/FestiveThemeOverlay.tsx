import React, { useEffect, useMemo, useState } from 'react';

type FestiveTheme = { mode?: 'automatic' | 'manual' | 'normal'; festival?: string };

const FESTIVALS: Record<string, { label: string; symbols: string; message: string; tone: string }> = {
  natal: { label: 'Natal', symbols: '❄️  ✨  🎄', message: 'Boas Festas', tone: 'from-emerald-500/20 via-amber-300/10 to-transparent' },
  'ano-novo': { label: 'Ano Novo', symbols: '✨  🎆  ✨', message: 'Um excelente Ano Novo', tone: 'from-amber-300/20 via-yellow-200/10 to-transparent' },
  carnaval: { label: 'Carnaval', symbols: '🎭  🎉  🎊', message: 'Celebre o Carnaval', tone: 'from-fuchsia-500/20 via-amber-300/10 to-transparent' },
  pascoa: { label: 'Páscoa', symbols: '🐣  🌷  🕊️', message: 'Boa Páscoa', tone: 'from-emerald-400/20 via-yellow-200/10 to-transparent' },
  'santos-populares': { label: 'Santos Populares', symbols: '🎏  🌿  🎉', message: 'Viva os Santos Populares', tone: 'from-red-500/15 via-emerald-400/10 to-transparent' },
  halloween: { label: 'Halloween', symbols: '🎃  👻  ✨', message: 'Uma noite assustadoramente boa', tone: 'from-orange-500/20 via-violet-500/10 to-transparent' },
};

function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  return new Date(year, Math.floor(n / 31) - 1, (n % 31) + 1);
}

function automaticFestival(now = new Date()): string {
  const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
  if (month === 12 && day >= 1) return 'natal';
  if (month === 1 && day <= 7) return 'ano-novo';
  const easter = easterSunday(year);
  const carnivalTuesday = new Date(easter); carnivalTuesday.setDate(easter.getDate() - 47);
  const carnivalStart = new Date(carnivalTuesday); carnivalStart.setDate(carnivalTuesday.getDate() - 4);
  const carnivalEnd = new Date(carnivalTuesday); carnivalEnd.setDate(carnivalTuesday.getDate() + 1);
  const easterStart = new Date(easter); easterStart.setDate(easter.getDate() - 2);
  const easterEnd = new Date(easter); easterEnd.setDate(easter.getDate() + 1);
  const date = new Date(year, month - 1, day);
  if (date >= carnivalStart && date <= carnivalEnd) return 'carnaval';
  if (date >= easterStart && date <= easterEnd) return 'pascoa';
  if (month === 6) return 'santos-populares';
  if (month === 10 && day >= 25 || month === 11 && day <= 1) return 'halloween';
  return '';
}

export const FestiveThemeOverlay: React.FC = () => {
  const [theme, setTheme] = useState<FestiveTheme>({ mode: 'automatic' });

  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings/public-theme', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.theme) setTheme(result.theme); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const festival = useMemo(() => {
    if (theme.mode === 'normal') return '';
    return theme.mode === 'manual' ? (theme.festival || '') : automaticFestival();
  }, [theme]);

  const activeFestival = FESTIVALS[festival];
  if (!activeFestival) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80]" aria-label={`Tema festivo: ${activeFestival.label}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${activeFestival.tone} via-[#D4AF37] to-transparent`} />
      <div className="absolute right-3 top-2 sm:right-5 sm:top-3 rounded-full border border-[#D4AF37]/35 bg-[#081322]/90 px-3 py-1.5 shadow-lg shadow-black/20 backdrop-blur-md">
        <span className="mr-1.5 text-sm">{activeFestival.symbols}</span>
        <span className="text-[10px] font-semibold tracking-wide text-amber-100 sm:text-xs">{activeFestival.message}</span>
      </div>
      <div className={`absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b ${activeFestival.tone} to-transparent opacity-70`} />
    </div>
  );
};
