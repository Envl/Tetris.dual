// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				MATCHMAKING: DurableObjectNamespace;
				DB: D1Database;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}

		interface Locals {
			session: import('@auth/core/types').Session | null;
		}
	}
}

export {};
