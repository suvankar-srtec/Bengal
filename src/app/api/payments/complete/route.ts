export async function POST() {
  return Response.json({ error: "Online payments are not enabled. Choose Cash or Bank transfer after registration." }, { status: 410 });
}
