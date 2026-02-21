import { type Project } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  project: Project;
  onClick: () => void;
}

const ProjectCard = ({ project, onClick }: Props) => {
  return (
    <Card
      className="pixel-border cursor-pointer hover:border-primary transition-colors bg-card"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-pixel">{project.name}</CardTitle>
          <Badge variant={project.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
            {project.status}
          </Badge>
        </div>
        <p className="text-lg text-muted-foreground">{project.description}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-lg">
          <span className="text-muted-foreground">🎯 {project.root_item_name?.replace(/_/g, ' ')}</span>
          {project.role && (
            <Badge variant="outline" className="text-xs">{project.role}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
