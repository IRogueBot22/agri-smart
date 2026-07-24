import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sprout, Map as MapIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [
    { title: "Welcome to AgriSmart AI" },
    { name: "description", content: "Get personalized AI-powered recommendations for your crops, weather, and soil." },
  ]}),
  component: Onboarding,
});

const slides = [
  { icon: Sprout, title: "Smart Farming Made Easy", desc: "Get personalized AI recommendations for your crops, weather and soil." },
  { icon: MapIcon, title: "Map Your Farm", desc: "Draw your farm boundary on the map and get location-specific insights." },
  { icon: TrendingUp, title: "Grow More, Spend Less", desc: "AI based suggestions help you increase productivity without raising costs." },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const done = () => { localStorage.setItem("agri-onboarded", "1"); navigate({ to: "/auth", replace: true }); };
  const S = slides[i];
  const Icon = S.icon;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="flex justify-end p-4">
        <button onClick={done} className="text-sm text-muted-foreground hover:text-foreground">Skip</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-40 w-40 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-20 w-20 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold text-primary">{S.title}</h2>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">{S.desc}</p>
      </div>
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <span key={idx} className={cn("h-2 rounded-full transition-all", idx === i ? "w-6 bg-primary" : "w-2 bg-muted")} />
          ))}
        </div>
        <Button onClick={() => (i < slides.length - 1 ? setI(i + 1) : done())} className="bg-gradient-primary shadow-soft">
          {i < slides.length - 1 ? "Next" : "Get Started"}
        </Button>
      </div>
    </div>
  );
}
