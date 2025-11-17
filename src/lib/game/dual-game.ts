import {
  TetrisEngine,
  BOARD_WIDTH,
  EXTENDED_HEIGHT,
  CENTER_LINE,
  type PieceLockedEventPayload,
} from './engine'
import type { GameAction, GameMessage, Tetromino } from './types'

export type GameResult = 'playing' | 'win' | 'lose' | 'tie'

export interface RenderGameState {
  board: number[][]
  colorBoard: string[][]
  currentPiece: Tetromino | null
  nextPieces: Tetromino[]
  score: number
  linesCleared: number
  level: number
  gameOver: boolean
  shadowY: number
}

export interface OpponentState {
  board: number[][]
  colorBoard: string[][]
  score: number
  linesCleared: number
  level: number
  gameOver: boolean
}

export interface DualGameSnapshot {
  gameState: RenderGameState
  opponentState: OpponentState
  gameResult: GameResult
}

export interface DualGameManagerOptions {
  isPlayer1: boolean
  sendMessage?: (message: GameMessage) => void
  onStateChange?: (snapshot: DualGameSnapshot) => void
}

export const createEmptyRow = () => Array(BOARD_WIDTH).fill(0)
export const createEmptyColorRow = () => Array(BOARD_WIDTH).fill('')
export const createEmptyBoard = () =>
  Array.from({ length: EXTENDED_HEIGHT }, () => createEmptyRow())
export const createEmptyColorBoard = () =>
  Array.from({ length: EXTENDED_HEIGHT }, () => createEmptyColorRow())

const createInitialGameState = (): RenderGameState => ({
  board: [],
  colorBoard: [],
  currentPiece: null,
  nextPieces: [],
  score: 0,
  linesCleared: 0,
  level: 1,
  gameOver: false,
  shadowY: 0,
})

const createInitialOpponentState = (): OpponentState => ({
  board: createEmptyBoard(),
  colorBoard: createEmptyColorBoard(),
  score: 0,
  linesCleared: 0,
  level: 1,
  gameOver: false,
})

const cloneBoard = (board: number[][]) => board.map(row => [...row])
const cloneColorBoard = (board: string[][]) => board.map(row => [...row])

export class DualGameManager {
  private engine: TetrisEngine
  private readonly isPlayer1: boolean
  private sendMessage?: (message: GameMessage) => void
  private connectionReady = false
  private currentGameState: RenderGameState = createInitialGameState()
  private opponentState: OpponentState = createInitialOpponentState()
  private gameResult: GameResult = 'playing'
  private actionLog: GameAction[] = []
  private sequenceTimestamp = 0
  private sequenceCounter = 0
  private actionIds = new Set<string>()
  private listeners = new Set<(snapshot: DualGameSnapshot) => void>()
  private sendGameOverFlag = false
  private lastActionTimestamp = 0
  private actionCounter = 0

  constructor(options: DualGameManagerOptions) {
    this.isPlayer1 = options.isPlayer1
    if (options.sendMessage) {
      this.sendMessage = options.sendMessage
    }
    if (options.onStateChange) {
      this.subscribe(options.onStateChange)
    }

    this.engine = new TetrisEngine(true, this.isPlayer1)
    this.engine.onPieceLocked(payload => this.handlePieceLockedEvent(payload))
    this.engine.initialize()
    this.updateEngineOpponentBoard()
    this.updateGameState({ broadcast: false })
  }

  subscribe(listener: (snapshot: DualGameSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  setSendMessage(fn: (message: GameMessage) => void) {
    this.sendMessage = fn
  }

  setConnectionState(connected: boolean) {
    this.connectionReady = connected
  }

  tick() {
    if (this.currentGameState.gameOver) return
    const linesBefore = this.engine.getLinesCleared()
    this.engine.move('down')
    this.checkForLineClearAndShift(linesBefore)
    this.updateGameState()
  }

  moveLeft() {
    this.attemptMove(this.isPlayer1 ? 'left' : 'right')
  }

  moveRight() {
    this.attemptMove(this.isPlayer1 ? 'right' : 'left')
  }

  rotate() {
    this.attemptMove('rotate')
  }

  softDrop() {
    this.attemptMove('down')
  }

  hardDrop() {
    const linesBefore = this.engine.getLinesCleared()
    this.engine.drop()
    this.checkForLineClearAndShift(linesBefore)
    this.updateGameState()
  }

  handleRemoteMessage(message: GameMessage) {
    switch (message.type) {
      case 'action':
        this.handleRemoteAction(message.data)
        break
      case 'gameOver':
        this.handleOpponentGameOver()
        break
      default:
        break
    }
  }

  handleRemoteAction(action: GameAction) {
    if (!action) return
    const position = this.insertAction(action)
    if (position === 'duplicate') return

    if (position === 'append') {
      this.applyAction(action)
      this.updateGameState({ broadcast: false })
    } else {
      this.rebuildFromActionLog({ broadcast: false })
    }
  }

  resetForRematch() {
    this.engine.initialize()
    this.resetOpponentStateBoards()
    this.currentGameState = createInitialGameState()
    this.gameResult = 'playing'
    this.actionLog = []
    this.actionIds.clear()
    this.sequenceTimestamp = 0
    this.sequenceCounter = 0
    this.sendGameOverFlag = false
    this.updateGameState({ broadcast: false })
  }

  getSnapshot(): DualGameSnapshot {
    return {
      gameState: {
        ...this.currentGameState,
        board: cloneBoard(this.currentGameState.board),
        colorBoard: cloneColorBoard(this.currentGameState.colorBoard),
        currentPiece: this.clonePiece(this.currentGameState.currentPiece),
        nextPieces: this.currentGameState.nextPieces.map(
          piece => this.clonePiece(piece)!
        ),
      },
      opponentState: {
        ...this.opponentState,
        board: cloneBoard(this.opponentState.board),
        colorBoard: cloneColorBoard(this.opponentState.colorBoard),
      },
      gameResult: this.gameResult,
    }
  }

  private attemptMove(direction: 'left' | 'right' | 'down' | 'rotate') {
    if (this.currentGameState.gameOver) return
    const linesBefore = this.engine.getLinesCleared()
    let moved = false
    if (direction === 'rotate') {
      moved = this.engine.move('rotate')
    } else {
      moved = this.engine.move(direction)
    }
    if (moved) {
      this.checkForLineClearAndShift(linesBefore)
      this.updateGameState()
    }
  }

  private handlePieceLockedEvent(payload: PieceLockedEventPayload) {
    if (this.currentGameState.gameOver) return
    const action: GameAction = {
      actionId: this.generateActionId(),
      sequenceId: this.generateSequenceId(),
      playerId: (this.isPlayer1 ? 1 : 2) as 1 | 2,
      type: 'pieceLocked',
      data: {
        boardSnapshot: {
          board: payload.board.map(row => [...row]),
          colorBoard: payload.colorBoard.map(row => [...row]),
        },
        score: payload.score,
        linesCleared: payload.linesCleared,
        level: payload.level,
      },
    }

    const position = this.insertAction(action)
    if (position === 'duplicate') return

    if (position === 'append') {
      this.applyAction(action)
      this.updateGameState()
    } else {
      this.rebuildFromActionLog()
    }

    this.sendAction(action)
  }

  private checkForLineClearAndShift(linesBefore: number) {
    const linesAfter = this.engine.getLinesCleared()
    const linesCleared = linesAfter - linesBefore
    if (linesCleared <= 0) return

    const action: GameAction = {
      actionId: this.generateActionId(),
      sequenceId: this.generateSequenceId(),
      playerId: (this.isPlayer1 ? 1 : 2) as 1 | 2,
      type: 'boardShift',
      data: {
        direction: this.isPlayer1 ? 'down' : 'up',
        lines: linesCleared,
        boardSnapshot: this.engine.getLockedPiecesSnapshot(),
        score: this.engine.getScore(),
        linesCleared: this.engine.getLinesCleared(),
        level: this.engine.getLevel(),
      },
    }

    const position = this.insertAction(action)
    if (position === 'duplicate') return

    if (position === 'append') {
      this.applyAction(action)
      this.updateGameState()
    } else {
      this.rebuildFromActionLog()
    }

    this.sendAction(action)
  }

  private sendAction(action: GameAction) {
    if (!this.connectionReady || !this.sendMessage) return
    this.sendMessage({
      type: 'action',
      data: action,
    })
  }

  private applyAction(
    action: GameAction,
    options: { applyEngineEffects?: boolean; isRebuild?: boolean } = {}
  ) {
    const { applyEngineEffects = true, isRebuild = false } = options
    const isLocalAction = action.playerId === (this.isPlayer1 ? 1 : 2)

    const updateOpponentStats = (data: any) => {
      if (typeof data?.score === 'number') {
        this.opponentState.score = data.score
      }
      if (typeof data?.linesCleared === 'number') {
        this.opponentState.linesCleared = data.linesCleared
      }
      if (typeof data?.level === 'number') {
        this.opponentState.level = data.level
      }
    }

    if (action.type === 'boardShift') {
      if (isLocalAction) {
        // During rebuild, apply our own board snapshot to reconstruct engine state
        if (isRebuild && action.data.boardSnapshot) {
          this.engine.applyBoardState(
            action.data.boardSnapshot.board,
            action.data.boardSnapshot.colorBoard
          )
        }
        this.shiftOpponentBoard(action.data.direction, action.data.lines)
      } else {
        if (applyEngineEffects) {
          this.engine.applyExternalShift(
            action.data.direction,
            action.data.lines
          )
        }

        this.shiftOpponentBoard(action.data.direction, action.data.lines)

        if (action.data.boardSnapshot) {
          this.applySnapshotToOpponent(action.data.boardSnapshot, {
            onlyOpponentTerritory: false,
          })
        }

        updateOpponentStats(action.data)
      }
    }

    if (action.type === 'pieceLocked') {
      // During rebuild, apply our own board snapshot to reconstruct engine state
      if (isRebuild && isLocalAction && action.data.boardSnapshot) {
        this.engine.applyBoardState(
          action.data.boardSnapshot.board,
          action.data.boardSnapshot.colorBoard
        )
      }

      if (!isLocalAction && action.data.boardSnapshot) {
        this.applySnapshotToOpponent(action.data.boardSnapshot, {
          onlyOpponentTerritory: false,
        })
      }
      if (!isLocalAction) {
        updateOpponentStats(action.data)
      }
    }
  }

  private handleOpponentGameOver() {
    this.opponentState.gameOver = true
    this.updateGameResult()
    this.notifyStateChange()
  }

  private sendGameOver() {
    if (this.sendGameOverFlag || !this.connectionReady || !this.sendMessage) {
      return
    }
    this.sendGameOverFlag = true
    this.sendMessage({
      type: 'gameOver',
      data: {
        score: this.engine.getScore(),
        linesCleared: this.engine.getLinesCleared(),
      },
    })
  }

  private updateGameState(options: { broadcast?: boolean } = {}) {
    const { broadcast = true } = options

    const ourBoard = this.engine.getBoard()
    const ourColorBoard = this.engine.getColorBoard()
    const boardClone = ourBoard.map(row => [...row])
    const colorClone = ourColorBoard.map(row => [...row])

    // Merge opponent's board with ours
    if (this.opponentState.board.length > 0) {
      for (let y = 0; y < EXTENDED_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          if (this.opponentState.board[y] && this.opponentState.board[y][x]) {
            // Always show opponent pieces, even if they extend into our territory
            // Only skip if we have our own piece at that position
            if (!boardClone[y][x]) {
              boardClone[y][x] = this.opponentState.board[y][x]
              colorClone[y][x] = this.opponentState.colorBoard[y][x]
            }
          }
        }
      }
    }

    this.currentGameState = {
      board: boardClone,
      colorBoard: colorClone,
      currentPiece: this.engine.getCurrentPiece(),
      nextPieces: this.engine.getNextPieces(),
      score: this.engine.getScore(),
      linesCleared: this.engine.getLinesCleared(),
      level: this.engine.getLevel(),
      gameOver: this.engine.isGameOver(),
      shadowY: this.engine.calculateShadowPosition(),
    }

    if (this.currentGameState.gameOver) {
      this.handleLocalGameOver()
    }

    this.updateGameResult()
    this.notifyStateChange()
  }

  private handleLocalGameOver() {
    if (this.opponentState.gameOver) {
      this.gameResult = 'tie'
    } else {
      this.gameResult = 'lose'
    }
    this.sendGameOver()
  }

  private updateGameResult() {
    if (this.currentGameState.gameOver && this.opponentState.gameOver) {
      this.gameResult = 'tie'
    } else if (this.currentGameState.gameOver) {
      this.gameResult = 'lose'
    } else if (this.opponentState.gameOver) {
      this.gameResult = 'win'
    } else {
      this.gameResult = 'playing'
    }
  }

  private notifyStateChange() {
    const snapshot = this.getSnapshot()
    this.listeners.forEach(listener => listener(snapshot))
  }

  private clonePiece(piece: Tetromino | null) {
    if (!piece) return null
    return {
      type: piece.type,
      color: piece.color,
      position: { ...piece.position },
      rotation: piece.rotation,
      shape: piece.shape.map(row => [...row]),
    }
  }

  private isOpponentTerritoryRow(row: number) {
    return this.isPlayer1 ? row >= CENTER_LINE : row < CENTER_LINE
  }

  private ensureOpponentBoards() {
    if (this.opponentState.board.length !== EXTENDED_HEIGHT) {
      this.opponentState.board = createEmptyBoard()
    }
    if (this.opponentState.colorBoard.length !== EXTENDED_HEIGHT) {
      this.opponentState.colorBoard = createEmptyColorBoard()
    }
  }

  private updateEngineOpponentBoard() {
    this.ensureOpponentBoards()
    // Pass the full opponent board to the engine for collision detection
    // This includes pieces that extend into our territory
    this.engine.setOpponentBoard(this.opponentState.board)
  }

  private applySnapshotToOpponent(
    snapshot: { board: number[][]; colorBoard: string[][] },
    options: { onlyOpponentTerritory?: boolean } = {}
  ) {
    const { onlyOpponentTerritory = false } = options
    this.ensureOpponentBoards()

    // The snapshot contains the opponent's locked pieces from their engine
    // We should apply ALL of their pieces, even those that extend into our territory
    for (let y = 0; y < EXTENDED_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        // Always apply the opponent's pieces from the snapshot
        // The snapshot only contains the opponent's pieces, not ours
        this.opponentState.board[y][x] = snapshot.board[y]?.[x] ?? 0
        this.opponentState.colorBoard[y][x] = snapshot.colorBoard[y]?.[x] ?? ''
      }
    }

    this.updateEngineOpponentBoard()
  }

  private shiftOpponentBoard(direction: 'up' | 'down', lines: number) {
    this.ensureOpponentBoards()
    for (let i = 0; i < lines; i++) {
      if (direction === 'down') {
        this.opponentState.board.pop()
        this.opponentState.colorBoard.pop()
        this.opponentState.board.unshift(createEmptyRow())
        this.opponentState.colorBoard.unshift(createEmptyColorRow())
      } else {
        this.opponentState.board.shift()
        this.opponentState.colorBoard.shift()
        this.opponentState.board.push(createEmptyRow())
        this.opponentState.colorBoard.push(createEmptyColorRow())
      }
    }
    this.updateEngineOpponentBoard()
  }

  private resetOpponentStateBoards() {
    this.opponentState = createInitialOpponentState()
    this.updateEngineOpponentBoard()
  }

  private generateActionId() {
    const now = Date.now()
    if (now === this.lastActionTimestamp) {
      this.actionCounter += 1
    } else {
      this.lastActionTimestamp = now
      this.actionCounter = 0
    }
    return `${now}-${this.actionCounter}`
  }

  private generateSequenceId() {
    const now = Date.now()
    if (now === this.sequenceTimestamp) {
      this.sequenceCounter += 1
    } else {
      this.sequenceTimestamp = now
      this.sequenceCounter = 0
    }
    return now * 1000 + this.sequenceCounter
  }

  private insertAction(
    action: GameAction
  ): 'duplicate' | 'append' | 'inserted' {
    if (this.actionIds.has(action.actionId)) {
      return 'duplicate'
    }

    const index = this.actionLog.findIndex(
      existing => existing.sequenceId > action.sequenceId
    )

    this.actionIds.add(action.actionId)

    if (index === -1) {
      this.actionLog.push(action)
      return 'append'
    }

    this.actionLog.splice(index, 0, action)
    return 'inserted'
  }

  private rebuildFromActionLog(options: { broadcast?: boolean } = {}) {
    const { broadcast = true } = options

    // Reset both engine board and opponent state to reconstruct from action log
    const emptyBoard = Array(EXTENDED_HEIGHT)
      .fill(0)
      .map(() => Array(BOARD_WIDTH).fill(0))
    const emptyColorBoard = Array(EXTENDED_HEIGHT)
      .fill('')
      .map(() => Array(BOARD_WIDTH).fill(''))

    this.engine.applyBoardState(emptyBoard, emptyColorBoard)
    this.opponentState = createInitialOpponentState()
    this.updateEngineOpponentBoard()

    for (const action of this.actionLog) {
      this.applyAction(action, { applyEngineEffects: false, isRebuild: true })
    }
    this.updateGameState({ broadcast })
  }
}
