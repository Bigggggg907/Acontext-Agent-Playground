import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/types/chat";
import { formatErrorResponse } from "@/lib/chat-errors";
import { loadMessages } from "@/lib/chat-session";
import { getAcontextTokenCounts } from "@/lib/acontext-integration";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/chat-sessions/[id]/messages - List messages for a specific session
 *
 * Notes:
 * - Messages are loaded from Acontext
 * - id is now the Acontext session ID directly
 * - If the session has no messages yet, return an empty array (no "Session not found" error).
 * - Access is enforced by verifying the session belongs to the authenticated user.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    // Next.js 15+ wraps params in a Promise; await to unwrap
    const { id } = await params; // This is now the Acontext session ID
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        formatErrorResponse(new Error("Authentication required"), false),
        { status: 401 }
      );
    }

    // Verify the session belongs to the authenticated user
    const { data: sessionData, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", id) // id is now acontext_session_id
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError || !sessionData) {
      // Session not found or doesn't belong to user, return empty array
      return NextResponse.json({ messages: [] });
    }

    // Load messages from Acontext (with automatic context editing strategies applied)
    const messages = await loadMessages(id);

    // Get current token counts for the session (for UI display)
    let tokenCounts: { total_tokens: number } | undefined;
    const counts = await getAcontextTokenCounts(id);
    if (counts) {
      tokenCounts = counts;
    }

    return NextResponse.json({ messages, tokenCounts });
  } catch (error) {
    return NextResponse.json(formatErrorResponse(error, false), {
      status: 500,
    });
  }
}


