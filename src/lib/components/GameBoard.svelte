<script lang="ts">
  import type { Tetromino } from '$lib/game/types'

  interface Props {
    board: number[][]
    colorBoard: string[][]
    currentPiece: Tetromino | null
    shadowY?: number
    cellSize?: number
    showGhost?: boolean
    flipped?: boolean
  }

  let {
    board,
    colorBoard,
    currentPiece,
    shadowY = 0,
    cellSize = 30,
    showGhost = true,
    flipped = false,
  }: Props = $props()

  function getCellColor(row: number, col: number): string {
    // Check if this cell is part of the current piece
    if (currentPiece) {
      const { position, shape } = currentPiece
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x] && position.x + x === col && position.y + y === row) {
            return currentPiece.color
          }
        }
      }
    }

    // Check if this cell is part of the shadow
    if (showGhost && currentPiece && shadowY > 0) {
      const { position, shape } = currentPiece
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x] && position.x + x === col && shadowY + y === row) {
            return currentPiece.color + '40' // Semi-transparent
          }
        }
      }
    }

    // Check if this cell is locked on the board
    if (board[row][col]) {
      return colorBoard[row][col]
    }

    return ''
  }
</script>

<div
  class="game-board relative border-4 border-gray-700 bg-gray-900 shadow-xl"
  style="width: {board[0].length * cellSize}px; height: {board.length *
    cellSize}px; transform: {flipped ? 'rotate(180deg)' : 'none'};"
>
  {#each board as row, y}
    {#each row as _, x}
      {@const color = getCellColor(y, x)}
      <div
        class="cell absolute border border-gray-800/30 transition-colors duration-75"
        style="
					width: {cellSize}px;
					height: {cellSize}px;
					left: {x * cellSize}px;
					top: {y * cellSize}px;
					background-color: {color || 'transparent'};
					box-shadow: {color && !color.includes('40')
          ? 'inset 0 0 10px rgba(255,255,255,0.3)'
          : 'none'};
				"
      ></div>
    {/each}
  {/each}
</div>

<style>
  .game-board {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .cell {
    box-sizing: border-box;
  }
</style>
