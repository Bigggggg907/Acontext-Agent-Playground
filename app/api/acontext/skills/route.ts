import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAcontextClient } from "@/lib/acontext-client";

type SkillItem = {
  title: string;
  summary: string;
  createdAt: string;
};

type SkillsResponse =
  | {
      learnedCount: number;
      skills: SkillItem[];
    }
  | {
      learnedCount: 0;
      skills: [];
      disabledReason: string;
    };

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    const client = getAcontextClient();
    if (!client) {
      const body: SkillsResponse = {
        learnedCount: 0,
        skills: [],
        disabledReason: "Acontext is not configured.",
      };
      return NextResponse.json(body);
    }

    // Look up the user's Space mapping
    const { data: spaceRow, error: spaceError } = await supabase
      .from("user_acontext_spaces")
      .select("space_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (spaceError) {
      console.warn(
        "[Acontext Skills] Failed to load user_acontext_spaces mapping:",
        spaceError.message
      );
      const body: SkillsResponse = {
        learnedCount: 0,
        skills: [],
        disabledReason:
          "Failed to load Space mapping. Please try again later.",
      };
      return NextResponse.json(body, { status: 200 });
    }

    if (!spaceRow?.space_id) {
      const body: SkillsResponse = {
        learnedCount: 0,
        skills: [],
        disabledReason: "No Acontext Space found for this user yet.",
      };
      return NextResponse.json(body, { status: 200 });
    }

    const spaceId = spaceRow.space_id as string;

    // Try multiple methods to retrieve learned skills (SOP blocks).
    // According to Acontext docs, learned skills are stored as SOP blocks in the Space.
    try {
      let blocks: any[] = [];
      let methodUsed = "";

      // Method 1: Try client.blocks.list (if available in SDK)
      if ((client as any).blocks?.list) {
        try {
          methodUsed = "client.blocks.list";
          const blocksResult = await (client as any).blocks.list(spaceId, {
            type: "sop",
          });
          blocks = blocksResult?.blocks ?? blocksResult?.items ?? [];
          console.debug(`[Acontext Skills] Using ${methodUsed}, found ${blocks.length} blocks`);
        } catch (e) {
          console.debug(`[Acontext Skills] ${methodUsed} failed, trying next method`);
        }
      }

      // Method 2: Try client.spaces.blocks.list
      if (blocks.length === 0 && (client.spaces as any).blocks?.list) {
        try {
          methodUsed = "client.spaces.blocks.list";
          const blocksResult = await (client.spaces as any).blocks.list(spaceId, {
            type: "sop",
          });
          blocks = blocksResult?.blocks ?? blocksResult?.items ?? [];
          console.debug(`[Acontext Skills] Using ${methodUsed}, found ${blocks.length} blocks`);
        } catch (e) {
          console.debug(`[Acontext Skills] ${methodUsed} failed, trying next method`);
        }
      }

      // Method 3: Fallback to experienceSearch with generic query
      if (blocks.length === 0) {
        try {
          methodUsed = "experienceSearch (fallback)";
          const searchResult = (await client.spaces.experienceSearch(spaceId, {
            query: "skills procedures workflows",
            mode: "fast",
            // No limit - return all relevant skills
          } as any)) as any;

          // experienceSearch returns cited_blocks, not experiences
          blocks = (searchResult?.cited_blocks ?? []) as Array<any>;
          console.debug(`[Acontext Skills] Using ${methodUsed}, found ${blocks.length} blocks`);
        } catch (e) {
          console.debug(`[Acontext Skills] ${methodUsed} failed`);
        }
      }

      // Map blocks to skills (return all, no limit)
      const skills: SkillItem[] = blocks.map((block: any) => {
        // Extract title from block properties or metadata
        const title: string =
          block.title ||
          block.name ||
          block.props?.title ||
          block.properties?.title ||
          block.metadata?.title ||
          "Untitled skill";
        
        // Extract summary/description from block properties
        // SOP blocks contain: use_when, preferences, tool_sops
        let summary: string = "";
        
        // Try to get summary from various sources
        summary = 
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
          
          // Add use_when (when to use this skill)
          const useWhen = 
            block.props?.use_when ||
            block.properties?.use_when ||
            block.use_when;
          if (useWhen) {
            parts.push(`Use when: ${useWhen}`);
          }
          
          // Add preferences
          const preferences = 
            block.props?.preferences ||
            block.properties?.preferences ||
            block.preferences;
          if (preferences) {
            parts.push(`Preferences: ${preferences}`);
          }
          
          // Add tool_sops count if available
          const toolSops = 
            block.props?.tool_sops ||
            block.properties?.tool_sops ||
            block.tool_sops;
          if (Array.isArray(toolSops) && toolSops.length > 0) {
            parts.push(`${toolSops.length} tool step${toolSops.length > 1 ? 's' : ''}`);
          }
          
          // Add content/text if available (first 100 chars)
          const content = 
            block.content ||
            block.text ||
            block.props?.content ||
            block.properties?.content;
          if (content && typeof content === 'string') {
            const preview = content.length > 100 
              ? content.substring(0, 100) + '...' 
              : content;
            parts.push(preview);
          }
          
          summary = parts.length > 0 
            ? parts.join('. ') 
            : "No summary available.";
        }
        
        // Extract creation date
        const createdAt: string =
          block.created_at ||
          block.createdAt ||
          block.props?.created_at ||
          block.properties?.created_at ||
          block.metadata?.createdAt ||
          new Date().toISOString();

        return {
          title,
          summary,
          createdAt,
        };
      });

      const body: SkillsResponse = {
        learnedCount: blocks.length,
        skills,
      };

      return NextResponse.json(body, { status: 200 });
    } catch (error) {
      console.error(
        "[Acontext Skills] All methods failed to fetch skills:",
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined
      );
      
      const body: SkillsResponse = {
        learnedCount: 0,
        skills: [],
        disabledReason:
          "Failed to load skills from Acontext. Please check the console for details and ensure your Acontext API is properly configured.",
      };
      return NextResponse.json(body, { status: 200 });
    }
  } catch (error) {
    console.error(
      "[Acontext Skills] Unexpected error:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}


