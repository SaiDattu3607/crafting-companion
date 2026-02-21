import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
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
        if (result === true) navigate('/');
        else setError(result);
      } else {
        if (!fullName.trim()) {
          setError('Full name required');
          setLoading(false);
          return;
        }
        const result = await signup(email, password, fullName);
        if (result === true) navigate('/');
        else setError(result);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center craft-grid">
      <div className="w-full max-w-md p-8 pixel-border bg-card">
        <h1 className="text-lg text-primary mb-2 text-center">⛏ CraftChain</h1>
        <p className="text-center text-muted-foreground text-xl mb-8">
          {isLogin ? 'Welcome back, crafter!' : 'Join the crafting guild'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-pixel text-muted-foreground block mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-secondary border-border text-lg"
              placeholder="steve@minecraft.net"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="text-sm font-pixel text-muted-foreground block mb-1">Full Name</label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={loading}
                className="bg-secondary border-border text-lg"
                placeholder="Steve the Miner"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-pixel text-muted-foreground block mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-secondary border-border text-lg"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-destructive text-lg">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full text-lg pixel-border-accent"
          >
            {loading ? '⏳ Processing...' : (isLogin ? '⚔ Enter World' : '🏗 Create Account')}
          </Button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          disabled={loading}
          className="w-full text-center mt-4 text-muted-foreground hover:text-primary text-lg transition-colors disabled:opacity-50"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
