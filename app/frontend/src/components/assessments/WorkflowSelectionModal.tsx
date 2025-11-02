import * as React from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Bot, Puzzle, Hand } from 'lucide-react';

export type WorkflowMode = 'auto' | 'hybrid' | 'manual';

interface WorkflowSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: WorkflowMode) => void;
}

interface WorkflowOption {
  mode: WorkflowMode;
  icon: React.ReactNode;
  label: string;
  description: string;
}

export const WorkflowSelectionModal = ({ open, onClose, onSelect }: WorkflowSelectionModalProps) => {
  const workflows: WorkflowOption[] = [
    {
      mode: 'auto',
      icon: <Bot className="h-8 w-8" />,
      label: 'AI builds your entire assessment.',
      description: 'You set the parameters, AI generates the entire assessment instantly.'
    },
    {
      mode: 'hybrid',
      icon: <Puzzle className="h-8 w-8" />,
      label: 'AI suggests, you curate.',
      description: 'AI proposes questions; you review and approve or regenerate.'
    },
    {
      mode: 'manual',
      icon: <Hand className="h-8 w-8" />,
      label: 'You pick everything.',
      description: 'Browse and hand-pick questions manually.'
    }
  ];

  if (!open) return null;

  const handleSelect = (mode: WorkflowMode) => {
    onSelect(mode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative flex w-full max-w-4xl flex-col overflow-hidden">
        <CardHeader className="border-b">
          <h2 className="text-2xl font-semibold">Select Assessment Generation Workflow</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how you want to generate your assessment questions
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <Card
                key={workflow.mode}
                className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary"
                onClick={() => handleSelect(workflow.mode)}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    {workflow.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{workflow.label}</h3>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    {workflow.description}
                  </p>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(workflow.mode);
                    }}
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkflowSelectionModal;
