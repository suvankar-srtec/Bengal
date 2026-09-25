import { NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json(
    { error: "Event pricing is fixed when the event is created." },
    { status: 410 },
  );
}
