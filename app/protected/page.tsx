import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ChatbotPanel } from "@/components/chatbot-panel";
import { AcontextSkillsCard } from "@/components/acontext-skills-card";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-2 bg-background lg:flex-row">
      <div className="flex-1 min-h-[50vh]">
        <ChatbotPanel fullPage />
      </div>
      <div className="w-full shrink-0 lg:w-72 lg:mt-0">
        <AcontextSkillsCard />
      </div>
    </div>
  );
}
