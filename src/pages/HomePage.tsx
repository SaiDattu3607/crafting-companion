import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Users, Search, TreePine, Shield, ChevronRight } from 'lucide-react';

const features = [
  { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', title: 'Smart Recipe Parser', desc: 'Automatically extracts full crafting trees from any Minecraft item in seconds.' },
  { icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', title: 'Bottleneck Detection', desc: 'Instantly spot the items blocking your progress and focus your efforts.' },
  { icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', title: 'Multiplayer Ready', desc: 'Invite friends, assign roles, and craft together in real-time.' },
  { icon: TreePine, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', title: 'Visual Recipe Trees', desc: 'See the full dependency tree of any crafted item at a glance.' },
  { icon: Shield, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', title: 'Enchantment Support', desc: 'Plan enchanted gear — levels, books, and all required materials included.' },
  { icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20', title: 'Progress Tracking', desc: 'Track collected vs. required quantities with beautiful visual feedback.' },
];

const stats = [
  { value: '10K+', label: 'Recipes Indexed' },
  { value: '5K+', label: 'Active Crafters' },
  { value: '99%', label: 'Uptime' },
  { value: '24/7', label: 'Community' },
];

const HomePage = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen mesh-bg text-foreground overflow-x-hidden">

      {/* ── Floating particle dots ──────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              animationDelay: `${(i * 0.4) % 3}s`,
              animationDuration: `${3 + (i % 3)}s`,
              opacity: 0.3 + (i % 3) * 0.1,
              width: i % 4 === 0 ? '6px' : '3px',
              height: i % 4 === 0 ? '6px' : '3px',
              background: i % 3 === 0
                ? 'hsl(152 80% 48%)'
                : i % 3 === 1
                  ? 'hsl(45 95% 58%)'
                  : 'hsl(280 70% 60%)',
            }}
          />
        ))}
      </div>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 glass-strong">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary text-sm">⛏</span>
            </div>
            <span className="font-bold text-lg tracking-tight gradient-text-green">CraftChain</span>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'About', 'Community'].map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                {link}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary transition-all group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5">
                <Link to="/dashboard">Dashboard <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl">
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 gap-2">
                  <Link to="/auth">Get Started <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-6 z-10">
        {/* Big background glow orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, hsl(152 80% 48% / 0.08) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-5xl mx-auto text-center relative animate-fade-in">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 text-sm text-primary mb-8 shimmer">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-medium">Your Minecraft Crafting Companion</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none mb-6">
            <span className="text-foreground">Craft</span>
            <span className="gradient-text-green"> smarter,</span>
            <br />
            <span className="text-foreground">build </span>
            <span className="gradient-text">faster.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Plan recipes, track progress, detect bottlenecks, and collaborate with friends —
            all in one beautiful dashboard. Never lose a blueprint again.
          </p>

          {/* CTA */}
          {loading ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          ) : user ? (
            <Button asChild size="lg" className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-base px-10 py-6 gap-2">
              <Link to="/dashboard">Go to Dashboard <ArrowRight className="w-5 h-5" /></Link>
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-base px-10 py-6 gap-2">
                <Link to="/auth">Start for Free <ArrowRight className="w-5 h-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl text-base px-10 py-6 border-white/10 hover:bg-white/5 text-foreground">
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          )}

          {/* Decorative mini-stats below CTA */}
          <div className="mt-14 flex flex-wrap justify-center gap-6">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-2xl font-black gradient-text-green">{s.value}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="relative py-24 px-6 z-10">
        {/* Section glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-primary font-semibold text-sm uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Everything you need to
              <br />
              <span className="gradient-text-green">level up your crafting</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className={`glass card-glow rounded-2xl p-6 border cursor-default`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`inline-flex p-3 rounded-xl border ${f.bg} mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      {!user && (
        <section id="about" className="relative py-24 px-6 z-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="max-w-4xl mx-auto">
            <div
              className="relative rounded-3xl p-px overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, hsl(152 80% 48% / 0.4), hsl(45 95% 58% / 0.2), hsl(280 70% 60% / 0.3))',
              }}
            >
              <div className="rounded-3xl glass-strong p-10 md:p-14 text-center">
                <div className="text-5xl mb-6">⛏</div>
                <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                  Ready to start
                  <span className="gradient-text-green"> crafting?</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                  Join thousands of Minecraft players who plan and track their builds with CraftChain. Free forever.
                </p>
                <Button asChild size="lg" className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-base px-12 py-6 gap-2">
                  <Link to="/auth">Create Free Account <ArrowRight className="w-5 h-5" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="community" className="relative py-8 px-6 border-t border-white/5 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm">⛏</span>
            <span className="font-bold text-sm gradient-text-green">CraftChain</span>
          </div>
          <p className="text-muted-foreground text-sm">Built for crafters, by crafters · 2025</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign Up</Link>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
