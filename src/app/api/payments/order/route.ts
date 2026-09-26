import { paymentHandler } from "@/lib/payments";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return paymentHandler(request, "order"); }
