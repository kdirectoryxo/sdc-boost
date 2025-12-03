// Big thanks to SD-Gaming for passing us this hook in the Dexie issues
// https://github.com/dexie/Dexie.js/issues/1528#issuecomment-1085388832
import { liveQuery } from 'dexie';
import { onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

interface UseLiveQueryOptions {
	onError?: (err: any) => void;
}

export function useLiveQuery<T>(
	querier: () => T | Promise<T>,
	deps: Ref<any>[] = [],
	options?: UseLiveQueryOptions
): Readonly<Ref<T | undefined>> {
	const value = ref<T | undefined>();
	const observable = liveQuery<T>(querier);
	let subscription = observable.subscribe({
		next: (val) => {
			value.value = val;
		},
		error: options?.onError
	});

	watch(deps, () => {
		subscription.unsubscribe();
		subscription = observable.subscribe({
			next: (val) => {
				value.value = val;
			},
			error: options?.onError
		});
	});

	onUnmounted(() => {
		subscription.unsubscribe();
	});
	return value as Readonly<Ref<T>>;
}

