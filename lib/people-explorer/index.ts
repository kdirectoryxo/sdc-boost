/**
 * People explorer domain: shared list/filters state and UI used by the view router.
 * The legacy People dialog is a thin shell around PeopleExplorerPanel; it will be
 * removed once navigation fully lives on the router.
 */
export type { PeopleTabId } from '@/lib/view-router/routes';
export { usePeopleExplorerState } from './usePeopleExplorerState';
export { usePeopleEmbeddedProfileDialog } from './usePeopleEmbeddedProfileDialog';
