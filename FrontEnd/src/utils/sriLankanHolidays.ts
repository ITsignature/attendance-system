export interface Holiday {
  date: string;
  name: string;
  type: 'public' | 'bank' | 'mercantile' | 'poya';
}

export interface HolidayRule {
  name: string;
  type: 'public' | 'bank' | 'mercantile' | 'poya';
  getDate: (year: number) => Date | Date[];
}

// Utility functions for date calculations
const getEaster = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  return new Date(year, n - 1, p + 1);
};

// Note: These are approximations. For exact dates, lunar/astronomical calculations are needed
const getFullMoonDates = (year: number): Date[] => {
  // This is a simplified calculation. In practice, you'd use a lunar calendar library
  const baseDates = [
    new Date(year, 0, 13), // January - Duruthu
    new Date(year, 1, 12), // February - Navam  
    new Date(year, 2, 13), // March - Medin
    new Date(year, 3, 12), // April - Bak
    new Date(year, 4, 12), // May - Vesak
    new Date(year, 5, 10), // June - Poson
    new Date(year, 6, 10), // July - Esala
    new Date(year, 7, 8),  // August - Nikini
    new Date(year, 8, 7),  // September - Binara
    new Date(year, 9, 6),  // October - Vap
    new Date(year, 10, 5), // November - Ill
    new Date(year, 11, 4), // December - Unduvap
  ];
  
  return baseDates;
};

// Islamic calendar dates - these need proper calculation based on lunar calendar
const getIslamicHolidayDates = (year: number) => {
  // These are approximate and should be calculated using proper Islamic calendar
  // For production, use a proper Islamic calendar library
  return {
    idUlFitr: new Date(year, 2, 31), // Approximate - varies by lunar calendar
    idUlAlha: new Date(year, 5, 7),  // Approximate - varies by lunar calendar
    miladUnNabi: new Date(year, 8, 5), // Approximate - varies by lunar calendar
  };
};

// Holiday calculation rules
export const holidayRules: HolidayRule[] = [
  {
    name: "New Year's Day",
    type: "public",
    getDate: (year) => new Date(year, 0, 1),
  },
  {
    name: "Duruthu Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[0],
  },
  {
    name: "Tamil Thai Pongal Day",
    type: "mercantile",
    getDate: (year) => new Date(year, 0, 14),
  },
  {
    name: "Independence Day",
    type: "mercantile",
    getDate: (year) => new Date(year, 1, 4),
  },
  {
    name: "Navam Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[1],
  },
  {
    name: "Mahasivarathri Day",
    type: "public",
    getDate: (year) => new Date(year, 1, 26), // Approximate - varies by lunar calendar
  },
  {
    name: "Medin Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[2],
  },
  {
    name: "Id-Ul-Fitr (Ramazan Festival Day)",
    type: "public",
    getDate: (year) => getIslamicHolidayDates(year).idUlFitr,
  },
  {
    name: "Bak Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[3],
  },
  {
    name: "Day prior to Sinhala & Tamil New Year",
    type: "mercantile",
    getDate: (year) => new Date(year, 3, 13),
  },
  {
    name: "Sinhala & Tamil New Year Day",
    type: "mercantile",
    getDate: (year) => new Date(year, 3, 14),
  },
  {
    name: "Good Friday",
    type: "public",
    getDate: (year) => {
      const easter = getEaster(year);
      easter.setDate(easter.getDate() - 2);
      return easter;
    },
  },
  {
    name: "May Day (International Workers' Day)",
    type: "mercantile",
    getDate: (year) => new Date(year, 4, 1),
  },
  {
    name: "Vesak Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[4],
  },
  {
    name: "Day following Vesak Full Moon Poya Day",
    type: "mercantile",
    getDate: (year) => {
      const vesak = getFullMoonDates(year)[4];
      vesak.setDate(vesak.getDate() + 1);
      return vesak;
    },
  },
  {
    name: "Id-Ul-Alha (Hadji Festival Day)",
    type: "public",
    getDate: (year) => getIslamicHolidayDates(year).idUlAlha,
  },
  {
    name: "Poson Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[5],
  },
  {
    name: "Esala Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[6],
  },
  {
    name: "Nikini Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[7],
  },
  {
    name: "Milad-Un-Nabi (Holy Prophet's Birthday)",
    type: "mercantile",
    getDate: (year) => getIslamicHolidayDates(year).miladUnNabi,
  },
  {
    name: "Binara Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[8],
  },
  {
    name: "Vap Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[9],
  },
  {
    name: "Deepavali Festival Day",
    type: "public",
    getDate: (year) => new Date(year, 9, 20), // Approximate - varies by lunar calendar
  },
  {
    name: "Ill Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[10],
  },
  {
    name: "Unduvap Full Moon Poya Day",
    type: "poya",
    getDate: (year) => getFullMoonDates(year)[11],
  },
  {
    name: "Christmas Day",
    type: "mercantile",
    getDate: (year) => new Date(year, 11, 25),
  },
];

export const generateHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];
  
  holidayRules.forEach(rule => {
    const date = rule.getDate(year);
    if (Array.isArray(date)) {
      date.forEach(d => {
        holidays.push({
          date: d.toISOString().split('T')[0],
          name: rule.name,
          type: rule.type,
        });
      });
    } else {
      holidays.push({
        date: date.toISOString().split('T')[0],
        name: rule.name,
        type: rule.type,
      });
    }
  });
  
  return holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getCurrentYearHolidays = (): Holiday[] => {
  const currentYear = new Date().getFullYear();
  return generateHolidaysForYear(currentYear);
};

export const getHolidaysForYear = (year: number): Holiday[] => {
  return generateHolidaysForYear(year);
};