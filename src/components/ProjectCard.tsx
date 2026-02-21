import { calculateProgress, type Project } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Props {
  project: Project;
  onClick: () => void;
}

const ProjectCard = ({ project, onClick }: Props) => {
  const progress = calculateProgress(project);

  return (
    <Card
      className="pixel-border cursor-pointer hover:border-primary transition-colors bg-card"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-pixel">{project.name}</CardTitle>
        <p className="text-lg text-muted-foreground">{project.description}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-lg mb-2">
          <span className="text-muted-foreground">{project.requirements.length} items</span>
          <span className={progress === 100 ? 'text-craft-complete' : 'text-craft-pending'}>{progress}%</span>
        </div>
        <Progress value={progress} className="h-3 bg-secondary [&>div]:bg-primary" />
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
