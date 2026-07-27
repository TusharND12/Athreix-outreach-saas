"use client";

import { useEffect, useState } from "react";
import { MeetingSketchIllustration } from "@/components/product/meeting-sketch-illustration";
import { SearchComposer } from "@/components/product/search-composer";
import { PageHeader } from "@/components/product/ui";

export default function SearchPage() {
  const [brief, setBrief] = useState("");
  useEffect(() => {
    setBrief(new URLSearchParams(window.location.search).get("brief") ?? "");
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader
        align="center"
        title="Who should you meet next?"
        description="Describe the market in your own words. Athreix searches wider, qualifies every candidate, and delivers only the strongest real records."
      />
      <SearchComposer key={brief} initialBrief={brief} />
      <MeetingSketchIllustration />
    </div>
  );
}
