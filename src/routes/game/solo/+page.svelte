<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import GameBoard from '$lib/components/GameBoard.svelte';
	import NextPieces from '$lib/components/NextPieces.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import GameControls from '$lib/components/GameControls.svelte';
	import { TetrisEngine, BOARD_WIDTH, BOARD_HEIGHT } from '$lib/game/engine';

	let engine: TetrisEngine;
	let gameState = $state({
		board: [] as number[][],
		colorBoard: [] as string[][],
		currentPiece: null as any,
		nextPieces: [] as any[],
		score: 0,
		linesCleared: 0,
		level: 1,
		gameOver: false,
		shadowY: 0
	});

	let gameInterval: ReturnType<typeof setInterval>;
	let dropSpeed = $state(1000);
	let isPaused = $state(false);

	onMount(() => {
		engine = new TetrisEngine(false);
		engine.initialize();
		updateGameState();
		startGameLoop();

		// Keyboard controls
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		if (gameInterval) clearInterval(gameInterval);
		window.removeEventListener('keydown', handleKeyDown);
	});

	function startGameLoop() {
		gameInterval = setInterval(() => {
			if (!isPaused && !gameState.gameOver) {
				const moved = engine.move('down');
				updateGameState();
			}
		}, dropSpeed);
	}

	function updateGameState() {
		gameState.board = engine.getBoard();
		gameState.colorBoard = engine.getColorBoard();
		gameState.currentPiece = engine.getCurrentPiece();
		gameState.nextPieces = engine.getNextPieces();
		gameState.score = engine.getScore();
		gameState.linesCleared = engine.getLinesCleared();
		gameState.level = engine.getLevel();
		gameState.gameOver = engine.isGameOver();
		gameState.shadowY = engine.calculateShadowPosition();

		// Adjust speed based on level
		const newSpeed = Math.max(100, 1000 - (gameState.level - 1) * 50);
		if (newSpeed !== dropSpeed) {
			dropSpeed = newSpeed;
			clearInterval(gameInterval);
			startGameLoop();
		}

		if (gameState.gameOver) {
			clearInterval(gameInterval);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (gameState.gameOver) return;

		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				engine.move('left');
				break;
			case 'ArrowRight':
				e.preventDefault();
				engine.move('right');
				break;
			case 'ArrowDown':
				e.preventDefault();
				engine.move('down');
				break;
			case 'ArrowUp':
			case ' ':
				e.preventDefault();
				engine.move('rotate');
				break;
			case 'Enter':
				e.preventDefault();
				engine.drop();
				break;
			case 'Escape':
				e.preventDefault();
				isPaused = !isPaused;
				break;
		}
		updateGameState();
	}

	function handleLeft() {
		engine.move('left');
		updateGameState();
	}

	function handleRight() {
		engine.move('right');
		updateGameState();
	}

	function handleRotate() {
		engine.move('rotate');
		updateGameState();
	}

	function handleDrop() {
		engine.drop();
		updateGameState();
	}

	function handleDown() {
		engine.move('down');
		updateGameState();
	}

	function restart() {
		clearInterval(gameInterval);
		engine.initialize();
		updateGameState();
		isPaused = false;
		startGameLoop();
	}
</script>

<div class="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="flex justify-between items-center mb-4">
			<button
				onclick={() => goto('/')}
				class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
			>
				← Back
			</button>
			<h1 class="text-3xl font-bold text-white">Solo Mode</h1>
			<button
				onclick={() => (isPaused = !isPaused)}
				class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
			>
				{isPaused ? '▶ Resume' : '⏸ Pause'}
			</button>
		</div>

		<!-- Game Area -->
		<div class="flex flex-col lg:flex-row gap-8 items-start justify-center">
			<!-- Left Panel: Score and Next Pieces -->
			<div class="space-y-4">
				<ScoreBoard score={gameState.score} lines={gameState.linesCleared} level={gameState.level} />
				<NextPieces pieces={gameState.nextPieces} />
			</div>

			<!-- Center: Game Board -->
			<div class="flex flex-col items-center gap-4">
				{#if gameState.board.length > 0}
					<GameBoard
						board={gameState.board}
						colorBoard={gameState.colorBoard}
						currentPiece={gameState.currentPiece}
						shadowY={gameState.shadowY}
						cellSize={30}
						showGhost={true}
					/>
				{/if}

				<!-- Mobile Controls -->
				<div class="lg:hidden w-full">
					<GameControls
						onLeft={handleLeft}
						onRight={handleRight}
						onRotate={handleRotate}
						onDrop={handleDrop}
						onDown={handleDown}
					/>
				</div>
			</div>

			<!-- Right Panel: Instructions -->
			<div class="bg-gray-800 p-4 rounded-lg border border-gray-700 max-w-xs">
				<h3 class="text-lg font-bold text-white mb-2">Controls</h3>
				<div class="text-gray-300 text-sm space-y-1">
					<p><strong>← →</strong> Move</p>
					<p><strong>↓</strong> Soft drop</p>
					<p><strong>↑ / Space</strong> Rotate</p>
					<p><strong>Enter</strong> Hard drop</p>
					<p><strong>ESC</strong> Pause</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Game Over Modal -->
	{#if gameState.gameOver}
		<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div class="bg-gray-800 p-8 rounded-lg border-4 border-red-500 max-w-md">
				<h2 class="text-3xl font-bold text-white mb-4">Game Over!</h2>
				<div class="text-gray-300 space-y-2 mb-6">
					<p class="text-xl">Final Score: <strong class="text-yellow-400">{gameState.score}</strong></p>
					<p>Lines Cleared: <strong>{gameState.linesCleared}</strong></p>
					<p>Level: <strong>{gameState.level}</strong></p>
				</div>
				<div class="flex gap-4">
					<button
						onclick={restart}
						class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
					>
						Play Again
					</button>
					<button
						onclick={() => goto('/')}
						class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
					>
						Menu
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pause Overlay -->
	{#if isPaused && !gameState.gameOver}
		<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
			<div class="bg-gray-800 p-8 rounded-lg border-4 border-yellow-500">
				<h2 class="text-3xl font-bold text-white">Paused</h2>
			</div>
		</div>
	{/if}
</div>
