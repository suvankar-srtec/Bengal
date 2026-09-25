export type DemoMemberProfile = {
  id: string;
  primaryName: string;
  participantNames: string[];
  email: string;
  phone: string;
  billingDetails: string;
};

export const DEMO_MEMBER_PROFILES: DemoMemberProfile[] = [
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
];
