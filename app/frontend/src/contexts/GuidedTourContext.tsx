import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TourId, TourStep } from '../tour/tourTypes';
import { tourSteps } from '../tour/tourSteps';
import { cn } from '../lib/utils';

type TourState = {
  steps: TourStep[];
  currentIndex: number;
  isActive: boolean;
};

type GuidedTourContextValue = {
  startTour: (id: TourId) => void;
  stopTour: () => void;
  /** Register a callback to run when the tour ends (Done or Skip). Returns unregister function. */
  registerOnTourEnd: (callback: () => void) => () => void;
  /** Register a callback to run when Next is clicked on a specific step (e.g. navigate). Overrides default click behavior. Returns unregister function. */
  registerStepAction: (stepId: string, callback: () => void) => () => void;
  isActive: boolean;
  activeTourId: TourId | null;
};

const GuidedTourContext = createContext<GuidedTourContextValue | undefined>(undefined);

type HighlightPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

const getTarget = (step: TourStep | undefined) =>
  step ? (document.querySelector(`[data-tour-id="${step.id}"]`) as HTMLElement | null) : null;

const clampToViewport = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const Tooltip = ({
  step,
  position,
  onNext,
  onPrev,
  onClose,
  isFirst,
  isLast
}: {
  step: TourStep;
  position: HighlightPosition;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const hasTarget = Boolean(position);
  const padding = 12;
  let top = hasTarget ? position!.top + position!.height + padding : window.scrollY + 120;
  let left = hasTarget ? position!.left : window.scrollX + 24;

  if (hasTarget) {
    if (step.placement === 'top') {
      top = position!.top - padding;
    } else if (step.placement === 'left') {
      left = position!.left - padding;
    } else if (step.placement === 'right') {
      left = position!.left + position!.width + padding;
    }
  }

  const maxLeft = document.documentElement.scrollWidth - 320;
  left = clampToViewport(left, 12, maxLeft);

  return (
    <div
      className="fixed z-[10002] w-[320px] pointer-events-auto"
      style={{ top, left }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="rounded-lg bg-white shadow-xl border border-gray-200 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Step</p>
            <h4 className="font-semibold text-gray-900">{step.title}</h4>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm"
            aria-label="Close tour"
          >
            Skip
          </button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{step.content}</p>
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={onPrev}
            className={cn(
              'px-3 py-1 rounded border text-sm',
              isFirst
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:border-gray-400'
            )}
            disabled={isFirst}
          >
            Back
          </button>
          <button
            onClick={isLast ? onClose : onNext}
            className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
        {!hasTarget && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            If you don’t see the highlight, open the dialog or section for this step, then hit Next.
          </p>
        )}
      </div>
    </div>
  );
};

const GuidedTourOverlay = ({
  step,
  onNext,
  onPrev,
  onClose,
  index,
  total
}: {
  step: TourStep;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  index: number;
  total: number;
}) => {
  const [position, setPosition] = useState<HighlightPosition>(null);
  const [hasMeasured, setHasMeasured] = useState(false);

  useEffect(() => {
    setHasMeasured(false);
    setPosition(null);
  }, [step]);

  useEffect(() => {
    const target = getTarget(step);
    if (!target) {
      setPosition(null);
      setHasMeasured(true);
      return;
    }

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      setPosition({
        top: top - 8,
        left: left - 8,
        width: rect.width + 16,
        height: rect.height + 16
      });
      setHasMeasured(true);
    };

    const observer = new ResizeObserver(updatePosition);
    observer.observe(target);
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step]);

  if (!hasMeasured) {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 z-[10000] pointer-events-none" />
      {position && (
        <div
          className="fixed z-[10001] rounded-lg border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            height: position.height,
            transition: 'all 0.2s ease'
          }}
        />
      )}
      <Tooltip
        step={step}
        position={position}
        onNext={onNext}
        onPrev={onPrev}
        onClose={onClose}
        isFirst={index === 0}
        isLast={index === total - 1}
      />
    </>,
    document.body
  );
};

export const GuidedTourProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TourState>({ steps: [], currentIndex: 0, isActive: false });
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const onTourEndRef = useRef<(() => void) | null>(null);
  const stepActionOverridesRef = useRef<Map<string, () => void>>(new Map());

  const registerStepAction = useCallback((stepId: string, callback: () => void) => {
    stepActionOverridesRef.current.set(stepId, callback);
    return () => {
      stepActionOverridesRef.current.delete(stepId);
    };
  }, []);

  const runStepAction = useCallback((step: TourStep | undefined) => {
    if (!step) return;

    const override = stepActionOverridesRef.current.get(step.id);
    if (override) {
      override();
      return;
    }

    // Default: some steps trigger a click to move the user forward (navigate or switch tab).
    if (step.id === 'course-select' || step.id === 'assessment-tab') {
      const target = getTarget(step);
      target?.click();
    }
  }, []);

  const registerOnTourEnd = useCallback((callback: () => void) => {
    onTourEndRef.current = callback;
    return () => {
      onTourEndRef.current = null;
    };
  }, []);

  const stopTour = useCallback(() => {
    const onEnd = onTourEndRef.current;
    onTourEndRef.current = null;
    stepActionOverridesRef.current.clear();
    setState({ steps: [], currentIndex: 0, isActive: false });
    setActiveTourId(null);
    onEnd?.();
  }, []);

  const advanceTo = useCallback(
    (nextIndex: number) => {
      setState((prev) => {
        if (!prev.isActive) return prev;
        if (!prev.steps[nextIndex]) {
          return prev;
        }
        return { ...prev, currentIndex: nextIndex };
      });
    },
    []
  );

  const startTour = useCallback(
    (id: TourId) => {
      const steps = tourSteps[id] ?? [];
      if (steps.length === 0) {
        return;
      }
      setActiveTourId(id);
      setState({ steps, currentIndex: 0, isActive: true });
    },
    []
  );

  const value = useMemo(
    () => ({
      startTour,
      stopTour,
      registerOnTourEnd,
      registerStepAction,
      isActive: state.isActive,
      activeTourId
    }),
    [startTour, stopTour, registerOnTourEnd, registerStepAction, state.isActive, activeTourId]
  );

  const step = state.isActive ? state.steps[state.currentIndex] : null;

  return (
    <GuidedTourContext.Provider value={value}>
      {children}
      {state.isActive && step && (
        <GuidedTourOverlay
          step={step}
          index={state.currentIndex}
          total={state.steps.length}
          onNext={() => {
            runStepAction(step);
            setTimeout(() => advanceTo(state.currentIndex + 1), 100);
          }}
          onPrev={() => advanceTo(Math.max(0, state.currentIndex - 1))}
          onClose={stopTour}
        />
      )}
    </GuidedTourContext.Provider>
  );
};

export const useGuidedTour = () => {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error('useGuidedTour must be used within GuidedTourProvider');
  }
  return ctx;
};
