export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Position {
	x: number;
	y: number;
}

export interface Tetromino {
	type: TetrominoType;
	shape: number[][];
	color: string;
	position: Position;
	rotation: number;
}

export interface GameState {
	board: number[][];
	currentPiece: Tetromino | null;
	nextPieces: Tetromino[];
	score: number;
	linesCleared: number;
	level: number;
	gameOver: boolean;
	paused: boolean;
}

export interface DualGameState {
	localState: GameState;
	opponentState: GameState | null;
	connected: boolean;
}

export type Direction = 'left' | 'right' | 'down' | 'rotate';

export interface GameMessage {
	type: 'move' | 'drop' | 'linesCleared' | 'gameOver' | 'state';
	data: any;
}
