import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — AgriSmart AI" },
    { name: "description", content: "Sign in or create an account to access AgriSmart AI farmer advisory." },
  ]}),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Login
  const [lEmail, setLEmail] = useState("");
  const [lPassword, setLPassword] = useState("");

  // Register
  const [r, setR] = useState({ full_name: "", phone: "", email: "", password: "", village: "", district: "", state: "" });

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: lEmail, password: lPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/home", replace: true });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: r.email,
      password: r.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: r.full_name, phone: r.phone, village: r.village, district: r.district, state: r.state },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you're signed in.");
    navigate({ to: "/home", replace: true });
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) return toast.error(res.error.message);
    if (!res.redirected) navigate({ to: "/home", replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-6 pb-10 pt-10">
      <div className="mb-6 flex flex-col items-center">
        <Logo size={64} />
        <h1 className="mt-3 text-xl font-bold">AgriSmart AI</h1>
        <p className="text-xs text-muted-foreground">Smart Advice, Better Harvest</p>
      </div>

      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid grid-cols-2 rounded-2xl">
          <TabsTrigger value="login" className="rounded-xl">Login</TabsTrigger>
          <TabsTrigger value="register" className="rounded-xl">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={login} className="space-y-4">
            <div><Label>Email</Label><Input type="email" required value={lEmail} onChange={(e) => setLEmail(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" required value={lPassword} onChange={(e) => setLPassword(e.target.value)} /></div>
            <Button disabled={loading} type="submit" className="w-full bg-gradient-primary shadow-soft">{loading ? "…" : "Login"}</Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={google} type="button">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3-3C17.2 1.9 14.8 1 12 1 7.4 1 3.4 3.6 1.4 7.4l3.5 2.7C5.9 7.1 8.7 5 12 5z"/><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-1.9 3.6-4.8 3.6-8.3z"/><path fill="#FBBC05" d="M4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.4 7c-.9 1.6-1.4 3.5-1.4 5.3s.5 3.7 1.4 5.3l3.5-2.7z"/><path fill="#34A853" d="M12 23c3 0 5.6-1 7.5-2.7l-3.5-2.7c-1 .7-2.3 1.1-4 1.1-3.3 0-6.1-2.1-7.1-5l-3.5 2.7C3.4 20.4 7.4 23 12 23z"/></svg>
            Login with Google
          </Button>
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <form onSubmit={register} className="space-y-3">
            <div><Label>Full name</Label><Input required value={r.full_name} onChange={(e) => setR({ ...r, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input required value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" required value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="password" required minLength={6} value={r.password} onChange={(e) => setR({ ...r, password: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Village</Label><Input value={r.village} onChange={(e) => setR({ ...r, village: e.target.value })} /></div>
              <div><Label className="text-xs">District</Label><Input value={r.district} onChange={(e) => setR({ ...r, district: e.target.value })} /></div>
              <div><Label className="text-xs">State</Label><Input value={r.state} onChange={(e) => setR({ ...r, state: e.target.value })} /></div>
            </div>
            <Button disabled={loading} type="submit" className="w-full bg-gradient-primary shadow-soft">{loading ? "…" : "Create account"}</Button>
          </form>
        </TabsContent>
      </Tabs>
      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/schemes" className="underline">Browse Government Schemes</Link>
      </div>
    </div>
  );
}
