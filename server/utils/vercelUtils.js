import { waitUntil, getCache } from '@vercel/functions';

/**
 * Runs non-blocking async work safely inside Vercel's request lifecycle (`waitUntil`)
 * when deployed on Vercel Functions, or detaches with error logging locally.
 * Prevents serverless instances from freezing before emails/notifications finish.
 */
export const runInBackground = (taskPromise, label = 'background-task') => {
  if (!taskPromise || typeof taskPromise.then !== 'function') return;

  const safePromise = Promise.resolve(taskPromise).catch((err) => {
    console.warn(`⚠️ [${label}] Background task error:`, err?.message || err);
  });

  if (process.env.VERCEL && process.env.VERCEL_URL) {
    try {
      waitUntil(safePromise);
    } catch {
      // Outside active Vercel request context (e.g., unit test or CLI script)
    }
  }
};

/**
 * Returns Vercel Runtime Cache scoped to a namespace when deployed on Vercel,
 * or null in local/non-Vercel environments so callers fall back cleanly.
 */
export const getSharedRuntimeCache = (namespace) => {
  if (!process.env.VERCEL) return null;
  try {
    return getCache({ namespace });
  } catch {
    return null;
  }
};
