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
import { ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react";

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
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Login
  const [lEmail, setLEmail] = useState("");
  const [lPassword, setLPassword] = useState("");

  // Forgot Password
  const [fEmail, setFEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!fEmail.trim()) {
      return toast.error("Please enter your email address.");
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setResetSent(true);
        toast.success("Password reset email sent! Check your inbox.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
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

      {showForgotPassword ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-all">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForgotPassword(false);
              setResetSent(false);
            }}
            className="-ml-2 mb-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to sign in
          </Button>

          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Forgot Password?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your registered email address and we'll send you a link to reset your password.
            </p>
          </div>

          {resetSent ? (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-4 text-xs font-medium text-primary">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Reset link sent to <strong>{fEmail}</strong></span>
              </div>
              <p className="text-xs text-muted-foreground">
                Please check your inbox (and spam/junk folder). Click the link in the email to set a new password.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleForgotPassword({ preventDefault: () => {} } as React.FormEvent)}
                  disabled={loading}
                  className="w-full text-xs"
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" /> Resend reset email
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                  }}
                  className="w-full text-xs"
                >
                  Back to login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  placeholder="farmer@example.com"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button
                disabled={loading}
                type="submit"
                className="w-full bg-gradient-primary shadow-soft"
              >
                {loading ? "Sending link…" : "Send Reset Link"}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid grid-cols-2 rounded-2xl">
            <TabsTrigger value="login" className="rounded-xl">Login</TabsTrigger>
            <TabsTrigger value="register" className="rounded-xl">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <form onSubmit={login} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={lEmail}
                  onChange={(e) => {
                    setLEmail(e.target.value);
                    if (!fEmail) setFEmail(e.target.value);
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setFEmail(lEmail);
                      setShowForgotPassword(true);
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={lPassword}
                  onChange={(e) => setLPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
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
      )}

      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/schemes" className="underline">Browse Government Schemes</Link>
      </div>
    </div>
  );
}

