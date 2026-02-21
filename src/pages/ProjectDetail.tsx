import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProject, contributeToNode, addProjectMember,
  fetchContributions, fetchBottleneck, fetchProgress,
  updateNodeEnchantments,
  type Project, type CraftingNode, type Contribution,
  type BottleneckItem, type ProjectProgress, type ProjectMember,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban, UserPlus, RefreshCw, Loader2, Sparkles, Pencil, Check, X, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { getBookRequirements, toRoman, getBestStrategy, type BookRequirement } from '@/lib/enchantmentBooks';

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
  const [editingEnchantments, setEditingEnchantments] = useState<string | null>(null);
  const [editEnchantmentLevels, setEditEnchantmentLevels] = useState<{ name: string; level: number }[]>([]);
  const [savingEnchantments, setSavingEnchantments] = useState(false);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

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
      }
      // Reload project to get updated state
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

  const handleStartEditEnchantments = (node: CraftingNode) => {
    setEditingEnchantments(node.id);
    setEditEnchantmentLevels(
      (node.enchantments || []).map(e => ({ name: e.name, level: e.level }))
    );
  };

  const handleSaveEnchantments = async (nodeId: string) => {
    setSavingEnchantments(true);
    try {
      await updateNodeEnchantments(id!, nodeId, editEnchantmentLevels);
      setEditingEnchantments(null);
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingEnchantments(false);
    }
  };

  const handleCancelEditEnchantments = () => {
    setEditingEnchantments(null);
    setEditEnchantmentLevels([]);
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
                {Array.isArray(node.enchantments) && node.enchantments.length > 0 && editingEnchantments !== node.id && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    {(node.enchantments as { name: string; level: number }[]).map((en, i) => (
                      <span key={`${en.name}-${i}`} className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-medium">
                        {en.name} {en.level}
                      </span>
                    ))}
                    <button
                      onClick={() => handleStartEditEnchantments(node)}
                      className="text-purple-400/60 hover:text-purple-400 transition-colors ml-1"
                      title="Update enchantment levels"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {Array.isArray(node.enchantments) && node.enchantments.length > 0 && editingEnchantments === node.id && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    {editEnchantmentLevels.map((en, i) => (
                      <span key={`${en.name}-${i}`} className="inline-flex items-center gap-1 text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-medium">
                        {en.name}
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={en.level}
                          onChange={(e) => {
                            const newLevels = [...editEnchantmentLevels];
                            newLevels[i] = { ...newLevels[i], level: Math.max(1, Math.min(10, Number(e.target.value))) };
                            setEditEnchantmentLevels(newLevels);
                          }}
                          className="w-8 h-5 text-center bg-purple-500/30 border border-purple-400/40 rounded text-purple-200 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </span>
                    ))}
                    <button
                      onClick={() => handleSaveEnchantments(node.id)}
                      disabled={savingEnchantments}
                      className="text-green-400 hover:text-green-300 transition-colors ml-1"
                      title="Save levels"
                    >
                      {savingEnchantments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={handleCancelEditEnchantments}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm text-primary">{project.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={loadProject} className="text-muted-foreground">
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

      {/* Enchantment Panel — always shown when root node has enchantments */}
      {rootNodes.filter(r => Array.isArray(r.enchantments) && r.enchantments.length > 0).map(rootNode => {
        const rootStatus = getNodeStatus(rootNode);
        const statusLabel = rootStatus === 'complete'
          ? 'Enchantments Applied'
          : rootStatus === 'ready'
            ? '✨ Ready to Enchant'
            : '🔮 Planned Enchantments';
        const statusDescription = rootStatus === 'complete'
          ? `${rootNode.display_name} has been crafted. Update the actual enchantment levels you got:`
          : rootStatus === 'ready'
            ? `All materials are ready! Apply these enchantments to your ${rootNode.display_name}:`
            : `These enchantments will be applied to ${rootNode.display_name} once crafted. You can update levels after crafting.`;

        return (
          <div key={`enchant-panel-${rootNode.id}`} className="mx-6 mt-4 p-4 pixel-border bg-purple-500/10 border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-sm font-pixel text-purple-400">{statusLabel}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{statusDescription}</p>
            <div className="flex flex-wrap gap-3">
              {editingEnchantments === rootNode.id ? (
                <>
                  {editEnchantmentLevels.map((en, i) => (
                    <div key={`panel-${en.name}-${i}`} className="flex items-center gap-2 bg-purple-500/20 px-3 py-2 rounded-lg border border-purple-500/30">
                      <span className="text-sm font-medium text-purple-300">{en.name}</span>
                      <span className="text-xs text-muted-foreground">Lvl</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={en.level}
                        onChange={(e) => {
                          const newLevels = [...editEnchantmentLevels];
                          newLevels[i] = { ...newLevels[i], level: Math.max(1, Math.min(10, Number(e.target.value))) };
                          setEditEnchantmentLevels(newLevels);
                        }}
                        className="w-12 h-7 text-center bg-purple-500/30 border border-purple-400/40 rounded text-purple-200 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingEnchantments}
                      onClick={() => handleSaveEnchantments(rootNode.id)}
                      className="h-8 px-3 text-green-400 border-green-500/30 hover:bg-green-500/10"
                    >
                      {savingEnchantments ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEditEnchantments}
                      className="h-8 px-3 text-muted-foreground"
                    >
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {(rootNode.enchantments as { name: string; level: number }[]).map((en, i) => (
                    <div key={`panel-${en.name}-${i}`} className="flex items-center gap-2 bg-purple-500/20 px-3 py-2 rounded-lg border border-purple-500/30">
                      <span className="text-sm font-medium text-purple-300">{en.name}</span>
                      <span className="text-sm font-bold text-purple-200">Level {en.level}</span>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEditEnchantments(rootNode)}
                    className="h-9 px-3 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Update Levels
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}

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

          {/* Enchantment Book Guide — shown when root node has enchantments */}
          {rootNodes.filter(r => Array.isArray(r.enchantments) && r.enchantments.length > 0).map(rootNode => {
            const enchantments = rootNode.enchantments as { name: string; level: number }[];
            const bookReqs = getBookRequirements(enchantments);
            const totalBooks = bookReqs.reduce((sum, b) => sum + b.booksNeeded, 0);

            return (
              <div key={`books-${rootNode.id}`} className="pixel-border bg-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xs font-pixel text-muted-foreground">
                    Enchanted Books Needed ({totalBooks} total)
                  </h2>
                </div>

                <div className="space-y-3">
                  {bookReqs.map((req) => {
                    const isExpanded = expandedBook === req.enchantmentName;
                    const strategy = getBestStrategy(req.enchantmentName, req.targetLevel);

                    return (
                      <div key={req.enchantmentName} className="bg-secondary/50 rounded-lg border border-border overflow-hidden">
                        {/* Header */}
                        <button
                          onClick={() => setExpandedBook(isExpanded ? null : req.enchantmentName)}
                          className="w-full flex items-center justify-between p-3 hover:bg-secondary/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">📕</span>
                            <div>
                              <span className="font-bold text-base text-foreground">
                                {req.displayName} {toRoman(req.targetLevel)}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {req.booksNeeded === 1
                                  ? '1 book needed'
                                  : `${req.booksNeeded} books needed`}
                              </span>
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                            {/* Best strategy */}
                            <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-sm">
                              <span className="text-amber-400 font-bold">💡</span>
                              <span className="text-amber-200/90">{strategy}</span>
                            </div>

                            {/* Anvil combining steps */}
                            {req.anvilSteps.length > 0 && (
                              <div>
                                <h4 className="text-xs font-pixel text-muted-foreground mb-2">Anvil Combining</h4>
                                <div className="space-y-1">
                                  {req.anvilSteps.map((step) => (
                                    <div key={step.step} className="flex items-center gap-2 text-sm pl-2">
                                      <span className="text-muted-foreground font-mono text-xs w-5">#{step.step}</span>
                                      <span className="text-foreground">
                                        {step.count}× {toRoman(step.inputLevel)} + {toRoman(step.inputLevel)}
                                      </span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="text-purple-400 font-medium">
                                        {step.count}× {toRoman(step.outputLevel)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Source locations */}
                            <div>
                              <h4 className="text-xs font-pixel text-muted-foreground mb-2">Where to Find</h4>
                              <div className="space-y-1.5">
                                {req.sources.map((src, i) => (
                                  <div key={i} className="flex items-start gap-2 text-sm pl-2">
                                    <span className="flex-shrink-0">{src.icon}</span>
                                    <div>
                                      <span className="font-medium text-foreground">{src.method}</span>
                                      <span className="text-muted-foreground"> — {src.description}</span>
                                      <span className="text-xs text-purple-400 ml-1">(up to lvl {src.maxLevel})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

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
