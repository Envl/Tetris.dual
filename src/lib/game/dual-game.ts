import {
  TetrisEngine,
  BOARD_WIDTH,
  EXTENDED_HEIGHT,
  CENTER_LINE,
  type PieceLockedEventPayload,
} from './engine'
import type { GameAction, GameMessage, Tetromino } from './types'

export type GameResult = 'playing' | 'win' | 'lose' | 'tie'
export type PlayerKey = 'player1' | 'player2'

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
  currentPiece: Tetromino | null
  score: number
  linesCleared: number
  level: number
  gameOver: boolean
  shadowY: number
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
  currentPiece: null,
  score: 0,
  linesCleared: 0,
  level: 1,
  gameOver: false,
  shadowY: 0,
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
  private mySequenceId = 0
  private lastAppliedSequence: Record<PlayerKey, number> = {
    player1: -1,
    player2: -1,
  }
  private pendingActions: Record<PlayerKey, Map<number, GameAction>> = {
    player1: new Map(),
    player2: new Map(),
  }
  private listeners = new Set<(snapshot: DualGameSnapshot) => void>()
  private lastSentPieceSignature: string | null = null
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
    if (connected) {
      this.lastSentPieceSignature = null
      this.sendPieceState(true)
    }
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
      case 'pieceState':
        this.handlePieceStateMessage(message.data)
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
    this.actionLog.push(action)
    const applied = this.enqueueRemoteAction(action)
    if (applied) {
      this.updateGameState({ broadcast: false })
    }
  }

  resetForRematch() {
    this.engine.initialize()
    this.resetOpponentStateBoards()
    this.currentGameState = createInitialGameState()
    this.gameResult = 'playing'
    this.actionLog = []
    this.mySequenceId = 0
    this.lastAppliedSequence = { player1: -1, player2: -1 }
    this.pendingActions.player1.clear()
    this.pendingActions.player2.clear()
    this.lastSentPieceSignature = null
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
        nextPieces: this.currentGameState.nextPieces.map(piece =>
          this.clonePiece(piece)!
        ),
      },
      opponentState: {
        ...this.opponentState,
        board: cloneBoard(this.opponentState.board),
        colorBoard: cloneColorBoard(this.opponentState.colorBoard),
        currentPiece: this.clonePiece(this.opponentState.currentPiece),
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
      sequenceId: this.mySequenceId++,
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

    this.actionLog.push(action)
    this.applyAction(action)
    this.sendAction(action)
  }

  private checkForLineClearAndShift(linesBefore: number) {
    const linesAfter = this.engine.getLinesCleared()
    const linesCleared = linesAfter - linesBefore
    if (linesCleared <= 0) return

    const action: GameAction = {
      actionId: this.generateActionId(),
      sequenceId: this.mySequenceId++,
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

    this.actionLog.push(action)
    this.applyAction(action)
    this.sendAction(action)
  }

  private sendAction(action: GameAction) {
    if (!this.connectionReady || !this.sendMessage) return
    this.sendMessage({
      type: 'action',
      data: action,
    })
  }

  private enqueueRemoteAction(action: GameAction): boolean {
    const key = this.getPlayerKey(action.playerId)
    const expectedSequence = this.lastAppliedSequence[key] + 1
    let applied = false

    if (action.sequenceId <= this.lastAppliedSequence[key]) {
      return false
    }

    if (action.sequenceId === expectedSequence) {
      this.applyAction(action)
      applied = true
      applied = this.processPendingActions(key) || applied
    } else {
      this.pendingActions[key].set(action.sequenceId, action)
    }

    return applied
  }

  private processPendingActions(key: PlayerKey): boolean {
    let applied = false
    let nextSequence = this.lastAppliedSequence[key] + 1

    while (this.pendingActions[key].has(nextSequence)) {
      const nextAction = this.pendingActions[key].get(nextSequence)!
      this.pendingActions[key].delete(nextSequence)
      this.applyAction(nextAction)
      applied = true
      nextSequence = this.lastAppliedSequence[key] + 1
    }

    return applied
  }

  private applyAction(action: GameAction) {
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
        this.shiftOpponentBoard(action.data.direction, action.data.lines)
      } else {
        this.engine.applyExternalShift(action.data.direction, action.data.lines)
        if (action.data.boardSnapshot) {
          this.applySnapshotToOpponent(action.data.boardSnapshot, {
            onlyOpponentTerritory: true,
          })
        } else {
          this.shiftOpponentBoard(action.data.direction, action.data.lines)
        }
        updateOpponentStats(action.data)
      }
    }

    if (action.type === 'pieceLocked') {
      if (!isLocalAction && action.data.boardSnapshot) {
        this.applySnapshotToOpponent(action.data.boardSnapshot, {
          onlyOpponentTerritory: true,
        })
      }
      if (!isLocalAction) {
        updateOpponentStats(action.data)
      }
    }

    this.lastAppliedSequence[this.getPlayerKey(action.playerId)] =
      action.sequenceId
  }

  private handlePieceStateMessage(data: any) {
    if (!data) return
    const senderId = (data.playerId ?? 0) as 1 | 2
    const myId = (this.isPlayer1 ? 1 : 2) as 1 | 2
    if (senderId === myId) return

    if (data.piece) {
      this.opponentState.currentPiece = {
        ...data.piece,
        position: { ...data.piece.position },
        shape: data.piece.shape.map((row: number[]) => [...row]),
      }
    } else {
      this.opponentState.currentPiece = null
    }

    if (typeof data.shadowY === 'number') {
      this.opponentState.shadowY = data.shadowY
    }
    if (typeof data.score === 'number') {
      this.opponentState.score = data.score
    }
    if (typeof data.linesCleared === 'number') {
      this.opponentState.linesCleared = data.linesCleared
    }
    if (typeof data.level === 'number') {
      this.opponentState.level = data.level
    }

    this.notifyStateChange()
  }

  private handleOpponentGameOver() {
    this.opponentState.gameOver = true
    this.opponentState.currentPiece = null
    this.updateGameResult()
    this.notifyStateChange()
  }

  private sendPieceState(force = false) {
    if (!this.connectionReady || !this.sendMessage) return
    const payload = {
      playerId: (this.isPlayer1 ? 1 : 2) as 1 | 2,
      piece: this.clonePiece(this.engine.getCurrentPiece()),
      shadowY: this.engine.calculateShadowPosition(),
      score: this.engine.getScore(),
      linesCleared: this.engine.getLinesCleared(),
      level: this.engine.getLevel(),
    }
    const signature = JSON.stringify(payload)
    if (!force && signature === this.lastSentPieceSignature) {
      return
    }
    this.lastSentPieceSignature = signature
    this.sendMessage?.({ type: 'pieceState', data: payload })
  }

  private sendGameOver() {
    if (this.sendGameOverFlag || !this.connectionReady || !this.sendMessage) {
      return
    }
    this.sendGameOverFlag = true
    this.sendPieceState(true)
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

    if (this.opponentState.board.length > 0) {
      for (let y = 0; y < EXTENDED_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const inOpponentTerritory = this.isPlayer1
            ? y >= CENTER_LINE
            : y < CENTER_LINE
          if (this.opponentState.board[y] && this.opponentState.board[y][x]) {
            if (inOpponentTerritory || !boardClone[y][x]) {
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

    if (broadcast) {
      this.sendPieceState()
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

  private getPlayerKey(playerId: 1 | 2): PlayerKey {
    return (playerId === 1 ? 'player1' : 'player2') as PlayerKey
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
    const sanitized = this.opponentState.board.map((row, y) =>
      row.map(cell => (this.isOpponentTerritoryRow(y) ? cell : 0))
    )
    this.engine.setOpponentBoard(sanitized)
  }

  private applySnapshotToOpponent(
    snapshot: { board: number[][]; colorBoard: string[][] },
    options: { onlyOpponentTerritory?: boolean } = {}
  ) {
    const { onlyOpponentTerritory = false } = options
    this.ensureOpponentBoards()
    for (let y = 0; y < EXTENDED_HEIGHT; y++) {
      const isOpponentRow = this.isOpponentTerritoryRow(y)
      if (onlyOpponentTerritory && !isOpponentRow) continue
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (!onlyOpponentTerritory || isOpponentRow) {
          this.opponentState.board[y][x] = snapshot.board[y]?.[x] ?? 0
          this.opponentState.colorBoard[y][x] = snapshot.colorBoard[y]?.[x] ?? ''
        }
      }
    }
    this.opponentState.currentPiece = null
    this.updateEngineOpponentBoard()
  }

  private shiftOpponentBoard(direction: 'up' | 'down', lines: number) {
    this.ensureOpponentBoards()
  const { start, end } = this.getOpponentTerritoryBounds()
  if (end - start <= 0) return

    for (let i = 0; i < lines; i++) {
      if (direction === 'down') {
        for (let row = end - 1; row > start; row--) {
          this.opponentState.board[row] = [
            ...this.opponentState.board[row - 1],
          ]
          this.opponentState.colorBoard[row] = [
            ...this.opponentState.colorBoard[row - 1],
          ]
        }
        this.opponentState.board[start] = createEmptyRow()
        this.opponentState.colorBoard[start] = createEmptyColorRow()
      } else {
        for (let row = start; row < end - 1; row++) {
          this.opponentState.board[row] = [
            ...this.opponentState.board[row + 1],
          ]
          this.opponentState.colorBoard[row] = [
            ...this.opponentState.colorBoard[row + 1],
          ]
        }
        this.opponentState.board[end - 1] = createEmptyRow()
        this.opponentState.colorBoard[end - 1] = createEmptyColorRow()
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

  private getOpponentTerritoryBounds() {
    if (this.isPlayer1) {
      return { start: CENTER_LINE, end: EXTENDED_HEIGHT }
    }
    return { start: 0, end: CENTER_LINE }
  }
}
