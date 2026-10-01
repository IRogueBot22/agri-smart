import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — AgriSmart AI" },
      { name: "description", content: "Set a new password for your AgriSmart AI account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(true);

  useEffect(() => {
    // Check if recovery session is active
    let mounted = true;

    async function checkRecoverySession() {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        // If there is an active session (either from token in URL or signed in)
        if (data?.session) {
          setHasValidSession(true);
        } else {
          // Check if URL has access_token or code params
          const hash = window.location.hash;
          const search = window.location.search;
          const hasAuthParams = hash.includes("access_token") || search.includes("code=") || hash.includes("type=recovery");
          setHasValidSession(hasAuthParams);
        }
        setSessionChecked(true);
      }
    }

    checkRecoverySession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (mounted) {
          setHasValidSession(true);
          setSessionChecked(true);
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters long.");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setIsSuccess(true);
        toast.success("Password updated successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Set New Password</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your new password below to securely access your account.
        </p>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-6">
          {isSuccess ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Password Reset Complete!</h2>
                <p className="text-xs text-muted-foreground">
                  Your password has been successfully updated. You can now continue to your farm dashboard.
                </p>
              </div>
              <Button
                onClick={() => navigate({ to: "/home", replace: true })}
                className="w-full bg-gradient-primary shadow-soft"
              >
                Go to Dashboard
              </Button>
            </div>
          ) : !hasValidSession && sessionChecked ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Reset Link Expired or Invalid</h2>
                <p className="text-xs text-muted-foreground">
                  The password reset link is invalid or has expired. Please request a new password reset email.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/auth", replace: true })}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Password Guidelines:
                </div>
                <p>• Must be at least 6 characters in length</p>
                <p>• Both password fields must match exactly</p>
              </div>

              <Button
                disabled={loading}
                type="submit"
                className="w-full bg-gradient-primary shadow-soft mt-2"
              >
                {loading ? "Updating password…" : "Reset Password"}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/auth"
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
