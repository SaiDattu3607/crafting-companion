import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getProjects, type Project } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Plus, LogOut } from 'lucide-react';
import ProjectCard from '@/components/ProjectCard';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects] = useState<Project[]>(() => user ? getProjects(user.id) : []);

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="pixel-border border-x-0 border-t-0 bg-card p-4 flex items-center justify-between">
        <h1 className="text-sm text-primary">⛏ CraftChain</h1>
        <div className="flex items-center gap-4">
          <span className="text-lg text-muted-foreground">Welcome, <span className="text-foreground">{user.username}</span></span>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm text-foreground">Your Projects</h2>
          <Button onClick={() => navigate('/new-project')} className="pixel-border-accent text-lg">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 pixel-border bg-card">
            <p className="text-3xl mb-2">🪨</p>
            <p className="text-xl text-muted-foreground mb-4">No crafting projects yet</p>
            <Button onClick={() => navigate('/new-project')} variant="outline" className="text-lg">
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
