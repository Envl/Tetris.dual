export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export interface Position {
  x: number
  y: number
}

export interface Tetromino {
  type: TetrominoType
  shape: number[][]
  color: string
  position: Position
  rotation: number
}

export interface GameState {
  board: number[][]
  currentPiece: Tetromino | null
  nextPieces: Tetromino[]
  score: number
  linesCleared: number
  level: number
  gameOver: boolean
  paused: boolean
}

export interface DualGameState {
  localState: GameState
  opponentState: GameState | null
  connected: boolean
}

export type Direction = 'left' | 'right' | 'down' | 'rotate'

export interface GameAction {
  actionId: string
  sequenceId: number
  playerId: 1 | 2
  type: 'pieceLocked' | 'boardShift'
  data: any
}

export interface GameMessage {
  type: 'move' | 'drop' | 'gameOver' | 'state' | 'restart' | 'action'
  data: any
  sequenceId?: number
}
