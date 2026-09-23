import { z } from "zod";

export const EVENT = {
  id: "aalap-alochona-2026-09-29",
  name: "Aalap Alochona",
  date: "2026-09-29",
} as const;

// Store and calculate money in paise, never floating-point rupees.
export const PRICES = {
  participation: 118000,
  standee: 295000,
  presentation: 3540000,
} as const;

export const LIMITS = { participation: 20, standee: 10 } as const;

export const registrationSchema = z.object({
  submissionId: z.uuid(),
  memberName: z.string().trim().min(2, "Enter your full name.").max(120, "Use 120 characters or fewer."),
  email: z.email("Enter a valid email address.").max(254).transform((email) => email.toLowerCase()),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  billingDetails: z.string().trim().toUpperCase().regex(
    /^(?:[A-Z]{5}[0-9]{4}[A-Z]|[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])$/,
    "Enter a valid 10-character PAN or 15-character GSTIN.",
  ),
  participationQuantity: z.number().int().min(1).max(LIMITS.participation),
  standeeQuantity: z.number().int().min(0).max(LIMITS.standee),
  lunchDinnerSelected: z.boolean().default(false),
  presentationSelected: z.boolean(),
  additionalParticipantNames: z.array(
    z.string().trim().min(2, "Enter the participant’s full name.").max(120, "Use 120 characters or fewer."),
  ).max(LIMITS.participation - 1).default([]),
}).superRefine((data, context) => {
  if (data.additionalParticipantNames.length !== data.participationQuantity - 1) {
    context.addIssue({ code: "custom", path: ["additionalParticipantNames"], message: "Provide one name for every participant selected." });
  }
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type RegistrationFieldKey = keyof RegistrationInput | `participantName${number}`;
export type FieldErrors = Partial<Record<RegistrationFieldKey, string>>;

export function registrationFieldKey(path: readonly PropertyKey[]): RegistrationFieldKey {
  return path[0] === "additionalParticipantNames"
    ? `participantName${typeof path[1] === "number" ? path[1] + 2 : 2}`
    : String(path[0]) as RegistrationFieldKey;
}
export type RegistrationReceipt = {
  id: string;
  reference: string;
  totalPaise: number;
  paymentStatus: "unpaid" | "paid" | "refunded";
};

export function calculateTotal(input: Pick<RegistrationInput, "participationQuantity" | "standeeQuantity" | "presentationSelected">) {
  return input.participationQuantity * PRICES.participation
    + input.standeeQuantity * PRICES.standee
    + (input.presentationSelected ? PRICES.presentation : 0);
}

export function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 2,
  }).format(paise / 100);
}
