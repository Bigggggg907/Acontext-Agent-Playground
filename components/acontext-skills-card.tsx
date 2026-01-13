"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function AcontextSkillsCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/acontext/skills", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          setError("Failed to load skills.");
          setLoading(false);
          return;
        }
        const body: SkillsResponse = await res.json();
        setData(body);
      } catch {
        setError("Failed to load skills.");
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Learned skills (Space)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <p className="text-xs text-muted-foreground">Loading learned skills…</p>
        )}
        {!loading && error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        {!loading && !error && data && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Learned experiences:{" "}
              <span className="font-semibold text-foreground">
                {data.learnedCount}
              </span>
            </p>
            {"disabledReason" in data && data.disabledReason && (
              <p className="text-xs text-muted-foreground">
                {data.disabledReason}
              </p>
            )}
            {data.skills.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.skills.map((skill) => (
                  <div
                    key={`${skill.title}-${skill.createdAt}`}
                    className="rounded border bg-muted p-2 hover:bg-muted/80 transition-colors"
                  >
                    <div className="text-xs font-semibold text-foreground mb-1">
                      {skill.title}
                    </div>
                    {skill.summary && skill.summary !== "No summary available." && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {skill.summary}
                      </div>
                    )}
                    {skill.summary === "No summary available." && (
                      <div className="mt-1 text-xs text-muted-foreground italic">
                        This is a learned skill, but no detailed description is available.
                      </div>
                    )}
                    <div className="mt-1.5 text-xs text-muted-foreground/70">
                      {new Date(skill.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


