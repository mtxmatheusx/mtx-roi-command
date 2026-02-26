import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await signUp(email, password);
      setLoading(false);
      if (error) {
        toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conta criada!", description: "Você já está logado." });
        navigate("/");
      }
    } else {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setMode("login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background noise-bg">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-neon-red">MTX</span>{" "}
            <span className="text-foreground">Estratégias</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">ROI Command Center</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neon-red/20 bg-card p-8 shadow-lg shadow-neon-red/5">
          {mode !== "forgot" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-border focus:border-neon-red/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Senha</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10 border-border focus:border-neon-red/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background hover:bg-neon-red hover:text-foreground transition-all duration-300 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {mode === "signup" ? "Criar Conta" : "Entrar"}
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-sm text-muted-foreground hover:text-neon-red transition-colors"
                >
                  {mode === "login" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm text-muted-foreground hover:text-neon-red transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold text-foreground">Redefinir Senha</h2>
                <p className="text-sm text-muted-foreground">
                  Insira seu email para receber o link de redefinição.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-border focus:border-neon-red/50"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-foreground text-background hover:bg-neon-red hover:text-foreground transition-all duration-300 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enviar Link
              </Button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-sm text-muted-foreground hover:text-neon-red transition-colors"
              >
                Voltar ao login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
