import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  fetchProjects, deleteProject, updateProjectStatus,
  fetchPendingInvites, acceptInvite, declineInvite,
  type Project, type ProjectInvite,
} from '@/lib/api';
import { soundManager } from '@/lib/sound';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Loader2, Pickaxe, Mail, Check, X, UserPlus, HardHat, Hammer, BrainCircuit } from 'lucide-react';
import ProjectCard from '@/components/ProjectCard';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [respondingInvite, setRespondingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadProjects();
    loadInvites();
  }, [user]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    try {
      const data = await fetchPendingInvites();
      setInvites(data);
    } catch {
      // silently fail — invites are non-critical
    }
  };

  const handleAcceptInvite = async (invite: ProjectInvite) => {
    setRespondingInvite(invite.id);
    try {
      const result = await acceptInvite(invite.id);
      soundManager.playSound('craft');
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      // Reload projects to show the newly joined one
      await loadProjects();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRespondingInvite(null);
    }
  };

  const handleDeclineInvite = async (invite: ProjectInvite) => {
    setRespondingInvite(invite.id);
    try {
      await declineInvite(invite.id);
      soundManager.playSound('button');
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRespondingInvite(null);
    }
  };

  if (!user) { navigate('/'); return null; }

  const handleLogout = async () => {
    setLoggingOut(true);
    soundManager.playSound('logout');
    await logout();
    navigate('/');
  };

  const handleNewProject = () => {
    soundManager.playSound('craft');
    navigate('/new-project');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      soundManager.playSound('back');
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleDone = async (id: string, done: boolean) => {
    try {
      await updateProjectStatus(id, done ? 'completed' : 'active');
      soundManager.playSound('craft');
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: done ? 'completed' : 'active' } : p));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const initials = (user.full_name || user.email || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen mesh-bg text-foreground">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-sm">⛏</div>
            <span className="font-black text-base gradient-text-green">CraftChain</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {invites.length > 0 && (
              <div className="relative flex items-center gap-1.5 text-sm text-primary">
                <Mail className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                  {invites.length}
                </span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
              <span>Welcome back,</span>
              <span className="font-semibold text-foreground">{user.full_name || user.email}</span>
            </div>
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Your Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={handleNewProject}
            className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 px-5"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* ── Pending Invites ─────────────────────────────────── */}
        {invites.length > 0 && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm text-foreground">
                Pending Invites
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  {invites.length}
                </span>
              </h2>
            </div>
            {invites.map(invite => {
              const inviterName = invite.inviter?.full_name || invite.inviter?.email || 'Someone';
              const projectName = invite.projects?.name || 'a project';
              const isResponding = respondingInvite === invite.id;
              const roleIcon = invite.role === 'miner' ? <HardHat className="w-3 h-3" /> :
                invite.role === 'builder' ? <Hammer className="w-3 h-3" /> :
                  invite.role === 'planner' ? <BrainCircuit className="w-3 h-3" /> :
                    <UserPlus className="w-3 h-3" />;
              const roleColor = invite.role === 'miner' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                invite.role === 'builder' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                  invite.role === 'planner' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                    'text-muted-foreground bg-white/5 border-white/10';

              return (
                <div key={invite.id} className="glass-strong rounded-2xl border border-primary/15 p-5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs text-primary font-bold">
                          {inviterName[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {inviterName}
                            <span className="text-muted-foreground font-normal"> invited you to</span>
                          </p>
                          <p className="text-base font-bold text-foreground">{projectName}</p>
                        </div>
                      </div>

                      {invite.message && (
                        <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-muted-foreground italic">
                          "{invite.message}"
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleColor}`}>
                          {roleIcon}
                          <span>{invite.role}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeclineInvite(invite)}
                        disabled={isResponding}
                        className="rounded-xl h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      >
                        {isResponding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        <span className="text-xs">Decline</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvite(invite)}
                        disabled={isResponding}
                        className="rounded-xl h-9 px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isResponding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span className="text-xs">Accept</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass rounded-2xl h-40 shimmer border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 animate-float">
              <Pickaxe className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first crafting project to start tracking recipes and progress.
            </p>
            <Button
              onClick={handleNewProject}
              className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2"
            >
              <Plus className="w-4 h-4" />
              Create first project
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => { soundManager.playSound('craft'); navigate(`/project/${p.id}`); }}
                onDelete={handleDelete}
                onToggleDone={handleToggleDone}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
