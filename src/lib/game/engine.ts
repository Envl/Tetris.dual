import type { GameState, Tetromino, Position, Direction } from './types'
import { TETROMINOS, getRandomTetromino } from './tetrominos'

export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20
export const EXTENDED_HEIGHT = 44 // For dual mode: 22 rows per player
export const CENTER_LINE = 22 // The shared boundary in dual mode

export interface PieceLockedEventPayload {
  board: number[][]
  colorBoard: string[][]
  score: number
  linesCleared: number
  level: number
}

export class TetrisEngine {
  private board: number[][]
  private colorBoard: string[][]
  private currentPiece: Tetromino | null = null
  private nextPieces: Tetromino[] = []
  private score = 0
  private linesCleared = 0
  private level = 1
  private gameOver = false
  private isDualMode: boolean
  private isPlayer1: boolean // In dual mode: player 1 plays upward from center, player 2 downward
  private opponentBoard: number[][] = [] // Opponent's locked pieces for collision detection
  private pieceLockedCallback?: (payload: PieceLockedEventPayload) => void

  constructor(isDualMode = false, isPlayer1 = true) {
    this.isDualMode = isDualMode
    this.isPlayer1 = isPlayer1
    const height = isDualMode ? EXTENDED_HEIGHT : BOARD_HEIGHT
    this.board = Array(height)
      .fill(0)
      .map(() => Array(BOARD_WIDTH).fill(0))
    this.colorBoard = Array(height)
      .fill('')
      .map(() => Array(BOARD_WIDTH).fill(''))

    // In dual mode, initialize 2 gray obstacle blocks at mirrored positions
    // 1 dot in Player 1's territory, 1 dot in Player 2's territory
    // Both on adjacent rows at the center line
    if (isDualMode) {
      const leftX = Math.floor(BOARD_WIDTH / 2) - 2
      const rightX = Math.floor(BOARD_WIDTH / 2) + 1

      // Both dots at CENTER_LINE-1 and CENTER_LINE (rows 21 and 22)
      // so they are adjacent with no gap
      this.board[CENTER_LINE - 1][leftX] = 1
      this.colorBoard[CENTER_LINE - 1][leftX] = '#6f6f6f'

      this.board[CENTER_LINE][rightX] = 1
      this.colorBoard[CENTER_LINE][rightX] = '#6f6f6f'
    }
  }

  initialize(): void {
    this.score = 0
    this.linesCleared = 0
    this.level = 1
    this.gameOver = false

    // Initialize with 3 next pieces
    this.nextPieces = [
      this.createTetromino(),
      this.createTetromino(),
      this.createTetromino(),
    ]
    this.spawnPiece()
  }

  private createTetromino(): Tetromino {
    const type = getRandomTetromino()
    const tetrominoData = TETROMINOS[type]
    return {
      type,
      shape: tetrominoData.shape[0],
      color: tetrominoData.color,
      position: { x: 3, y: 0 },
      rotation: 0,
    }
  }

  private spawnPiece(): void {
    this.currentPiece = this.nextPieces.shift()!
    this.nextPieces.push(this.createTetromino())

    // In dual mode, spawn position depends on which player
    if (this.isDualMode) {
      if (this.isPlayer1) {
        // Player 1: spawn at top, pieces fall down toward center (row 22)
        this.currentPiece.position = { x: 3, y: 0 }
      } else {
        // Player 2: spawn at bottom, pieces fall up toward center (row 22)
        // Spawn so the bottom of the piece is at row 43 (last valid row)
        this.currentPiece.position = {
          x: 3,
          y: EXTENDED_HEIGHT - this.currentPiece.shape.length,
        }
      }
    } else {
      this.currentPiece.position = { x: 3, y: 0 }
    }

    if (
      !this.isValidPosition(this.currentPiece.position, this.currentPiece.shape)
    ) {
      this.gameOver = true
    }
  }

  move(direction: Direction): boolean {
    if (!this.currentPiece || this.gameOver) return false

    let newPosition = { ...this.currentPiece.position }
    let newShape = this.currentPiece.shape
    let newRotation = this.currentPiece.rotation

    switch (direction) {
      case 'left':
        newPosition.x--
        break
      case 'right':
        newPosition.x++
        break
      case 'down':
        // In dual mode for player 2, "down" means y decreases (moving up toward center)
        if (this.isDualMode && !this.isPlayer1) {
          newPosition.y--
        } else {
          newPosition.y++
        }
        break
      case 'rotate':
        const tetrominoData = TETROMINOS[this.currentPiece.type]
        newRotation =
          (this.currentPiece.rotation + 1) % tetrominoData.shape.length
        newShape = tetrominoData.shape[newRotation]
        break
    }

    // In dual mode, check if piece is going out of bounds (disappear and spawn new)
    if (this.isDualMode && direction === 'down' && !this.gameOver) {
      const wouldGoOutOfBounds = this.wouldPieceGoOutOfBounds(
        newPosition,
        newShape
      )
      if (wouldGoOutOfBounds) {
        // Piece crossed the boundary - just spawn new piece without locking
        this.spawnPiece()
        return false
      }
    }

    if (this.isValidPosition(newPosition, newShape)) {
      this.currentPiece.position = newPosition
      this.currentPiece.shape = newShape
      this.currentPiece.rotation = newRotation
      return true
    }

    // If moving down failed, lock the piece
    if (direction === 'down') {
      this.lockPiece()
    }

    return false
  }

  drop(): void {
    if (!this.currentPiece || this.gameOver) return

    // Keep moving down until piece locks
    while (this.move('down')) {
      // Moving...
    }
  }

  calculateShadowPosition(): number {
    if (!this.currentPiece) return 0

    let shadowY = this.currentPiece.position.y
    const moveDir = this.isDualMode && !this.isPlayer1 ? -1 : 1

    // Safety limit to prevent infinite loops
    const maxIterations = this.isDualMode ? EXTENDED_HEIGHT : BOARD_HEIGHT
    let iterations = 0

    while (
      iterations < maxIterations &&
      this.isValidPosition(
        { x: this.currentPiece.position.x, y: shadowY + moveDir },
        this.currentPiece.shape
      )
    ) {
      shadowY += moveDir
      iterations++
    }
    return shadowY
  }

  private isValidPosition(position: Position, shape: number[][]): boolean {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardX = position.x + x
          const boardY = position.y + y

          // Check horizontal boundaries
          if (boardX < 0 || boardX >= BOARD_WIDTH) {
            return false
          }

          // Check vertical boundaries
          if (this.isDualMode) {
            // In dual mode, allow pieces to extend across center line
            // but not beyond the board edges
            if (boardY < 0 || boardY >= EXTENDED_HEIGHT) {
              return false
            }
          } else {
            if (boardY < 0 || boardY >= BOARD_HEIGHT) return false
          }

          // Check collision with locked pieces (our own board)
          if (this.board[boardY] && this.board[boardY][boardX]) {
            return false
          }

          // In dual mode, also check collision with opponent's locked pieces
          if (this.isDualMode && this.opponentBoard.length > 0) {
            if (
              this.opponentBoard[boardY] &&
              this.opponentBoard[boardY][boardX]
            ) {
              return false
            }
          }
        }
      }
    }
    return true
  }

  // Check if piece would go out of bounds (for disappearing mechanic)
  private wouldPieceGoOutOfBounds(
    position: Position,
    shape: number[][]
  ): boolean {
    if (!this.isDualMode) return false

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardY = position.y + y

          // Player 1: pieces disappear if they go beyond row 43 (into row 44+)
          if (this.isPlayer1 && boardY >= EXTENDED_HEIGHT) {
            return true
          }

          // Player 2: pieces disappear if they go above row 0 (into negative rows)
          if (!this.isPlayer1 && boardY < 0) {
            return true
          }
        }
      }
    }
    return false
  }

  private lockPiece(): void {
    if (!this.currentPiece) return

    const { position, shape, color } = this.currentPiece

    // Lock the piece on the board - in dual mode, pieces can extend into opponent territory
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardY = position.y + y
          const boardX = position.x + x
          // Lock if within board bounds
          if (
            boardY >= 0 &&
            boardY < (this.isDualMode ? EXTENDED_HEIGHT : BOARD_HEIGHT)
          ) {
            this.board[boardY][boardX] = 1
            this.colorBoard[boardY][boardX] = color
          }
        }
      }
    }

    // Check game over BEFORE clearing lines
    // Game over if pieces stack into spawn row
    if (this.isDualMode) {
      if (this.isPlayer1) {
        // Player 1 loses if any block is in row 0 (spawn row)
        if (this.board[0].some(cell => cell === 1)) {
          this.gameOver = true
        }
      } else {
        // Player 2 loses if any block is in row 43 (spawn row)
        if (this.board[EXTENDED_HEIGHT - 1].some(cell => cell === 1)) {
          this.gameOver = true
        }
      }
    }

    // If game over, don't clear lines or spawn new pieces
    if (this.gameOver) {
      this.emitPieceLockedEvent()
      return
    }

    // Clear lines and update score
    const clearedLines = this.clearLines()
    if (clearedLines > 0) {
      this.linesCleared += clearedLines
      this.score += this.calculateScore(clearedLines)
      this.level = Math.floor(this.linesCleared / 10) + 1
    }

    // Spawn next piece
    this.spawnPiece()

    this.emitPieceLockedEvent()
  }

  private clearLines(): number {
    let linesCleared = 0

    if (this.isDualMode) {
      // In dual mode, count cleared lines in your territory
      const startY = this.isPlayer1 ? 0 : CENTER_LINE
      const endY = this.isPlayer1 ? CENTER_LINE : EXTENDED_HEIGHT

      // Count how many lines to clear
      for (let y = endY - 1; y >= startY; y--) {
        if (this.board[y].every(cell => cell === 1)) {
          linesCleared++
        }
      }

      // If any lines cleared, remove them and shift the board
      if (linesCleared > 0) {
        // Remove the cleared lines
        for (let y = endY - 1; y >= startY; y--) {
          if (this.board[y].every(cell => cell === 1)) {
            this.board.splice(y, 1)
            this.colorBoard.splice(y, 1)
          }
        }

        // Add back empty rows to restore to 44 rows
        for (let i = 0; i < linesCleared; i++) {
          if (this.isPlayer1) {
            // Add at top for Player 1
            this.board.unshift(Array(BOARD_WIDTH).fill(0))
            this.colorBoard.unshift(Array(BOARD_WIDTH).fill(''))
          } else {
            // Add at bottom for Player 2
            this.board.push(Array(BOARD_WIDTH).fill(0))
            this.colorBoard.push(Array(BOARD_WIDTH).fill(''))
          }
        }

        // Now shift the entire board toward opponent
        this.shiftBoardTowardOpponent(linesCleared)
      }
    } else {
      // Single player mode: normal line clearing
      for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (this.board[y].every(cell => cell === 1)) {
          this.board.splice(y, 1)
          this.colorBoard.splice(y, 1)
          this.board.unshift(Array(BOARD_WIDTH).fill(0))
          this.colorBoard.unshift(Array(BOARD_WIDTH).fill(''))
          linesCleared++
          y++
        }
      }
    }

    return linesCleared
  }

  private calculateScore(lines: number): number {
    const baseScore = [0, 100, 300, 500, 800]
    return baseScore[lines] * this.level
  }

  // Shift the entire board (including gray dots and all bricks) toward opponent
  private shiftBoardTowardOpponent(lines: number): void {
    if (!this.isDualMode) return

    const direction: 'up' | 'down' = this.isPlayer1 ? 'down' : 'up'
    this.applyExternalShift(direction, lines)
  }

  // Push obstacles toward opponent from center (kept for compatibility, now calls shift)
  pushObstaclesFromCenter(lines: number): void {
    // This is now handled by shiftBoardTowardOpponent in clearLines
    // Kept for backward compatibility if called externally
    this.shiftBoardTowardOpponent(lines)
  }

  shiftBoard(direction: 'up' | 'down'): void {
    // Legacy method - kept for compatibility
    this.shiftBoardByDirection(direction)
  }

  applyExternalShift(direction: 'up' | 'down', lines: number): void {
    if (!this.isDualMode) return
    for (let i = 0; i < lines; i++) {
      this.shiftBoardByDirection(direction)
    }
  }

  private shiftBoardByDirection(direction: 'up' | 'down'): void {
    if (direction === 'down') {
      this.board.pop()
      this.colorBoard.pop()
      this.board.unshift(Array(BOARD_WIDTH).fill(0))
      this.colorBoard.unshift(Array(BOARD_WIDTH).fill(''))
    } else {
      this.board.shift()
      this.colorBoard.shift()
      this.board.push(Array(BOARD_WIDTH).fill(0))
      this.colorBoard.push(Array(BOARD_WIDTH).fill(''))
    }
  }

  getState(): GameState {
    return {
      board: this.board,
      currentPiece: this.currentPiece,
      nextPieces: this.nextPieces,
      score: this.score,
      linesCleared: this.linesCleared,
      level: this.level,
      gameOver: this.gameOver,
      paused: false,
    }
  }

  getBoard(): number[][] {
    return this.board
  }

  getColorBoard(): string[][] {
    return this.colorBoard
  }

  getCurrentPiece(): Tetromino | null {
    return this.currentPiece
  }

  getNextPieces(): Tetromino[] {
    return this.nextPieces
  }

  isGameOver(): boolean {
    return this.gameOver
  }

  getScore(): number {
    return this.score
  }

  getLinesCleared(): number {
    return this.linesCleared
  }

  getLevel(): number {
    return this.level
  }

  // Update opponent's board for collision detection in dual mode
  setOpponentBoard(board: number[][]): void {
    if (this.isDualMode) {
      this.opponentBoard = board
    }
  }

  onPieceLocked(callback: (payload: PieceLockedEventPayload) => void): void {
    this.pieceLockedCallback = callback
  }

  // Get a snapshot of currently locked pieces (for action log)
  getLockedPiecesSnapshot(): { board: number[][]; colorBoard: string[][] } {
    return {
      board: this.board.map(row => [...row]),
      colorBoard: this.colorBoard.map(row => [...row]),
    }
  }

  // Apply a board state directly (for syncing from action log)
  applyBoardState(board: number[][], colorBoard: string[][]): void {
    this.board = board.map(row => [...row])
    this.colorBoard = colorBoard.map(row => [...row])
  }

  private emitPieceLockedEvent(): void {
    if (!this.pieceLockedCallback) return

    this.pieceLockedCallback({
      board: this.board.map(row => [...row]),
      colorBoard: this.colorBoard.map(row => [...row]),
      score: this.score,
      linesCleared: this.linesCleared,
      level: this.level,
    })
  }
}
