import { paymentHandler } from "@/lib/payments";
export const runtime = "nodejs";
export async function POST(request: Request) { return paymentHandler(request, "complete"); }
