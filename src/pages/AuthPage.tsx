import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { soundManager } from '@/lib/sound';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [minecraftLevel, setMinecraftLevel] = useState<number>(0);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result === true) navigate('/dashboard');
        else setError(result);
      } else {
        if (!fullName.trim()) { setError('Full name required'); setLoading(false); return; }
        const result = await signup(email, password, fullName, minecraftLevel);
        if (result === true) navigate('/dashboard');
        else setError(result);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(152 80% 48% / 0.12) 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(45 95% 58% / 0.10) 0%, transparent 70%)' }} />

      {/* Back link */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        onClick={() => soundManager.playSound('back')}
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back
      </Link>

      {/* Card */}
      <div className="w-full max-w-md animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 mb-4 text-2xl">
            ⛏
          </div>
          <h1 className="text-2xl font-black tracking-tight gradient-text-green">CraftChain</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin ? 'Welcome back, crafter!' : 'Join the crafting guild'}
          </p>
        </div>

        <div className="glass-strong rounded-2xl p-8 border border-white/5">
          {/* Toggle tabs */}
          <div className="flex p-1 rounded-xl bg-secondary/50 mb-6">
            {['Sign In', 'Sign Up'].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => { setIsLogin(i === 0); setError(''); soundManager.playSound('back'); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${(isLogin ? i === 0 : i === 1)
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name</label>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  disabled={loading}
                  className="bg-secondary/60 border-white/8 focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11"
                  placeholder="Steve the Miner"
                />
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Minecraft XP Level
                  <span className="text-muted-foreground/60 font-normal ml-1">(your current in-game level)</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  max={32767}
                  value={minecraftLevel || ''}
                  onChange={e => setMinecraftLevel(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={loading}
                  className="bg-secondary/60 border-white/8 focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11"
                  placeholder="e.g. 30"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-1">
                  Used to determine which enchantments you can apply. You can change this later.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-secondary/60 border-white/8 focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11"
                placeholder="steve@minecraft.net"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-secondary/60 border-white/8 focus:border-primary/50 focus:ring-primary/20 rounded-xl h-11 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              onClick={() => soundManager.playSound('craft')}
              className="w-full btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 font-semibold text-sm mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                : isLogin ? '⚔ Enter World' : '🏗 Create Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
