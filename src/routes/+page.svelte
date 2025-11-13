<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
	<div class="text-center space-y-8 p-8">
		<h1 class="text-6xl font-bold text-white mb-4 animate-pulse">
			Tetris<span class="text-cyan-400">.dual</span>
		</h1>
		<p class="text-xl text-gray-300 mb-8">Classic Tetris with Dual Mode</p>

		<div class="space-y-4 max-w-md mx-auto">
			<button
				onclick={() => goto('/game/solo')}
				class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
			>
				Solo Mode
			</button>

			<button
				onclick={() => goto('/game/dual')}
				class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
			>
				Dual Mode (Multiplayer)
			</button>

			<button
				onclick={() => goto('/auth/signin')}
				class="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
			>
				Sign In with Google
			</button>
		</div>

		<div class="mt-12 text-gray-400 text-sm">
			<p>Use arrow keys or touch controls to play</p>
			<p class="mt-2">Clear lines to shift your opponent's board in Dual Mode!</p>
		</div>
	</div>
</div>
