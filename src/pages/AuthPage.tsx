import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      const result = login(email, password);
      if (result === true) navigate('/');
      else setError(result);
    } else {
      if (!username.trim()) { setError('Username required'); return; }
      const result = signup(email, username, password);
      if (result === true) navigate('/');
      else setError(result);
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
              className="bg-secondary border-border text-lg"
              placeholder="steve@minecraft.net"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="text-sm font-pixel text-muted-foreground block mb-1">Username</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-secondary border-border text-lg"
                placeholder="DiamondMiner42"
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
              className="bg-secondary border-border text-lg"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-destructive text-lg">{error}</p>}

          <Button type="submit" className="w-full text-lg pixel-border-accent">
            {isLogin ? '⚔ Enter World' : '🏗 Create Account'}
          </Button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="w-full text-center mt-4 text-muted-foreground hover:text-primary text-lg transition-colors"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
