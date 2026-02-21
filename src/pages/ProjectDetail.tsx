import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProject, contributeToNode, addProjectMember,
  fetchContributions, fetchBottleneck, fetchProgress,
  type Project, type CraftingNode, type Contribution,
  type BottleneckItem, type ProjectProgress, type ProjectMember,
} from '@/lib/api';
import { soundManager } from '@/lib/sound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban, UserPlus, RefreshCw, Loader2 } from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<CraftingNode[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collabEmail, setCollabEmail] = useState('');
  const [collabError, setCollabError] = useState('');
  const [contributing, setContributing] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [projectData, contribs, bottleneckData, progressData] = await Promise.all([
        fetchProject(id),
        fetchContributions(id).catch(() => []),
        fetchBottleneck(id).catch(() => []),
        fetchProgress(id).catch(() => null),
      ]);

      setProject(projectData.project);
      setNodes(projectData.nodes);
      setMembers(projectData.members);
      setContributions(contribs);
      setBottlenecks(bottleneckData);
      setProgress(progressData);
      setError('');
    } catch (err) {
      console.error('ProjectDetail loadProject error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (!user) { navigate('/auth'); return null; }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted-foreground mb-4">{error || 'Project not found'}</p>
          <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const progressPct = progress?.progress_pct || 0;
  const topBottleneck = bottlenecks.length > 0 ? bottlenecks[0] : null;

  // Determine if a node can be contributed to
  const canContribute = (node: CraftingNode): boolean => {
    if (node.collected_qty >= node.required_qty) return false;
    if (node.is_resource) return true; // Resources can always be collected
    // Non-resources: check if all children are complete
    const children = nodes.filter(n => n.parent_id === node.id);
    return children.every(c => c.collected_qty >= c.required_qty);
  };

  const getNodeStatus = (node: CraftingNode): 'complete' | 'ready' | 'blocked' => {
    if (node.collected_qty >= node.required_qty) return 'complete';
    if (canContribute(node)) return 'ready';
    return 'blocked';
  };

  const handleContribute = async (nodeId: string, action: 'collected' | 'crafted') => {
    setContributing(nodeId);
    try {
      const result = await contributeToNode(id!, nodeId, 1, action);
      if (!result.success) {
        setError(result.error || 'Contribution failed');
      } else {
        // Play sound effect
        soundManager.playSound(action === 'crafted' ? 'craft' : 'collect');
      }
      // Reload project to get updated state
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setContributing(null);
    }
  };

  const handleRefresh = () => {
    soundManager.playSound('button');
    loadProject();
  };

  const handleGoHome = () => {
    soundManager.playSound('button');
    navigate('/');
  }

  const handleAddCollaborator = async () => {
    setCollabError('');
    if (!collabEmail.trim()) return;
    try {
      await addProjectMember(id!, collabEmail.trim());
      setCollabEmail('');
      soundManager.playSound('button');
      await loadProject();
    } catch (err) {
      setCollabError((err as Error).message);
    }
  };

  const statusIcon = (node: CraftingNode) => {
    const status = getNodeStatus(node);
    if (status === 'complete') return <CheckCircle className="w-5 h-5 text-craft-complete" />;
    if (status === 'blocked') return <Ban className="w-5 h-5 text-craft-blocked" />;
    return <Clock className="w-5 h-5 text-craft-pending" />;
  };

  const statusBg = (node: CraftingNode) => {
    const status = getNodeStatus(node);
    if (status === 'complete') return 'border-l-4 border-l-craft-complete bg-craft-complete/5';
    if (status === 'blocked') return 'border-l-4 border-l-craft-blocked bg-craft-blocked/5';
    return 'border-l-4 border-l-craft-pending bg-craft-pending/5';
  };

  // Build tree structure from flat nodes
  const rootNodes = nodes.filter(n => n.parent_id === null);
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId);

  const renderNodeTree = (node: CraftingNode, depth: number = 0, isLast: boolean = true, prefix: string = '') => {
    const children = getChildren(node.id);
    const isComplete = node.collected_qty >= node.required_qty;
    const isContributing = contributing === node.id;
    const hasChildren = children.length > 0;

    // Build the branch prefix for nested items
    const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.id}>
        <div className="flex items-center">
          {/* Tree branch characters */}
          {depth > 0 && (
            <span className="text-muted-foreground font-mono text-sm whitespace-pre select-none flex-shrink-0">
              {prefix}{connector}
            </span>
          )}
          {/* Node card */}
          <div className={`flex-1 flex items-center justify-between p-2.5 rounded mb-0.5 ${statusBg(node)}`}>
            <div className="flex items-center gap-2">
              {statusIcon(node)}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${depth === 0 ? 'text-lg' : 'text-base'}`}>
                  {node.display_name}
                </span>
                <span className="text-muted-foreground text-sm">
                  {node.collected_qty}/{node.required_qty}
                </span>
                {node.enchantments && node.enchantments.length > 0 && (
                  <div className="flex gap-2">
                    {node.enchantments.map((en, i) => (
                      <span key={`${en.name}-${i}`} className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                        {en.name} {en.level}
                      </span>
                    ))}
                  </div>
                )}
                {node.is_resource && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">resource</span>
                )}
                {!node.is_resource && hasChildren && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                    {node.depth === 0 ? 'final goal' : 'craftable'}
                  </span>
                )}
              </div>
            </div>
            {!isComplete && (
              <div className="flex gap-1 flex-shrink-0 ml-2">
                {node.is_resource ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canContribute(node) || isContributing}
                    onClick={() => handleContribute(node.id, 'collected')}
                    className="text-xs h-7 px-2"
                  >
                    {isContributing ? <Loader2 className="w-3 h-3 animate-spin" /> : '📦 Collect'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canContribute(node) || isContributing}
                    onClick={() => handleContribute(node.id, 'crafted')}
                    className="text-xs h-7 px-2"
                  >
                    {isContributing ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚒ Craft'}
                  </Button>
                )}
              </div>
            )}
            {isComplete && (
              <span className="text-xs text-craft-complete uppercase flex-shrink-0 ml-2">✓ Done</span>
            )}
          </div>
        </div>
        {children.map((c, i) => renderNodeTree(c, depth + 1, i === children.length - 1, childPrefix))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="pixel-border border-x-0 border-t-0 bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleGoHome}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm text-primary">{project.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-muted-foreground">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </header>

      {/* Bottleneck Alert */}
      {topBottleneck && (
        <div className="mx-6 mt-4 p-4 pixel-border bg-craft-blocked/10 border-craft-blocked flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-craft-blocked" />
          <span className="text-lg">
            <strong className="text-craft-blocked">{topBottleneck.display_name}</strong> is blocking {topBottleneck.blocked_ancestors} item{topBottleneck.blocked_ancestors > 1 ? 's' : ''} — needs {topBottleneck.remaining_qty} more
          </span>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-4 pixel-border bg-destructive/10 text-destructive">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError('')}>✕</Button>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Crafting Tree */}
        <div className="lg:col-span-2 space-y-4">
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-4">
              Crafting Tree ({nodes.length} nodes)
            </h2>
            <div className="space-y-1">
              {rootNodes.map(r => renderNodeTree(r))}
            </div>
          </div>

          {/* Add Collaborator */}
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-3">Collaboration</h2>
            <div className="flex gap-2">
              <Input
                value={collabEmail}
                onChange={e => setCollabEmail(e.target.value)}
                placeholder="Enter email to invite..."
                className="bg-secondary border-border text-lg"
              />
              <Button onClick={handleAddCollaborator} variant="outline" className="text-lg">
                <UserPlus className="w-4 h-4 mr-1" /> Invite
              </Button>
            </div>
            {collabError && <p className="text-destructive text-sm mt-2">{collabError}</p>}
            {members.length > 0 && (
              <div className="mt-3 space-y-1">
                {members.map(m => (
                  <div key={m.user_id} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-foreground">{(m.profiles as any)?.full_name || (m.profiles as any)?.email}</span>
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{m.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottleneck Details */}
          {bottlenecks.length > 0 && (
            <div className="pixel-border bg-card p-4">
              <h2 className="text-xs font-pixel text-muted-foreground mb-3">🔍 Bottleneck Resources</h2>
              <div className="space-y-2">
                {bottlenecks.slice(0, 5).map(b => (
                  <div key={b.node_id} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <div>
                      <span className="text-lg font-bold">{b.display_name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {b.collected_qty}/{b.required_qty} ({b.remaining_qty} needed)
                      </span>
                    </div>
                    <span className="text-sm text-craft-blocked">
                      Blocking {b.blocked_ancestors} item{b.blocked_ancestors > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Progress + Activity */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="pixel-border bg-card p-4">
            <h2 className="text-xs font-pixel text-muted-foreground mb-3">Progress</h2>
            <div className="text-center mb-3">
              <span className="text-2xl font-pixel text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-4 bg-secondary [&>div]:bg-primary" />
            {progress && (
              <div className="flex justify-between mt-3 text-sm text-muted-foreground">
                <span>🟢 {progress.completed_nodes} done</span>
                <span>📦 {progress.completed_resources}/{progress.total_resources} resources</span>
              </div>
            )}
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
                    <span className="text-foreground font-bold">
                      {(c.profiles as any)?.full_name || (c.profiles as any)?.email}
                    </span>
                    <span className="text-muted-foreground"> {c.action} </span>
                    <span className="text-accent">
                      {(c.crafting_nodes as any)?.display_name || 'item'}
                    </span>
                    <span className="text-muted-foreground"> ×{c.quantity}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(c.created_at).toLocaleString()}
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
