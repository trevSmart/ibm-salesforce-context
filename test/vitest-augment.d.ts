// Ensure TypeScript sees our custom matcher in editors
import 'vitest'

declare module 'vitest' {
	interface Assertion {
		toBeTruthyAndDump(dump: unknown): void
	}
}
