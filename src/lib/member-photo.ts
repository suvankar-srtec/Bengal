export function memberPhotoDataUri(name: string, seed = 0) {
  const backgrounds = ["#FCE8E3","#E8F0FE","#E6F4EA","#FFF4CE","#F3E8FD","#E8F5F8","#FDECEC","#EDF2F7"];
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "M";
  const background = backgrounds[Math.abs(seed) % backgrounds.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="${background}"/>
      <circle cx="120" cy="91" r="43" fill="#D8B39B"/>
      <path d="M58 214c6-52 31-78 62-78s56 26 62 78" fill="#183149"/>
      <circle cx="104" cy="86" r="4" fill="#183149"/>
      <circle cx="136" cy="86" r="4" fill="#183149"/>
      <path d="M106 108c9 8 19 8 28 0" fill="none" stroke="#9A5F4A" stroke-width="4" stroke-linecap="round"/>
      <rect x="156" y="16" width="64" height="38" rx="19" fill="#FFFFFF" opacity=".9"/>
      <text x="188" y="41" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="700" fill="#183149">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
