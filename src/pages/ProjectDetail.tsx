import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProject, updateProject, getContributions, addContribution, addCollaborator,
  calculateProgress, getItemStatus, findBottleneck,
  type Project, type Requirement, type Contribution,
} from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban, UserPlus, RefreshCw } from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | undefined>(() => id ? getProject(id) : undefined);
  const [contributions, setContributions] = useState<Contribution[]>(() => id ? getContributions(id) : []);
  const [collabUsername, setCollabUsername] = useState('');
  const [collabError, setCollabError] = useState('');

  const refresh = useCallback(() => {
    if (!id) return;
    setProject(getProject(id));
    setContributions(getContributions(id));
  }, [id]);

  if (!user) { navigate('/auth'); return null; }
  if (!project) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl text-muted-foreground">Project not found</p>
    </div>
  );

  const progress = calculateProgress(project);
  const bottleneck = findBottleneck(project);

  const canMarkItem = (req: Requirement): boolean => {
    if (req.status !== 'pending') return false;
    return getItemStatus(req, project.requirements) !== 'blocked';
  };

  const markItem = (reqId: string, action: 'collected' | 'crafted') => {
    const req = project.requirements.find(r => r.id === reqId);
    if (!req || !canMarkItem(req)) return;
    
    req.status = action;
    updateProject(project);
    addContribution(project.id, user.id, user.username, req.name, action, req.quantity);
    refresh();
  };

  const handleAddCollaborator = () => {
    setCollabError('');
    if (!collabUsername.trim()) return;
    const result = addCollaborator(project.id, collabUsername.trim());
    if (result === true) {
      setCollabUsername('');
      refresh();
    } else {
      setCollabError(result);
    }
  };

  const statusIcon = (req: Requirement) => {
    const status = getItemStatus(req, project.requirements);
    if (status === 'complete') return <CheckCircle className="w-5 h-5 text-craft-complete" />;
    if (status === 'blocked') return <Ban className="w-5 h-5 text-craft-blocked" />;
    return <Clock className="w-5 h-5 text-craft-pending" />;
  };

  const statusBg = (req: Requirement) => {
    const status = getItemStatus(req, project.requirements);
    if (status === 'complete') return 'border-l-4 border-l-craft-complete bg-craft-complete/5';
    if (status === 'blocked') return 'border-l-4 border-l-craft-blocked bg-craft-blocked/5';
    return 'border-l-4 border-l-craft-pending bg-craft-pending/5';
  };

  // Group items: top-level (no dependencies) and children
  const topLevel = project.requirements.filter(r => r.dependencies.length === 0);
  const getChildren = (parentId: string) => project.requirements.filter(r => r.dependencies.includes(parentId));

  const renderReqTree = (req: Requirement, depth: number = 0) => {
    const children = getChildren(req.id);
    return (
      <div key={req.id} style={{ marginLeft: depth * 20 }}>
        <div className={`flex items-center justify-between p-3 rounded mb-1 ${statusBg(req)}`}>
          <div className="flex items-center gap-3">
            {statusIcon(req)}
            <div>
              <span className="text-lg font-bold">{req.name}</span>
              <span className="text-muted-foreground text-base ml-2">×{req.quantity}</span>
            </div>
          </div>
          {req.status === 'pending' && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={!canMarkItem(req)}
                onClick={() => markItem(req.id, 'collected')}
                className="text-sm"
              >
                📦 Collect
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canMarkItem(req)}
                onClick={() => markItem(req.id, 'crafted')}
                className="text-sm"
              >
                ⚒ Craft
              </Button>
            </div>
          )}
          {req.status !== 'pending' && (
            <span className="text-sm text-craft-complete uppercase">{req.status}</span>
          )}
        </div>
        {children.map(c => renderReqTree(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="pixel-border border-x-0 border-t-0 bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm text-primary">{project.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="text-muted-foreground">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </header>

      {/* Bottleneck Alert */}
      {bottleneck && (
        <div className="mx-6 mt-4 p-4 pixel-border bg-craft-blocked/10 border-craft-blocked flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-craft-blocked" />
          <span className="text-lg">
            <strong className="text-craft-blocked">{bottleneck.item.name}</strong> is blocking {bottleneck.blockingCount} dependent item{bottleneck.blockingCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Dependencies */}
        <div className="lg:col-span-2 space-y-4">
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-4">Requirements</h2>
            <div className="space-y-1">
              {topLevel.map(r => renderReqTree(r))}
              {/* Also render items that have deps but whose parent isn't shown at top */}
              {project.requirements
                .filter(r => r.dependencies.length > 0 && !project.requirements.some(p => getChildren(p.id).includes(r)))
                .map(r => renderReqTree(r))}
            </div>
          </div>

          {/* Add Collaborator */}
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-3">Collaboration</h2>
            <div className="flex gap-2">
              <Input
                value={collabUsername}
                onChange={e => setCollabUsername(e.target.value)}
                placeholder="Enter username to invite..."
                className="bg-secondary border-border text-lg"
              />
              <Button onClick={handleAddCollaborator} variant="outline" className="text-lg">
                <UserPlus className="w-4 h-4 mr-1" /> Invite
              </Button>
            </div>
            {collabError && <p className="text-destructive text-sm mt-2">{collabError}</p>}
            {project.collaboratorIds.length > 0 && (
              <p className="text-muted-foreground text-sm mt-2">
                {project.collaboratorIds.length} collaborator{project.collaboratorIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Right: Progress + Activity */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-3">Progress</h2>
            <div className="text-center mb-3">
              <span className="text-2xl font-pixel text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-4 bg-secondary [&>div]:bg-primary" />
            <div className="flex justify-between mt-3 text-sm text-muted-foreground">
              <span>🟢 {project.requirements.filter(r => r.status !== 'pending').length} done</span>
              <span>🟡 {project.requirements.filter(r => getItemStatus(r, project.requirements) === 'pending').length} pending</span>
              <span>🔴 {project.requirements.filter(r => getItemStatus(r, project.requirements) === 'blocked').length} blocked</span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-3">Activity Feed</h2>
            {contributions.length === 0 ? (
              <p className="text-muted-foreground text-lg text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {contributions.map(c => (
                  <div key={c.id} className="p-2 bg-secondary rounded text-sm">
                    <span className="text-foreground font-bold">{c.username}</span>
                    <span className="text-muted-foreground"> {c.action} </span>
                    <span className="text-accent">{c.itemName}</span>
                    <span className="text-muted-foreground"> ×{c.quantity}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(c.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectDetail;
