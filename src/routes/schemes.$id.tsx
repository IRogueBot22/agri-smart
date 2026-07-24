import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSchemes } from "@/lib/public.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Share2, Landmark } from "lucide-react";

export const Route = createFileRoute("/schemes/$id")({
  head: () => ({ meta: [
    { title: "Scheme Details — AgriSmart AI" },
    { name: "description", content: "Full details: benefits, eligibility, required documents, and how to apply." },
  ]}),
  component: SchemeDetails,
});

function SchemeDetails() {
  const { id } = Route.useParams();
  const load = useServerFn(listSchemes);
  const [s, setS] = useState<any>(null);
  useEffect(() => { load().then((rows) => setS(rows.find((r: any) => r.id === id))); }, [id, load]);

  function share() {
    if (navigator.share && s) navigator.share({ title: s.title, text: s.description, url: window.location.href }).catch(() => {});
  }

  if (!s) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link to="/schemes" className="text-sm">←</Link>
          <h1 className="line-clamp-1 text-base font-semibold">{s.title}</h1>
        </div>
      </header>
      <div className="space-y-3 px-4 pt-4">
        <div className="flex h-32 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-soft">
          <Landmark className="h-16 w-16 opacity-80" />
        </div>
        <div className="text-xs uppercase text-primary">{s.category}</div>
        <h2 className="text-xl font-bold">{s.title}</h2>
        <p className="text-sm text-muted-foreground">{s.description}</p>

        <Section title="Benefits" body={s.benefits} />
        <Section title="Eligibility" body={s.eligibility} />
        <Section title="Required Documents" body={s.documents} />

        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t bg-background/95 p-3 backdrop-blur">
          <Button variant="outline" onClick={share} className="flex-1"><Share2 className="mr-2 h-4 w-4" />Share</Button>
          <a href={s.apply_url} target="_blank" rel="noreferrer" className="flex-[2]">
            <Button className="w-full bg-gradient-primary shadow-soft"><ExternalLink className="mr-2 h-4 w-4" />Apply Now</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return <Card className="shadow-soft"><CardContent className="p-4"><h3 className="mb-1 text-sm font-semibold text-primary">{title}</h3><p className="text-sm text-muted-foreground">{body}</p></CardContent></Card>;
}
