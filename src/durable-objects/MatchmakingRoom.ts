/// <reference types="@cloudflare/workers-types" />

interface Player {
	id: string;
	websocket: WebSocket;
	timestamp: number;
}

interface Room {
	id: string;
	players: Player[];
	created: number;
}

export class MatchmakingRoom {
	private state: DurableObjectState;
	private waitingPlayers: Player[] = [];
	private rooms: Map<string, Room> = new Map();

	constructor(state: DurableObjectState, env: any) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket', { status: 400 });
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.handleWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	private handleWebSocket(websocket: WebSocket): void {
		websocket.accept();

		let playerId: string | null = null;
		let currentRoomId: string | null = null;

		websocket.addEventListener('message', (event) => {
			try {
				const data = JSON.parse(event.data as string);

				switch (data.type) {
					case 'join':
						playerId = this.generateId();
						const player: Player = {
							id: playerId,
							websocket,
							timestamp: Date.now()
						};

						// Try to match with waiting player
						if (this.waitingPlayers.length > 0) {
							const opponent = this.waitingPlayers.shift()!;
							const roomId = this.generateId();

							const room: Room = {
								id: roomId,
								players: [opponent, player],
								created: Date.now()
							};

							this.rooms.set(roomId, room);

							// Notify both players
							opponent.websocket.send(
								JSON.stringify({
									type: 'matched',
									roomId,
									isHost: true
								})
							);

							player.websocket.send(
								JSON.stringify({
									type: 'matched',
									roomId,
									isHost: false
								})
							);

							currentRoomId = roomId;
						} else {
							// Add to waiting queue
							this.waitingPlayers.push(player);
							websocket.send(
								JSON.stringify({
									type: 'waiting'
								})
							);
						}
						break;

					case 'signal':
						// Relay WebRTC signaling data
						if (data.roomId && data.signal) {
							const room = this.rooms.get(data.roomId);
							if (room) {
								room.players.forEach((p) => {
									if (p.id !== playerId) {
										p.websocket.send(
											JSON.stringify({
												type: 'signal',
												signal: data.signal
											})
										);
									}
								});
							}
						}
						break;

					case 'leave':
						this.handlePlayerLeave(playerId, currentRoomId);
						break;
				}
			} catch (error) {
				console.error('Error handling WebSocket message:', error);
			}
		});

		websocket.addEventListener('close', () => {
			this.handlePlayerLeave(playerId, currentRoomId);
		});

		websocket.addEventListener('error', () => {
			this.handlePlayerLeave(playerId, currentRoomId);
		});
	}

	private handlePlayerLeave(playerId: string | null, roomId: string | null): void {
		if (!playerId) return;

		// Remove from waiting queue
		this.waitingPlayers = this.waitingPlayers.filter((p) => p.id !== playerId);

		// Remove from room and notify opponent
		if (roomId) {
			const room = this.rooms.get(roomId);
			if (room) {
				room.players.forEach((p) => {
					if (p.id !== playerId) {
						p.websocket.send(
							JSON.stringify({
								type: 'opponent_left'
							})
						);
					}
				});
				this.rooms.delete(roomId);
			}
		}
	}

	private generateId(): string {
		return Math.random().toString(36).substring(2, 15);
	}
}
