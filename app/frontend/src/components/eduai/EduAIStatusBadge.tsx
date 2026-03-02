/**
 * Small status badge indicating AI service availability with optional refresh action.
 */
import { RefreshCw } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

type EduAIStatus = 'loading' | 'ok' | 'error';

interface EduAIStatusBadgeProps {
  status: EduAIStatus;
  message?: string;
  onRefresh?: () => void;
  compact?: boolean;
  className?: string;
}

const statusStyles: Record<EduAIStatus, string> = {
  loading: 'bg-gray-300 text-gray-700',
  ok: 'bg-emerald-500 text-emerald-50',
  error: 'bg-red-500 text-red-50',
};

export const EduAIStatusBadge = ({ status, message, onRefresh, compact = false, className }: EduAIStatusBadgeProps) => {
  const dotColor =
    status === 'ok' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400';

  const content = (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} aria-hidden />
      <span className="text-gray-700">AI service</span>
      {status === 'loading' && <span className="text-gray-500">Checking…</span>}
      {status === 'error' && <span className="text-red-600">Unavailable</span>}
      {status === 'ok' && <span className="text-emerald-700">Online</span>}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="ml-1 inline-flex items-center rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Refresh AI service status"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  return (
    <Tooltip content={message || 'AI service status'} side="bottom" className={className}>
      {content}
    </Tooltip>
  );
};

export default EduAIStatusBadge;
