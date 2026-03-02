/**
 * Shared AI service status hook backed by a module-level store so all consumers stay in sync.
 * Calls the backend test endpoint once and lets any component trigger a refresh for everyone.
 */
import { useSyncExternalStore } from 'react';
import eduaiService from '../services/eduaiService';

type Status = 'loading' | 'ok' | 'error';

type EduAIState = {
    status: Status;
    message?: string;
};

let state: EduAIState = { status: 'loading', message: 'Checking AI service status' };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

const notify = () => listeners.forEach((l) => l());

const setState = (next: EduAIState) => {
    state = next;
    notify();
};

const fetchStatus = async () => {
    try {
        const result = (await Promise.race([
            eduaiService.testApiKey(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('AI service status check timed out')), 10000)
            ),
        ])) as any;

        if (result?.success) {
            setState({ status: 'ok', message: 'AI service is online' });
        } else {
            setState({ status: 'error', message: 'AI service is unavailable. AI features will be disabled.' });
        }
    } catch {
        setState({ status: 'error', message: 'AI service is unavailable. AI features will be disabled.' });
    }
};

export const refreshEduAIStatus = async () => {
    if (inflight) return inflight;
    setState({ status: 'loading', message: 'Checking AI service status' });
    inflight = fetchStatus().finally(() => {
        inflight = null;
    });
    return inflight;
};

// Kick off an initial check once at module load, but only if user is authenticated
// This prevents 401 errors and infinite redirect loops on the login page
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (token) {
  refreshEduAIStatus();
} else {
  // Set initial state to error if not authenticated
  setState({ status: 'error', message: 'AI service status unavailable - please log in' });
}

export const useEduAIStatus = () => {
    const subscribe = (callback: () => void) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    };

    const getSnapshot = () => state;

    const { status, message } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return {
        status,
        message,
        refresh: refreshEduAIStatus,
    };
};

export default useEduAIStatus;
