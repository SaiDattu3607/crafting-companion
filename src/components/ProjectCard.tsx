import { type Project } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, CheckCircle, Clock } from 'lucide-react';

interface Props {
  project: Project;
  onClick: () => void;
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

const ProjectCard = ({ project, onClick }: Props) => {
  const status = statusConfig[project.status as keyof typeof statusConfig] ?? statusConfig.active;
  const StatusIcon = status.icon;

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

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-sm text-muted-foreground font-medium capitalize">
            {project.root_item_name?.replace(/_/g, ' ') || 'Unknown item'}
          </span>
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
