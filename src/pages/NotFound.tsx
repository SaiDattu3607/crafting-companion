import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const NotFound = () => (
  <div className="min-h-screen mesh-bg flex items-center justify-center text-center px-6">
    <div className="animate-slide-up">
      <div className="text-8xl mb-6 animate-float">⛏</div>
      <h1 className="text-6xl font-black gradient-text-green mb-3">404</h1>
      <h2 className="text-2xl font-bold text-foreground mb-3">Page Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
        Looks like you've wandered into uncharted territory. This block doesn't exist.
      </p>
      <Button asChild className="btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 px-8">
        <Link to="/"><Home className="w-4 h-4" /> Back to Home</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;
