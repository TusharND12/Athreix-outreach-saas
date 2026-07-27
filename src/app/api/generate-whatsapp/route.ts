import { handleOutreachPost } from "@/app/api/outreach/route";

export async function POST(request: Request) {
  return handleOutreachPost(request, "WHATSAPP");
}
