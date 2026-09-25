export type DemoMemberProfile = {
  id: string;
  primaryName: string;
  participantNames: string[];
  email: string;
  phone: string;
  billingDetails: string;
  photo: string;
};

const AVATAR_BACKGROUNDS = [
  "#FCE8E3",
  "#E8F0FE",
  "#E6F4EA",
  "#FFF4CE",
  "#F3E8FD",
  "#E8F5F8",
  "#FDECEC",
  "#EDF2F7",
  "#F7EDE2",
  "#E9ECF8",
];

export function memberPhotoDataUri(name: string, index = 0) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";

  const background = AVATAR_BACKGROUNDS[Math.abs(index) % AVATAR_BACKGROUNDS.length];
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

const baseProfiles = [
  {
    id: "amit-sen",
    primaryName: "Amit Sen",
    participantNames: ["Riya Sen", "Arjun Sen"],
    email: "amit.sen@example.com",
    phone: "9000000001",
    billingDetails: "ABCDE1234F",
  },
  {
    id: "priya-sharma",
    primaryName: "Priya Sharma",
    participantNames: ["Rohan Sharma", "Neha Sharma", "Kunal Sharma"],
    email: "priya.sharma@example.com",
    phone: "9000000002",
    billingDetails: "BCDEF2345G",
  },
  {
    id: "rahul-mehta",
    primaryName: "Rahul Mehta",
    participantNames: ["Sneha Mehta", "Aditya Mehta"],
    email: "rahul.mehta@example.com",
    phone: "9000000003",
    billingDetails: "CDEFG3456H",
  },
  {
    id: "ananya-das",
    primaryName: "Ananya Das",
    participantNames: ["Sourav Das", "Mitali Das", "Ishaan Das"],
    email: "ananya.das@example.com",
    phone: "9000000004",
    billingDetails: "DEFGH4567J",
  },
  {
    id: "siddharth-roy",
    primaryName: "Siddharth Roy",
    participantNames: ["Poulomi Roy", "Aniket Roy"],
    email: "siddharth.roy@example.com",
    phone: "9000000005",
    billingDetails: "EFGHJ5678K",
  },
  {
    id: "neha-kapoor",
    primaryName: "Neha Kapoor",
    participantNames: ["Ritesh Kapoor", "Meera Kapoor", "Aarav Kapoor"],
    email: "neha.kapoor@example.com",
    phone: "9000000006",
    billingDetails: "FGHJK6789L",
  },
  {
    id: "arindam-ghosh",
    primaryName: "Arindam Ghosh",
    participantNames: ["Tanushree Ghosh", "Ritwik Ghosh"],
    email: "arindam.ghosh@example.com",
    phone: "9000000007",
    billingDetails: "GHJKL7890M",
  },
  {
    id: "pooja-agarwal",
    primaryName: "Pooja Agarwal",
    participantNames: ["Nitin Agarwal", "Rhea Agarwal", "Vivaan Agarwal"],
    email: "pooja.agarwal@example.com",
    phone: "9000000008",
    billingDetails: "HJKLM8901N",
  },
  {
    id: "vikram-bose",
    primaryName: "Vikram Bose",
    participantNames: ["Tania Bose", "Debojit Bose"],
    email: "vikram.bose@example.com",
    phone: "9000000009",
    billingDetails: "JKLMN9012P",
  },
  {
    id: "meghna-iyer",
    primaryName: "Meghna Iyer",
    participantNames: ["Karthik Iyer", "Diya Iyer", "Nikhil Iyer"],
    email: "meghna.iyer@example.com",
    phone: "9000000010",
    billingDetails: "KLMNP0123Q",
  },
] as const;

export const DEMO_MEMBER_PROFILES: DemoMemberProfile[] = baseProfiles.map((profile, index) => ({
  ...profile,
  participantNames: [...profile.participantNames],
  photo: memberPhotoDataUri(profile.primaryName, index),
}));
