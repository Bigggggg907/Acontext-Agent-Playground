/**
 * Acontext integration utilities
 * 
 * Provides:
 * - Semantic search across conversation history
 * - File upload and artifact management
 * - Session management with Acontext
 * - Context editing with automatic token management
 */

import OpenAI from "openai";
import { getAcontextClient } from "@/lib/acontext-client";
import type { ChatSession } from "@/types/chat";

/**
 * Edit strategy types for context editing
 * These match the Acontext SDK's expected format
 */
export type EditStrategy =
  | {
      type: "token_limit";
      params: {
        limit_tokens: number;
      };
    }
  | {
      type: "remove_tool_result";
      params: {
        keep_recent_n_tool_results?: number;
        tool_result_placeholder?: string;
      };
    }
  | {
      type: "remove_tool_call_params";
      params: {
        keep_recent_n_tool_calls?: number;
      };
    };

/**
 * Token count information from Acontext
 */
export interface TokenCounts {
  total_tokens: number;
}

/**
 * Enhanced error logging helper with deep error extraction
 */
async function logAcontextError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const errorDetails: Record<string, unknown> = {
    operation,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Recursively extract error information including cause chain
  function extractErrorInfo(err: unknown, depth = 0): Record<string, unknown> {
    if (depth > 5) return { message: "Error chain too deep" }; // Prevent infinite recursion
    
    const info: Record<string, unknown> = {};
    
    if (err instanceof Error) {
      info.message = err.message;
      info.name = err.name;
      info.stack = err.stack;
      
      // Extract cause recursively
      if (err.cause) {
        info.cause = extractErrorInfo(err.cause, depth + 1);
      }
      
      // Check for Node.js system errors (which have code, errno, syscall, etc.)
      if ('code' in err) {
        info.code = (err as any).code;
      }
      if ('errno' in err) {
        info.errno = (err as any).errno;
      }
      if ('syscall' in err) {
        info.syscall = (err as any).syscall;
      }
      if ('hostname' in err) {
        info.hostname = (err as any).hostname;
      }
      if ('port' in err) {
        info.port = (err as any).port;
      }
      
      // Network error detection
      const errorMsg = err.message.toLowerCase();
      if (
        errorMsg.includes("fetch failed") ||
        errorMsg.includes("econnrefused") ||
        errorMsg.includes("enotfound") ||
        errorMsg.includes("etimedout") ||
        errorMsg.includes("econnreset") ||
        errorMsg.includes("certificate") ||
        errorMsg.includes("ssl") ||
        errorMsg.includes("tls")
      ) {
        errorDetails.type = "network_error";
        
        // Provide specific diagnosis
        if (errorMsg.includes("enotfound")) {
          errorDetails.diagnosis = "DNS resolution failed - cannot resolve hostname";
        } else if (errorMsg.includes("econnrefused")) {
          errorDetails.diagnosis = "Connection refused - server may be down or firewall blocking";
        } else if (errorMsg.includes("etimedout")) {
          errorDetails.diagnosis = "Connection timeout - network may be slow or unreachable";
        } else if (errorMsg.includes("certificate") || errorMsg.includes("ssl") || errorMsg.includes("tls")) {
          errorDetails.diagnosis = "SSL/TLS certificate error - check certificate validity";
        } else {
          errorDetails.diagnosis = "Network request failed - check connectivity, firewall, and proxy settings";
        }
      }
    } else if (err && typeof err === 'object') {
      // Try to extract properties from error-like objects
      try {
        info.rawError = JSON.stringify(err);
      } catch {
        info.rawError = String(err);
      }
    } else {
      info.error = String(err);
    }
    
    return info;
  }

  const errorInfo = extractErrorInfo(error);
  Object.assign(errorDetails, errorInfo);

  // Configuration check
  const apiKey = process.env.ACONTEXT_API_KEY;
  const baseUrl = process.env.ACONTEXT_BASE_URL ?? "https://api.acontext.com/api/v1";
  errorDetails.config = {
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length ?? 0,
    baseUrl,
    nodeVersion: process.version,
    platform: process.platform,
  };

  // URL validation
  try {
    const url = new URL(baseUrl);
    errorDetails.urlValidation = {
      valid: true,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
    };
  } catch (urlError) {
    errorDetails.urlValidation = {
      valid: false,
      error: urlError instanceof Error ? urlError.message : String(urlError),
    };
  }

  // Network environment info
  errorDetails.networkEnv = {
    httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || undefined,
    httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || undefined,
    noProxy: process.env.NO_PROXY || process.env.no_proxy || undefined,
  };

  // If it's a network error, try to test connectivity using SDK (but don't block on it)
  if (errorDetails.type === "network_error") {
    try {
      const client = getAcontextClient();
      if (client) {
        // Test connection by calling a simple SDK method with timeout
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection test timeout")), 5000)
          );
          
          // Test connection using ping() method (as shown in official examples)
          await Promise.race([
            client.ping(),
            timeoutPromise
          ]);
          
          errorDetails.connectionTest = {
            success: true,
            method: "SDK: ping()",
            timestamp: new Date().toISOString(),
          };
        } catch (testError) {
          errorDetails.connectionTest = {
            success: false,
            method: "SDK: ping()",
            error: testError instanceof Error ? testError.message : String(testError),
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        errorDetails.connectionTest = {
          error: "Acontext client not available (missing API key)",
        };
      }
    } catch (testError) {
      errorDetails.connectionTest = {
        error: testError instanceof Error ? testError.message : String(testError),
      };
    }
  }

  console.error(`[Acontext] ${operation}:`, JSON.stringify(errorDetails, null, 2));
}

/**
 * Get or create the default Acontext Space for a user.
 *
 * Strategy:
 * - One long-lived Space per user (stored in user_acontext_spaces table)
 * - All new chat sessions created for this user attach to this Space
 *
 * If Acontext is not configured, returns null and callers should gracefully skip
 * Space attachment (sessions will still work, just without self-learned skills).
 */
export async function getOrCreateUserSpaceId(
  userId: string
): Promise<string | null> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return null;
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 1) Try to load existing mapping
    const { data, error } = await supabase
      .from("user_acontext_spaces")
      .select("space_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn(
        "[Acontext] Failed to load user_acontext_spaces mapping; falling back to session without Space:",
        error.message
      );
      return null;
    }

    if (data?.space_id) {
      return data.space_id as string;
    }

    // 2) Create a new Space for this user
    console.debug("[Acontext] Creating default Space for user", {
      userId,
    });

    const space = await acontext.spaces.create({
      // Optional metadata to aid debugging/inspection
      name: `user-${userId}`,
      description:
        "Default personal Space for self-learned skills and SOPs for this user.",
    } as any);

    const spaceId = (space as any).id as string | undefined;
    if (!spaceId) {
      console.warn(
        "[Acontext] Created Space but response did not include id; skipping mapping"
      );
      return null;
    }

    // 3) Persist mapping (best-effort, non-fatal)
    try {
      const { error: insertError } = await supabase
        .from("user_acontext_spaces")
        .insert({
          user_id: userId,
          space_id: spaceId,
        });

      if (insertError) {
        console.warn(
          "[Acontext] Failed to persist user_acontext_spaces mapping; skills will still learn, but mapping is not cached:",
          insertError.message
        );
      }
    } catch (persistError) {
      console.warn(
        "[Acontext] Unexpected error while persisting user_acontext_spaces mapping:",
        persistError
      );
    }

    return spaceId;
  } catch (error) {
    await logAcontextError(
      "Failed to get or create default user Space",
      error,
      {
        userId,
      }
    );
    return null;
  }
}

/**
 * Get or create an Acontext session for a chat session
 * Returns the Acontext session ID, or null if Acontext is not configured
 *
 * NOTE: This is mostly kept for backwards compatibility; new sessions are created
 * through createAcontextSessionDirectly, which already handles user Space binding.
 */
export async function getOrCreateAcontextSession(
  chatSession: ChatSession,
  userId: string
): Promise<string | null> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return null;
  }

  // If we already have an Acontext session ID, return it
  if (chatSession.acontextSessionId) {
    return chatSession.acontextSessionId;
  }

  // Create a new Acontext session (legacy path, without explicit Space binding)
  try {
    const configs = {
      userId,
      chatSessionId: chatSession.id,
      source: "nextjs-with-supabase-chatbot",
    };
    
    console.debug("[Acontext] Creating session", {
      chatSessionId: chatSession.id,
      userId,
      configs,
    });

    const acontextSession = await acontext.sessions.create({
      configs,
    });

    console.debug("[Acontext] Session created successfully", {
      acontextSessionId: acontextSession.id,
    });

    // Update the chat session with the Acontext session ID
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase
      .from("chat_sessions")
      .update({ acontext_session_id: acontextSession.id })
      .eq("id", chatSession.id);

    return acontextSession.id;
  } catch (error) {
    await logAcontextError("Failed to create Acontext session", error, {
      chatSessionId: chatSession.id,
      userId,
    });
    return null;
  }
}

/**
 * Search for relevant messages in Acontext using semantic search
 * Returns relevant context messages that can be injected into the conversation
 */
export async function searchRelevantContext(
  query: string,
  acontextSessionId?: string,
  limit: number = 5
): Promise<Array<{ role: string; content: string; score?: number }>> {
  const acontext = getAcontextClient();
  if (!acontext || !acontextSessionId) {
    return [];
  }

  try {
    // Get messages from the Acontext session
    // Note: Acontext's semantic search is typically done via the sessions API
    // We'll retrieve recent messages and use them as context
    // For true semantic search, you may need to use Acontext's search API if available
    
    console.debug("[Acontext] Searching relevant context", {
      acontextSessionId,
      query,
      limit,
    });
    
    const messages = await acontext.sessions.getMessages(acontextSessionId, {
      format: "openai",
      limit: limit * 2, // Get more messages to filter
    });

    if (!messages || !messages.items || messages.items.length === 0) {
      console.debug("[Acontext] No messages found in session");
      return [];
    }

    // For now, return recent messages as context
    // In a production system, you'd want to use Acontext's semantic search API
    // to find the most relevant messages based on the query
    const relevantMessages = messages.items
      .slice(-limit)
      .map((msg: any) => ({
        role: msg.role || "user",
        content: typeof msg.content === "string" ? msg.content : String(msg.content),
      }));

    console.debug("[Acontext] Found relevant messages", {
      count: relevantMessages.length,
    });

    return relevantMessages;
  } catch (error) {
    await logAcontextError("Failed to search relevant context", error, {
      acontextSessionId,
      query,
      limit,
    });
    return [];
  }
}

/**
 * Search for relevant skills (SOP blocks) in Acontext Space based on user query
 * Returns relevant skills that can be used during conversation
 */
export async function searchRelevantSkills(
  query: string,
  spaceId: string
): Promise<Array<{
  title: string;
  summary: string;
  content?: string;
  use_when?: string;
  preferences?: string;
}>> {
  const client = getAcontextClient();
  if (!client || !spaceId) {
    return [];
  }

  try {
    console.debug("[Acontext] Searching relevant skills", {
      spaceId,
      query,
    });

    // Use experienceSearch to find relevant SOP blocks
    const searchResult = (await client.spaces.experienceSearch(spaceId, {
      query,
      mode: "fast",
      // No limit - return all relevant skills
    } as any)) as any;

    const blocks = (searchResult?.cited_blocks ?? []) as Array<any>;

    if (!blocks || blocks.length === 0) {
      console.debug("[Acontext] No relevant skills found");
      return [];
    }

    // Map blocks to skills format
    const skills = blocks.map((block: any) => {
      const title: string =
        block.title ||
        block.name ||
        block.props?.title ||
        block.properties?.title ||
        block.metadata?.title ||
        "Untitled skill";

      let summary: string =
        block.summary ||
        block.description ||
        block.props?.summary ||
        block.props?.description ||
        block.properties?.summary ||
        block.properties?.description ||
        block.metadata?.summary ||
        block.metadata?.description ||
        "";

      // If no summary found, try to construct one from SOP-specific fields
      if (!summary) {
        const parts: string[] = [];

        const useWhen =
          block.props?.use_when ||
          block.properties?.use_when ||
          block.use_when;
        if (useWhen) {
          parts.push(`Use when: ${useWhen}`);
        }

        const preferences =
          block.props?.preferences ||
          block.properties?.preferences ||
          block.preferences;
        if (preferences) {
          parts.push(`Preferences: ${preferences}`);
        }

        summary = parts.length > 0 ? parts.join(". ") : "No summary available.";
      }

      const content =
        block.content ||
        block.text ||
        block.props?.content ||
        block.properties?.content;

      return {
        title,
        summary,
        content: typeof content === "string" ? content : undefined,
        use_when:
          block.props?.use_when ||
          block.properties?.use_when ||
          block.use_when,
        preferences:
          block.props?.preferences ||
          block.properties?.preferences ||
          block.preferences,
      };
    });

    console.debug("[Acontext] Found relevant skills", {
      count: skills.length,
    });

    return skills;
  } catch (error) {
    await logAcontextError("Failed to search relevant skills", error, {
      spaceId,
      query,
    });
    return [];
  }
}

/**
 * Upload a file to Acontext as an artifact
 * Returns the artifact path or null if upload fails
 */
export async function uploadFileToAcontext(
  filename: string,
  content: Buffer | string,
  mimeType: string,
  diskId?: string
): Promise<string | null> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return null;
  }

  try {
    // If no diskId provided, list disks and use the first one, or create one
    let targetDiskId = diskId;
    if (!targetDiskId) {
      const disks = await acontext.disks.list();
      if (disks && disks.items && disks.items.length > 0) {
        targetDiskId = disks.items[0].id;
      } else {
        // Create a default disk
        const newDisk = await acontext.disks.create();
        targetDiskId = newDisk.id;
      }
    }

    // Convert content to Buffer if it's a string (base64)
    let fileBuffer: Buffer;
    if (typeof content === "string") {
      // Assume it's base64 encoded
      fileBuffer = Buffer.from(content, "base64");
    } else {
      fileBuffer = content;
    }

    // Upload the artifact
    // The API expects file as [filename, Buffer, contentType] or FileUpload
    console.debug("[Acontext] Uploading artifact", {
      diskId: targetDiskId,
      filename,
      mimeType,
      size: fileBuffer.length,
    });

    const artifact = await acontext.disks.artifacts.upsert(targetDiskId, {
      file: [filename, fileBuffer, mimeType],
    });

    console.debug("[Acontext] Artifact uploaded successfully", {
      artifact: artifact,
    });

    // Return the artifact path
    return (artifact as any).path || filename;
  } catch (error) {
    await logAcontextError("Failed to upload file", error, {
      filename,
      mimeType,
      diskId,
      contentSize: typeof content === "string" ? content.length : content.length,
    });
    return null;
  }
}

/**
 * Recursively list all artifacts from a directory path
 * Helper function for listAcontextArtifacts
 */
async function listArtifactsRecursive(
  acontext: ReturnType<typeof getAcontextClient>,
  diskId: string,
  path: string,
  allArtifacts: Array<{ id?: string; path?: string; filename?: string; mimeType?: string; size?: number; createdAt?: string }> = []
): Promise<Array<{ id?: string; path?: string; filename?: string; mimeType?: string; size?: number; createdAt?: string }>> {
  try {
    // List artifacts and directories in the current path
    const result = await acontext!.disks.artifacts.list(diskId, {
      path: path,
    });

    if (!result) {
      return allArtifacts;
    }

    // Normalize and add files from current directory
    const items = Array.isArray(result.artifacts) ? result.artifacts : [];
    const normalizedArtifacts = items.map((item: any) => ({
      id: item.id || item.path || item.filename,
      path: item.path || item.filename,
      filename: item.filename || item.path?.split('/').pop() || 'unknown',
      mimeType: item.mimeType || item.contentType || 'application/octet-stream',
      size: item.size || item.length || 0,
      createdAt: item.createdAt || item.created_at || item.timestamp,
    }));

    allArtifacts.push(...normalizedArtifacts);

    // Recursively list subdirectories
    const directories = Array.isArray(result.directories) ? result.directories : [];
    for (const directory of directories) {
      // Ensure path ends with / for proper directory traversal
      const dirPath = directory.startsWith('/') ? directory : `${path}${path.endsWith('/') ? '' : '/'}${directory}`;
      const normalizedPath = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
      await listArtifactsRecursive(acontext, diskId, normalizedPath, allArtifacts);
    }

    return allArtifacts;
  } catch (error) {
    console.warn(`[Acontext] Failed to list artifacts from path ${path}:`, error);
    return allArtifacts;
  }
}

/**
 * List artifacts from Acontext Disk (recursively)
 * Returns an array of artifacts or null if listing fails
 */
export async function listAcontextArtifacts(
  diskId?: string
): Promise<Array<{ id?: string; path?: string; filename?: string; mimeType?: string; size?: number; createdAt?: string }> | null> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return null;
  }

  try {
    // If no diskId provided, list disks and use the first one
    let targetDiskId = diskId;
    if (!targetDiskId) {
      const disks = await acontext.disks.list();
      if (disks && disks.items && disks.items.length > 0) {
        targetDiskId = disks.items[0].id;
      } else {
        console.debug("[Acontext] No disks found");
        return [];
      }
    }

    console.debug("[Acontext] Listing artifacts recursively", {
      diskId: targetDiskId,
    });

    // Recursively list all artifacts starting from root
    const allArtifacts = await listArtifactsRecursive(acontext, targetDiskId, "/");

    console.debug("[Acontext] Found artifacts", {
      count: allArtifacts.length,
    });

    return allArtifacts;
  } catch (error) {
    await logAcontextError("Failed to list artifacts", error, {
      diskId,
    });
    return null;
  }
}

/**
 * Store a message in Acontext session
 */
export async function storeMessageInAcontext(
  acontextSessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  format: "openai" | "anthropic" | "gemini" = "openai"
): Promise<boolean> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return false;
  }

  try {
    // Build message blob in the format expected by Acontext
    // For OpenAI format, we can pass a simple object
    const messageBlob: Record<string, unknown> = {
      role,
      content,
    };
    
    console.debug("[Acontext] Storing message", {
      acontextSessionId,
      role,
      contentLength: content.length,
      format,
    });
    
    await acontext.sessions.storeMessage(acontextSessionId, messageBlob, {
      format,
    });
    
    console.debug("[Acontext] Message stored successfully");
    return true;
  } catch (error) {
    await logAcontextError("Failed to store message", error, {
      acontextSessionId,
      role,
      contentLength: content.length,
      format,
    });
    return false;
  }
}

/**
 * Get token counts for an Acontext session
 * Returns token count information or null if unavailable
 */
export async function getAcontextTokenCounts(
  acontextSessionId: string
): Promise<TokenCounts | null> {
  const acontext = getAcontextClient();
  if (!acontext || !acontextSessionId) {
    return null;
  }

  try {
    console.debug("[Acontext] Getting token counts", {
      acontextSessionId,
    });

    const tokenCounts = await acontext.sessions.getTokenCounts(acontextSessionId);

    if (!tokenCounts) {
      console.debug("[Acontext] No token counts available");
      return null;
    }

    console.debug("[Acontext] Token counts retrieved", {
      total_tokens: tokenCounts.total_tokens,
    });

    return {
      total_tokens: tokenCounts.total_tokens || 0,
    };
  } catch (error) {
    await logAcontextError("Failed to get token counts", error, {
      acontextSessionId,
    });
    return null;
  }
}

/**
 * Determine which edit strategies to apply based on token count and message analysis
 * This implements automatic context editing (Plan A)
 * 
 * @param tokenCounts - Current token counts for the session
 * @param messages - Current messages in the session (for tool call analysis)
 * @param config - Configuration for thresholds and strategy parameters
 * @returns Array of edit strategies to apply, or empty array if none needed
 */
export function determineEditStrategies(
  tokenCounts: TokenCounts | null,
  messages: Array<{ role: string; toolCalls?: unknown }>,
  config?: {
    tokenLimitThreshold?: number; // Default: 80% of model limit
    tokenLimitTarget?: number; // Default: 70% of model limit
    toolResultThreshold?: number; // Default: 5 tool results
    toolCallThreshold?: number; // Default: 10 tool calls
  }
): EditStrategy[] {
  const strategies: EditStrategy[] = [];

  // Default configuration
  const tokenLimitThreshold = config?.tokenLimitThreshold ?? 80000; // 80K tokens (80% of 100K model)
  const tokenLimitTarget = config?.tokenLimitTarget ?? 70000; // 70K tokens (70% of 100K model)
  const toolResultThreshold = config?.toolResultThreshold ?? 5;
  const toolCallThreshold = config?.toolCallThreshold ?? 10;

  // If no token counts available, skip automatic strategies
  if (!tokenCounts || tokenCounts.total_tokens === 0) {
    return strategies;
  }

  // Count tool calls and tool results in messages
  let toolCallCount = 0;
  let toolResultCount = 0;
  
  for (const msg of messages) {
    if (msg.toolCalls) {
      const toolCalls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [msg.toolCalls];
      toolCallCount += toolCalls.length;
    }
    if (msg.role === "tool") {
      toolResultCount++;
    }
  }

  console.debug("[Acontext] Analyzing context for edit strategies", {
    total_tokens: tokenCounts.total_tokens,
    tokenLimitThreshold,
    toolCallCount,
    toolResultCount,
  });

  // Strategy 1: Apply token_limit if exceeding threshold
  if (tokenCounts.total_tokens > tokenLimitThreshold) {
    strategies.push({
      type: "token_limit",
      params: {
        limit_tokens: tokenLimitTarget,
      },
    });
    console.debug("[Acontext] Auto-applying token_limit strategy", {
      limit_tokens: tokenLimitTarget,
    });
  }

  // Strategy 2: Apply remove_tool_result if many tool results exist
  // Only apply if we haven't already applied token_limit (to avoid double-processing)
  if (toolResultCount > toolResultThreshold && strategies.length === 0) {
    strategies.push({
      type: "remove_tool_result",
      params: {
        keep_recent_n_tool_results: Math.max(3, Math.floor(toolResultThreshold / 2)),
        tool_result_placeholder: "Done",
      },
    });
    console.debug("[Acontext] Auto-applying remove_tool_result strategy", {
      keep_recent_n_tool_results: Math.max(3, Math.floor(toolResultThreshold / 2)),
    });
  }

  // Strategy 3: Apply remove_tool_call_params if many tool calls exist
  // Only apply if we haven't already applied other strategies
  if (toolCallCount > toolCallThreshold && strategies.length === 0) {
    strategies.push({
      type: "remove_tool_call_params",
      params: {
        keep_recent_n_tool_calls: Math.max(3, Math.floor(toolCallThreshold / 2)),
      },
    });
    console.debug("[Acontext] Auto-applying remove_tool_call_params strategy", {
      keep_recent_n_tool_calls: Math.max(3, Math.floor(toolCallThreshold / 2)),
    });
  }

  return strategies;
}

/**
 * Load messages from Acontext session
 * Returns messages in ChatMessage format
 * Supports optional edit strategies for context editing
 * 
 * @param acontextSessionId - The Acontext session ID
 * @param editStrategies - Optional array of edit strategies to apply (on-the-fly editing, doesn't modify storage)
 * @returns Array of chat messages
 */
export async function loadMessagesFromAcontext(
  acontextSessionId: string,
  editStrategies?: EditStrategy[]
): Promise<Array<{
  id?: string;
  sessionId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date | string;
  toolCalls?: import("@/types/chat").ToolInvocation[];
}>> {
  const acontext = getAcontextClient();
  if (!acontext || !acontextSessionId) {
    return [];
  }

  try {
    console.debug("[Acontext] Loading messages", {
      acontextSessionId,
      editStrategies: editStrategies?.length || 0,
    });
    
    // Build options with optional edit strategies
    const options: {
      format: "openai" | "anthropic" | "gemini" | "acontext";
      editStrategies?: EditStrategy[];
    } = {
      format: "openai",
    };

    if (editStrategies && editStrategies.length > 0) {
      options.editStrategies = editStrategies;
      console.debug("[Acontext] Applying edit strategies", {
        strategies: editStrategies.map((s) => s.type),
      });
    }
    
    const messages = await acontext.sessions.getMessages(acontextSessionId, options);

    if (!messages || !messages.items || messages.items.length === 0) {
      console.debug("[Acontext] No messages found in session");
      return [];
    }

    // Convert Acontext messages to ChatMessage format
    const chatMessages = messages.items.map((msg: any, index: number) => {
      // Extract content - handle both string and array formats
      let content: string;
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        // For Vision API format, convert to string representation
        content = JSON.stringify(msg.content);
      } else {
        content = String(msg.content);
      }

      return {
        id: msg.id || `acontext-${index}`,
        sessionId: acontextSessionId,
        role: (msg.role || "user") as "user" | "assistant" | "system",
        content,
        createdAt: msg.created_at || msg.timestamp || new Date(),
        toolCalls: msg.tool_calls || undefined,
      };
    });

    console.debug("[Acontext] Loaded messages", {
      count: chatMessages.length,
      strategiesApplied: editStrategies?.length || 0,
    });

    return chatMessages;
  } catch (error) {
    await logAcontextError("Failed to load messages", error, {
      acontextSessionId,
      editStrategies: editStrategies?.map((s) => s.type),
    });
    return [];
  }
}

/**
 * Create a new Acontext session directly (without Supabase chat_sessions table)
 * Returns the Acontext session ID and creates a minimal mapping in Supabase
 */
export async function createAcontextSessionDirectly(
  userId: string,
  title?: string
): Promise<{ acontextSessionId: string; sessionId: string } | null> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return null;
  }

  try {
    // Resolve (or lazily create) the user's default Space for skill learning
    const spaceId = await getOrCreateUserSpaceId(userId);

    // Create session in Acontext with userId in configs and optional space binding
    const configs = {
      userId,
      source: "nextjs-with-supabase-chatbot",
    };
    
    console.debug("[Acontext] Creating session directly", {
      userId,
      configs,
      spaceId,
    });

    const sessionCreatePayload: Record<string, unknown> = {
      configs,
    };

    if (spaceId) {
      // Attach this session to the user's long-lived Space so completed tasks
      // can be learned as reusable skills/SOPs.
      (sessionCreatePayload as any).spaceId = spaceId;
    }

    const acontextSession = await acontext.sessions.create(
      sessionCreatePayload as any
    );

    console.debug("[Acontext] Session created successfully", {
      acontextSessionId: acontextSession.id,
    });

    // Create a dedicated Disk for this session
    let diskId: string | undefined;
    try {
      const disk = await acontext.disks.create();
      diskId = disk.id;
      console.debug("[Acontext] Created dedicated disk for session", {
        diskId,
        acontextSessionId: acontextSession.id,
      });
    } catch (error) {
      await logAcontextError("Failed to create disk for session", error, {
        acontextSessionId: acontextSession.id,
        userId,
      });
      // Continue without disk - session will still work
    }

    // Store minimal mapping in Supabase (only for querying/sorting)
    // Use acontext_session_id as the primary identifier
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Insert into chat_sessions with acontext_session_id as the primary key
    // We'll use acontext_session_id as the session ID for the frontend
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        id: acontextSession.id, // Use Acontext session ID as our session ID
        user_id: userId,
        acontext_session_id: acontextSession.id,
        acontext_space_id: spaceId ?? null,
        acontext_disk_id: diskId,
        title: title || "New Chat",
      })
      .select()
      .single();

    if (error) {
      console.warn("[Acontext] Failed to store mapping in Supabase:", error.message);
      // Continue anyway - the session exists in Acontext
    }

    return {
      acontextSessionId: acontextSession.id,
      sessionId: acontextSession.id, // Use Acontext session ID as session ID
    };
  } catch (error) {
    await logAcontextError("Failed to create Acontext session directly", error, {
      userId,
      title,
    });
    return null;
  }
}

/**
 * Delete an Acontext session
 */
export async function deleteAcontextSession(
  acontextSessionId: string
): Promise<boolean> {
  const acontext = getAcontextClient();
  if (!acontext) {
    return false;
  }

  try {
    console.debug("[Acontext] Deleting session", {
      acontextSessionId,
    });

    // Try to delete from Acontext (if API supports it)
    // Note: Acontext SDK might not have a delete method, so we'll just remove from Supabase
    // The session in Acontext will remain but won't be accessible through our app
    
    // For now, we'll just remove the mapping from Supabase
    // If Acontext SDK supports deletion, we can add it here
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("acontext_session_id", acontextSessionId);

    if (error) {
      console.warn("[Acontext] Failed to delete mapping from Supabase:", error.message);
      return false;
    }

    console.debug("[Acontext] Session deleted successfully");
    return true;
  } catch (error) {
    await logAcontextError("Failed to delete Acontext session", error, {
      acontextSessionId,
    });
    return false;
  }
}

