"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const HEALTHCHECK_ENDPOINT = "/api/acontext/healthcheck";

export function AcontextHealthcheckCard() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  const ping = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(HEALTHCHECK_ENDPOINT, {
        method: "GET",
        cache: "no-store",
      });
      
      const data = await res.json();
      if (res.ok && data.ok) {
        setResponse("pong");
      } else {
        setResponse("error");
      }
    } catch {
      setResponse("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={ping}
            disabled={loading}
          >
            {loading ? "..." : "ping"}
          </Button>
          {response && (
            <span className="text-sm font-mono text-muted-foreground">
              {response}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
