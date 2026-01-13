/**
 * Acontext Experience Search Tool
 * 
 * Exposes experienceSearch as a tool that agent can call to search for learned skills
 * before executing tool calls.
 */

import { getAcontextClient } from "@/lib/acontext-client";
import { getOrCreateUserSpaceId } from "@/lib/acontext-integration";

export type ExperienceSearchToolArgs = {
  /**
   * Search query to find relevant learned skills (SOP blocks) in the user's Space.
   * This should describe the task or problem you're trying to solve.
   * Example: "how to create a React component" or "file upload task"
   */
  query: string;
};

/**
 * Tool schema for the Acontext Experience Search.
 * This allows the agent to search for learned skills before executing tool calls.
 */
export const getExperienceSearchToolSchema = {
  type: "function" as const,
  function: {
    name: "experience_search",
    description:
      "Search for learned skills and procedures from past successful task completions. Use this tool BEFORE executing other tool calls to check if there are existing learned skills that can help with the current task. This searches the user's Space for SOP blocks (learned skills) that match your query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query describing the task or problem. This will be used to find relevant learned skills. Be specific about what you're trying to accomplish.",
        },
      },
      required: ["query"],
    },
  },
};

/**
 * Execute an experience search to find relevant learned skills
 */
export async function runExperienceSearch(
  args: ExperienceSearchToolArgs,
  userId: string
): Promise<{
  skills: Array<{
    title: string;
    summary: string;
    content?: string;
    use_when?: string;
    preferences?: string;
  }>;
  query: string;
  count: number;
}> {
  const client = getAcontextClient();
  if (!client) {
    return {
      skills: [],
      query: args.query,
      count: 0,
    };
  }

  if (!args?.query || typeof args.query !== "string") {
    throw new Error("Query must be a non-empty string");
  }

  const trimmedQuery = args.query.trim();
  if (!trimmedQuery) {
    throw new Error("Query must be a non-empty string");
  }

  try {
    // Get or create user's Space
    const spaceId = await getOrCreateUserSpaceId(userId);
    if (!spaceId) {
      console.warn("[ExperienceSearch] No Space found for user");
      return {
        skills: [],
        query: trimmedQuery,
        count: 0,
      };
    }

    console.debug("[ExperienceSearch] Searching for learned skills", {
      spaceId,
      query: trimmedQuery,
    });

    // Use experienceSearch to find relevant SOP blocks
    const searchResult = (await client.spaces.experienceSearch(spaceId, {
      query: trimmedQuery,
      mode: "fast",
    } as any)) as any;

    const blocks = (searchResult?.cited_blocks ?? []) as Array<any>;

    if (!blocks || blocks.length === 0) {
      console.debug("[ExperienceSearch] No relevant skills found");
      return {
        skills: [],
        query: trimmedQuery,
        count: 0,
      };
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

    console.debug("[ExperienceSearch] Found relevant skills", {
      count: skills.length,
      query: trimmedQuery,
    });

    return {
      skills,
      query: trimmedQuery,
      count: skills.length,
    };
  } catch (error) {
    console.error(
      "[ExperienceSearch] Failed to search for learned skills:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      skills: [],
      query: trimmedQuery,
      count: 0,
    };
  }
}

/**
 * Check if a tool name is the experience search tool
 */
export function isExperienceSearchToolName(name: string): boolean {
  return name === "experience_search";
}

