export interface MatchmakingClient {
  joinQueue(): Promise<{ roomId: string; isHost: boolean }>
  leaveQueue(): Promise<void>
  sendSignal(roomId: string, signal: any): Promise<void>
  onSignal(callback: (signal: any) => void): void
}

export class MatchmakingService implements MatchmakingClient {
  private ws: WebSocket | null = null
  private signalCallbacks: ((signal: any) => void)[] = []

  constructor(private durableObjectUrl: string) {}

  async joinQueue(): Promise<{ roomId: string; isHost: boolean }> {
    return new Promise((resolve, reject) => {
      console.debug('[MatchmakingService] connecting to', this.durableObjectUrl)
      this.ws = new WebSocket(this.durableObjectUrl)

      this.ws.onopen = () => {
        console.debug('[MatchmakingService] websocket open')
        this.ws?.send(JSON.stringify({ type: 'join' }))
      }

      this.ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data)
          console.debug('[MatchmakingService] received message', data)

          if (data.type === 'matched') {
            console.info(
              '[MatchmakingService] matched room=',
              data.roomId,
              'isHost=',
              data.isHost
            )
            resolve({
              roomId: data.roomId,
              isHost: data.isHost,
            })
          } else if (data.type === 'signal') {
            console.debug('[MatchmakingService] received signal')
            this.signalCallbacks.forEach(cb => cb(data.signal))
          } else if (data.type === 'waiting') {
            console.debug('[MatchmakingService] currently waiting for opponent')
          } else if (data.type === 'opponent_left') {
            console.warn('[MatchmakingService] opponent left the room')
          }
        } catch (e) {
          console.error(
            '[MatchmakingService] failed to parse message',
            e,
            event.data
          )
        }
      }

      this.ws.onerror = error => {
        console.error('[MatchmakingService] websocket error', error)
        reject(error)
      }
    })
  }

  async leaveQueue(): Promise<void> {
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave' }))
      this.ws.close()
      this.ws = null
    }
  }

  async sendSignal(roomId: string, signal: any): Promise<void> {
    if (this.ws) {
      console.debug('[MatchmakingService] sendSignal', {
        roomId,
        signalType: signal?.type || '(signal)',
      })
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'signal',
              roomId,
              signal,
            })
          )
        } else {
          console.warn(
            '[MatchmakingService] websocket not open, readyState=',
            this.ws.readyState
          )
        }
      } catch (e) {
        console.error('[MatchmakingService] error sending signal', e)
      }
    }
  }

  onSignal(callback: (signal: any) => void): void {
    this.signalCallbacks.push(callback)
  }
}
