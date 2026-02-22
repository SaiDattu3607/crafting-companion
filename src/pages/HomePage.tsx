import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap, Users, Search, TreePine, Shield, ChevronRight } from 'lucide-react';
import { soundManager } from '@/lib/sound';

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
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-foreground overflow-x-hidden relative bg-[#0a0a0b]">

      {/* ── Cinematic Background ─────────────────────────── */}
      <div className="fixed inset-0 z-0">
        {/* Main dark overlay - reduced for brightness */}
        <div className="absolute inset-0 bg-[#0a0a0b]/20 z-10" />
        {/* Radial glows mimicking the screenshot */}
        <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]" />

        {/* Cinematic landscape simulation with gradients - lightened */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0b]/10 to-[#0a0a0b]/80" />

        {/* Placeholder image that looks like the screenshot if we had one, or just a very rich mesh */}
        <div className="absolute inset-0 opacity-70 mix-blend-overlay">
          <div className="w-full h-full bg-[url('/homepage-bg.png')] bg-cover bg-center" />
        </div>
      </div>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-md bg-black/20">
        <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center transition-transform group-hover:scale-110">
              <span className="text-emerald-400 text-lg">⛏</span>
            </div>
            <span className="font-black text-xl tracking-tighter text-white">CraftChain</span>
          </div>

          {/* Links centered */}
          <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
            {['Features', 'About', 'Community'].map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors relative group"
              >
                {link}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-400 transition-all group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-6">
            {user ? (
              <Button
                asChild
                className="btn-sci-fi-primary text-white border-0 px-6 h-11"
                onClick={() => soundManager.playSound('craft')}
              >
                <Link to="/dashboard" className="flex items-center gap-2">Dashboard <ChevronRight className="w-4 h-4" /></Link>
              </Button>
            ) : (
              <>
                <button
                  className="text-white/80 hover:text-white transition-colors text-sm font-semibold"
                  onClick={() => { soundManager.playSound('button'); navigate('/auth'); }}
                >
                  <Link to="/auth">Sign In</Link>
                </button>
                <Button
                  asChild
                  className="btn-sci-fi-primary text-white px-7 h-11 border-0"
                  onClick={() => soundManager.playSound('craft')}
                >
                  <Link to="/auth" className="flex items-center gap-2">Get Started <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-48 px-6 z-10">
        <div className="max-w-5xl mx-auto text-center animate-fade-in">

          {/* Main Title */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-none mb-8 text-white">
            Craft <span className="text-[#84cc16]">smarter,</span>
            <br />
            build <span className="text-[#f97316]">faster.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            Plan recipes, track progress, detect bottlenecks, and collaborate with
            friends — all in one beautiful dashboard. Never lose a blueprint again.
          </p>

          {/* CTA Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20 animate-slide-up">
            <Button
              asChild
              size="lg"
              className="btn-pixel-retro btn-pixel-retro-orange text-white text-base px-10 py-4 h-auto group"
              onClick={() => soundManager.playSound('craft')}
            >
              <Link to="/auth" className="flex items-center gap-3">
                Start for Free <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="btn-pixel-retro btn-pixel-retro-green text-white text-base px-10 py-4 h-auto group"
              onClick={() => soundManager.playSound('button')}
            >
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>

          {/* Stats Divider Line */}
          <div className="w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12" />

          {/* Horizontal Stats */}
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 mb-10">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center group cursor-default">
                <span className="text-2xl font-black text-emerald-400 group-hover:scale-110 transition-transform duration-300">{s.value}</span>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2 group-hover:text-white/60 transition-colors">{s.label}</span>
                <div className="w-0 h-0.5 bg-emerald-400 mt-1 transition-all group-hover:w-full opacity-50" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Corner Shimmer Decor */}
        <div className="absolute bottom-10 right-10 opacity-20 group">
          <Sparkles className="w-12 h-12 text-white animate-pulse" />
        </div>
      </section>

      {/* ── Features Overlay Section ──────────────────────── */}
      <section id="features" className="relative py-32 px-6 z-10 bg-black/40 backdrop-blur-3xl border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
              Everything you need to
              <br />
              <span className="text-emerald-400">level up your crafting</span>
            </h2>
            <div className="w-20 h-1 bg-emerald-500 mx-auto rounded-full" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="glass-panel-neon rounded-2xl p-8 transition-all hover:-translate-y-2 group"
              >
                <div className={`inline-flex p-4 rounded-xl border ${f.bg} mb-6 transition-transform group-hover:rotate-6`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-bold text-white text-xl mb-3">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer id="community" className="relative py-12 px-6 border-t border-white/5 z-10 bg-black/60">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 text-sm">⛏</span>
            </div>
            <span className="font-black text-white tracking-tighter">CraftChain</span>
          </div>
          <p className="text-white/30 text-sm font-medium">Built for crafters, by crafters · 2025</p>
          <div className="flex gap-10 text-sm font-bold text-white/50">
            <Link to="/auth" className="hover:text-emerald-400 transition-colors">Sign Up</Link>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
