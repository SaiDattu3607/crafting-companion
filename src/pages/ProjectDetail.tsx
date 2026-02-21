import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProject, contributeToNode, addProjectMember,
  fetchContributions, fetchBottleneck, fetchProgress,
  type Project, type CraftingNode, type Contribution,
  type BottleneckItem, type ProjectProgress, type ProjectMember,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban,
  UserPlus, RefreshCw, Loader2, Layers, Activity,
} from 'lucide-react';

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

      const parsedNodes = projectData.nodes.map((node: any) => {
        if (node.enchantments && typeof node.enchantments === 'string') {
          try { node.enchantments = JSON.parse(node.enchantments); }
          catch { node.enchantments = null; }
        }
        return node;
      });

      setProject(projectData.project);
      setNodes(parsedNodes);
      setMembers(projectData.members);
      setContributions(contribs);
      setBottlenecks(bottleneckData);
      setProgress(progressData);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (!user) { navigate('/auth'); return null; }

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center text-center">
        <div>
          <p className="text-muted-foreground text-xl mb-4">{error || 'Project not found'}</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-xl">Go Home</Button>
        </div>
      </div>
    );
  }

  const progressPct = progress?.progress_pct || 0;
  const topBottleneck = bottlenecks[0] ?? null;

  const canContribute = (node: CraftingNode): boolean => {
    if (node.collected_qty >= node.required_qty) return false;
    if (node.is_resource) return true;
    return nodes.filter(n => n.parent_id === node.id).every(c => c.collected_qty >= c.required_qty);
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
      if (!result.success) setError(result.error || 'Contribution failed');
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setContributing(null);
    }
  };

  const handleAddCollaborator = async () => {
    setCollabError('');
    if (!collabEmail.trim()) return;
    try {
      await addProjectMember(id!, collabEmail.trim());
      setCollabEmail('');
      await loadProject();
    } catch (err) {
      setCollabError((err as Error).message);
    }
  };

  const rootNodes = nodes.filter(n => n.parent_id === null);
  const rootNode = rootNodes[0] ?? null;
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId);
  const rootChildren = rootNode ? getChildren(rootNode.id) : [];
  const itemChildren = rootChildren.filter(c => c.item_name !== 'enchanted_book');
  const bookChildren = rootChildren.filter(c => c.item_name === 'enchanted_book');
  const hasEnchantment = (rootNode?.enchantments?.length ?? 0) > 0;

  const NodeStatusIcon = ({ node }: { node: CraftingNode }) => {
    const s = getNodeStatus(node);
    if (s === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    if (s === 'blocked') return <Ban className="w-4 h-4 text-red-400    flex-shrink-0" />;
    return <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
  };

  const nodeClass = (node: CraftingNode) => {
    const s = getNodeStatus(node);
    if (s === 'complete') return 'node-complete';
    if (s === 'blocked') return 'node-blocked';
    return 'node-pending';
  };

  const renderNodeTree = (
    node: CraftingNode,
    depth: number = 0,
    isLast: boolean = true,
    prefix: string = '',
    childrenOverride?: CraftingNode[] | null
  ): React.ReactNode => {
    const children = childrenOverride !== undefined && childrenOverride !== null
      ? childrenOverride : getChildren(node.id);
    const isComplete = node.collected_qty >= node.required_qty;
    const isContributing = contributing === node.id;
    const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.id}>
        <div className="flex items-center gap-1">
          {depth > 0 && (
            <span className="text-muted-foreground/40 font-mono text-xs whitespace-pre select-none flex-shrink-0">
              {prefix}{connector}
            </span>
          )}
          <div className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl mb-0.5 ${nodeClass(node)}`}>
            <div className="flex items-center gap-2 min-w-0">
              <NodeStatusIcon node={node} />
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className={`font-semibold truncate ${depth === 0 ? 'text-base' : 'text-sm'}`}>
                  {depth === 0 && node.enchantments?.length
                    ? `${node.display_name} (${node.enchantments.map(e => `${e.name.replace(/_/g, ' ')} ${e.level}`).join(', ')})`
                    : node.display_name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {node.collected_qty}/{node.required_qty}
                </span>
                {node.enchantments?.length > 0 && depth !== 0 && node.enchantments.map((en, i) => (
                  <span key={`${en.name}-${i}`} className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                    {en.name.replace(/_/g, ' ')} {en.level}
                  </span>
                ))}
                {node.is_resource && (
                  <span className="text-xs badge-pending px-1.5 py-0.5 rounded-full">resource</span>
                )}
                {!node.is_resource && getChildren(node.id).length > 0 && (
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                    {node.depth === 0 ? 'goal' : 'craftable'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 flex items-center gap-1">
              {isComplete ? (
                <span className="text-xs text-emerald-400 font-semibold">✓ Done</span>
              ) : (
                <Button
                  size="sm" variant="outline"
                  disabled={!canContribute(node) || !!isContributing}
                  onClick={() => handleContribute(node.id, node.is_resource ? 'collected' : 'crafted')}
                  className="h-7 px-2.5 text-xs rounded-lg border-white/10 hover:border-primary/40 hover:text-primary"
                >
                  {isContributing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : node.is_resource ? '📦 Collect' : '⚒ Craft'}
                </Button>
              )}
            </div>
          </div>
        </div>
        {children.map((c, i) => renderNodeTree(c, depth + 1, i === children.length - 1, childPrefix))}
      </div>
    );
  };

  return (
    <div className="min-h-screen mesh-bg text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-xs">⛏</div>
              <h1 className="font-black text-base gradient-text-green">CraftChain</h1>
            </div>
            <span className="text-muted-foreground text-sm hidden sm:block">/ {project.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadProject} className="text-muted-foreground hover:text-foreground rounded-xl gap-1.5">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline text-sm">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Bottleneck banner */}
      {topBottleneck && (
        <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm">
            <strong className="text-red-400">{topBottleneck.display_name}</strong>
            {' '}is blocking {topBottleneck.blocked_ancestors} item{topBottleneck.blocked_ancestors > 1 ? 's' : ''} — needs {topBottleneck.remaining_qty} more
          </span>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 flex items-center justify-between p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <span className="text-destructive text-sm">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError('')} className="rounded-lg text-destructive hover:bg-destructive/10">✕</Button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Crafting Tree ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-lg text-foreground">
                {rootNode && hasEnchantment && rootNode.enchantments?.length
                  ? `${rootNode.display_name} (${rootNode.enchantments.map(e => `${e.name.replace(/_/g, ' ')} ${e.level}`).join(', ')})`
                  : rootNode?.display_name ?? 'Crafting Tree'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">{nodes.length} nodes in recipe tree</p>

            {/* Item section */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Item</p>
            <div className="space-y-0.5">
              {rootNode && renderNodeTree(rootNode, 0, bookChildren.length === 0 && itemChildren.length === 0, '', itemChildren)}
            </div>

            {/* Book section */}
            {bookChildren.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-5 mb-2">Book</p>
                <div className="space-y-0.5">
                  {bookChildren.map((bookNode, i) => (
                    <div key={bookNode.id}>
                      {renderNodeTree(bookNode, 0, i === bookChildren.length - 1)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Collaborators */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Collaboration
            </h2>
            <div className="flex gap-2">
              <Input
                value={collabEmail}
                onChange={e => setCollabEmail(e.target.value)}
                placeholder="Enter email to invite…"
                className="bg-secondary/60 border-white/8 rounded-xl h-10 focus:border-primary/50"
              />
              <Button onClick={handleAddCollaborator} variant="outline"
                className="rounded-xl border-white/10 hover:border-primary/40 hover:text-primary gap-1.5 px-4">
                <UserPlus className="w-4 h-4" /> Invite
              </Button>
            </div>
            {collabError && <p className="text-destructive text-sm mt-2">{collabError}</p>}
            {members.length > 0 && (
              <div className="mt-4 space-y-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs text-primary font-bold">
                      {((m.profiles as any)?.full_name || (m.profiles as any)?.email || 'U')[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-foreground font-medium">
                      {(m.profiles as any)?.full_name || (m.profiles as any)?.email}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-lg capitalize">{m.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottleneck Details */}
          {bottlenecks.length > 0 && (
            <div className="glass-strong rounded-2xl border border-white/5 p-6">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Bottleneck Resources
              </h2>
              <div className="space-y-3">
                {bottlenecks.slice(0, 5).map(b => (
                  <div key={b.node_id} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <div>
                      <span className="font-semibold text-sm">{b.display_name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{b.collected_qty}/{b.required_qty} ({b.remaining_qty} needed)</span>
                    </div>
                    <span className="text-xs text-red-400 font-medium">
                      Blocking {b.blocked_ancestors} item{b.blocked_ancestors > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Progress + Activity ────────────────────── */}
        <div className="space-y-5">

          {/* Progress */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-5">Progress</h2>

            {/* Circular progress ring */}
            <div className="flex justify-center mb-5">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(222 35% 12%)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke="hsl(152 80% 48%)" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${progressPct * 2.513} 251.3`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black gradient-text-green">{progressPct}%</span>
                  <span className="text-xs text-muted-foreground">complete</span>
                </div>
              </div>
            </div>

            <Progress value={progressPct} className="h-2 bg-secondary [&>div]:bg-primary rounded-full mb-3" />
            {progress && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {progress.completed_nodes} done</span>
                <span>📦 {progress.completed_resources}/{progress.total_resources} resources</span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Activity Feed
            </h2>
            {contributions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start collecting or crafting!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {contributions.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs text-primary font-bold flex-shrink-0 mt-0.5">
                      {((c.profiles as any)?.full_name || (c.profiles as any)?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold text-foreground">
                          {(c.profiles as any)?.full_name || (c.profiles as any)?.email}
                        </span>
                        <span className="text-muted-foreground"> {c.action} </span>
                        <span className="text-primary font-medium">
                          {(c.crafting_nodes as any)?.display_name || 'item'}
                        </span>
                        <span className="text-muted-foreground"> ×{c.quantity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.created_at).toLocaleString()}
                      </p>
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
