import { type Project } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, CheckCircle, Clock, Trash2, CircleCheck, Undo2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  project: Project;
  onClick: () => void;
  onDelete?: (id: string) => Promise<void>;
  onToggleDone?: (id: string, done: boolean) => Promise<void>;
}

const statusConfig = {
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'badge-complete',
  },
  active: {
    label: 'Active',
    icon: Clock,
    className: 'badge-pending',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'badge-pending',
  },
};

const ProjectCard = ({ project, onClick, onDelete, onToggleDone }: Props) => {
  const status = statusConfig[project.status as keyof typeof statusConfig] ?? statusConfig.active;
  const StatusIcon = status.icon;
  const isDone = project.status === 'completed';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (!onDelete) return;
    setBusy(true);
    await onDelete(project.id);
    setBusy(false);
  };

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleDone) return;
    setBusy(true);
    await onToggleDone(project.id, !isDone);
    setBusy(false);
  };

  return (
    <div
      onClick={onClick}
      className="glass card-glow rounded-2xl border border-white/5 p-5 cursor-pointer group relative overflow-hidden"
    >
      {/* Subtle shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: 'linear-gradient(135deg, hsl(152 80% 48% / 0.04) 0%, transparent 60%)' }} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2 flex-1">
          {project.name}
        </h3>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${status.className}`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-muted-foreground text-sm line-clamp-2 mb-4 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Target item */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🎯</span>
        <span className="text-sm text-muted-foreground font-medium capitalize">
          {project.root_item_name?.replace(/_/g, ' ') || 'Unknown item'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleDone}
            disabled={busy}
            className={`h-8 px-3 rounded-xl text-xs gap-1.5 ${
              isDone
                ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDone ? (
              <><Undo2 className="w-3.5 h-3.5" /> Reopen</>
            ) : (
              <><CircleCheck className="w-3.5 h-3.5" /> Done</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={busy}
            className={`h-8 px-3 rounded-xl text-xs gap-1.5 ${
              confirmDelete
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-muted-foreground hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <><Trash2 className="w-3.5 h-3.5" /> {confirmDelete ? 'Confirm?' : 'Delete'}</>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {project.role && (
            <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-lg capitalize">
              {project.role}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
