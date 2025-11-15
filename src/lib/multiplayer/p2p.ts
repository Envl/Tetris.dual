import type { GameMessage } from '$lib/game/types'

export class P2PConnection {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private messageHandlers: ((message: GameMessage) => void)[] = []
  private connectionHandlers: ((connected: boolean) => void)[] = []
  private signalHandlers: ((signal: any) => void)[] = []

  constructor(private isInitiator: boolean) {}

  async initialize(): Promise<void> {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    })

    // Set up ICE candidate handling (trickle ICE)
    this.pc.onicecandidate = event => {
      console.log(
        'ICE candidate event:',
        event.candidate ? 'found candidate' : 'gathering complete'
      )
      if (event.candidate) {
        this.signalHandlers.forEach(handler =>
          handler({
            type: 'ice-candidate',
            candidate: event.candidate,
          })
        )
      }
    }

    this.pc.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', this.pc?.iceGatheringState)
    }

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.pc?.iceConnectionState)
    }

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc?.connectionState)
      if (this.pc?.connectionState === 'connected') {
        console.log('P2P connection established')
        this.connectionHandlers.forEach(handler => handler(true))
      } else if (
        this.pc?.connectionState === 'disconnected' ||
        this.pc?.connectionState === 'failed'
      ) {
        console.log('P2P connection closed/failed')
        this.connectionHandlers.forEach(handler => handler(false))
      }
    }

    if (this.isInitiator) {
      console.log('Initializing as HOST')
      // Host creates the data channel
      this.dataChannel = this.pc.createDataChannel('game')
      this.setupDataChannel(this.dataChannel)

      // Create and send offer
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      console.log('Created offer, sending to signaling server')
      this.signalHandlers.forEach(handler =>
        handler({
          type: 'offer',
          sdp: offer,
        })
      )
    } else {
      console.log('Initializing as GUEST')
      // Guest waits for data channel
      this.pc.ondatachannel = event => {
        console.log('Received data channel from host')
        this.dataChannel = event.channel
        this.setupDataChannel(this.dataChannel)
      }
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened')
    }

    channel.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as GameMessage
        this.messageHandlers.forEach(handler => handler(message))
      } catch (error) {
        console.error('Failed to parse P2P message:', error)
      }
    }

    channel.onerror = error => {
      console.error('Data channel error:', error)
    }
  }

  async signal(data: any): Promise<void> {
    if (!this.pc) {
      console.error('Cannot signal: peer connection not initialized')
      return
    }

    try {
      if (data.type === 'offer') {
        console.log('Received offer, creating answer')
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        this.signalHandlers.forEach(handler =>
          handler({
            type: 'answer',
            sdp: answer,
          })
        )
      } else if (data.type === 'answer') {
        console.log('Received answer, setting remote description')
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } else if (data.type === 'ice-candidate' && data.candidate) {
        console.log('Received ICE candidate')
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (e) {
          console.warn('Error adding ICE candidate:', e)
        }
      }
    } catch (error) {
      console.error('Error processing signal:', error)
    }
  }

  send(message: GameMessage): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message))
    }
  }

  onMessage(handler: (message: GameMessage) => void): void {
    this.messageHandlers.push(handler)
  }

  onConnection(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler)
  }

  onSignal(handler: (signal: any) => void): void {
    this.signalHandlers.push(handler)
  }

  destroy(): void {
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
  }

  isConnected(): boolean {
    return this.dataChannel?.readyState === 'open'
  }
}
