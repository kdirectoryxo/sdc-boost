/**
 * Vue-compatible global state store for SDC Database using VueUse
 */

import { createGlobalState } from '@vueuse/core';
import { ref } from 'vue';
import { initializeDatabase as initDb } from './init';

/**
 * Vue composable for accessing SDC Database store
 * Uses createGlobalState to ensure state is shared across all Vue instances
 */
export const useSDCDatabaseStore = createGlobalState(() => {
  const isLoading = ref(false);
  const isReady = ref(false);
  const error = ref<string | null>(null);

  async function initialize() {
    console.log('[SDCDB Store] initialize() called');
    console.log('[SDCDB Store] Current state:', { isLoading: isLoading.value, isReady: isReady.value, error: error.value });
    
    isLoading.value = true;
    error.value = null;
    console.log('[SDCDB Store] Set isLoading = true');
    
    try {
      console.log('[SDCDB Store] Calling initDb()...');
      await initDb();
      console.log('[SDCDB Store] initDb() completed successfully');
      
      isLoading.value = false;
      isReady.value = true;
      error.value = null;
      console.log('[SDCDB Store] Updated state:', { isLoading: isLoading.value, isReady: isReady.value, error: error.value });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SDCDB Store] Initialization failed:', err);
      isLoading.value = false;
      isReady.value = false;
      error.value = errorMessage;
      console.log('[SDCDB Store] Error state:', { isLoading: isLoading.value, isReady: isReady.value, error: error.value });
    }
  }

  function reset() {
    isLoading.value = false;
    isReady.value = false;
    error.value = null;
  }

  return {
    isLoading,
    isReady,
    error,
    initialize,
    reset,
  };
});
