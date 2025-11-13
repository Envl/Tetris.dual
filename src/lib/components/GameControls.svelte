<script lang="ts">
	interface Props {
		onLeft: () => void;
		onRight: () => void;
		onRotate: () => void;
		onDrop: () => void;
		onDown: () => void;
	}

	let { onLeft, onRight, onRotate, onDrop, onDown }: Props = $props();

	function handleTouchButton(callback: () => void) {
		return (e: TouchEvent | MouseEvent) => {
			e.preventDefault();
			callback();
		};
	}
</script>

<div class="controls grid grid-cols-3 gap-4 w-full max-w-sm mx-auto touch-none select-none">
	<!-- Rotate button -->
	<button
		ontouchstart={handleTouchButton(onRotate)}
		onmousedown={handleTouchButton(onRotate)}
		class="col-start-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-all"
	>
		↻
	</button>

	<!-- Drop button -->
	<button
		ontouchstart={handleTouchButton(onDrop)}
		onmousedown={handleTouchButton(onDrop)}
		class="col-start-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-all"
	>
		⬇⬇
	</button>

	<!-- Left button -->
	<button
		ontouchstart={handleTouchButton(onLeft)}
		onmousedown={handleTouchButton(onLeft)}
		class="col-start-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-all"
	>
		←
	</button>

	<!-- Down button -->
	<button
		ontouchstart={handleTouchButton(onDown)}
		onmousedown={handleTouchButton(onDown)}
		class="col-start-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-all"
	>
		↓
	</button>

	<!-- Right button -->
	<button
		ontouchstart={handleTouchButton(onRight)}
		onmousedown={handleTouchButton(onRight)}
		class="col-start-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-all"
	>
		→
	</button>
</div>

<style>
	button {
		-webkit-tap-highlight-color: transparent;
		user-select: none;
		touch-action: manipulation;
	}
</style>
