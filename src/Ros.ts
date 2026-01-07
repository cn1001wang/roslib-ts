import EventEmitter from './EventEmitter';

interface RosOptions {
  url?: string;
  WebSocket?: typeof WebSocket;
}

export interface RosLike {
  on(event: string, listener: Function): this;
  once(event: string, listener: Function): this;
  off(event: string, listener?: Function): this;
  emit(event: string, ...args: any[]): boolean;
  callOnConnection(message: any): void;
  getNextId(): string;
  readonly isConnected: boolean;
}

export default class Ros extends EventEmitter implements RosLike {
  private socket: WebSocket | null = null;
  private _isConnected = false;
  private idCounter = 0;
  private options: RosOptions;

  constructor(options: RosOptions = {}) {
    super();
    this.options = options;
    
    if (options.url) {
      this.connect(options.url);
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(url: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.socket.url === url) {
      return;
    }

    if (this.socket) {
      this.close();
    }

    try {
      const WS = this.options?.WebSocket ?? WebSocket
      this.socket = new WS(url);
      
      this.socket.onopen = () => {
        this._isConnected = true;
        this.emit('connection');
      };

      this.socket.onclose = () => {
        this._isConnected = false;
        this.emit('close');
      };

      this.socket.onerror = (error) => {
        this.emit('error', error);
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

    } catch (error) {
      this.emit('error', error);
    }
  }

  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this._isConnected = false;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.op === 'publish') {
        // 发布消息到对应的 topic
        this.emit(message.topic, message.msg);
      } else if (message.op === 'service_response') {
        // 服务响应
        this.emit(message.id, message);
      } else if (message.op === 'status') {
        // 状态消息
        if (message.id) {
          this.emit('status:' + message.id, message);
        } else {
          this.emit('status', message);
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  callOnConnection(message: any): void {
    const messageStr = JSON.stringify(message);
    
    if (this._isConnected && this.socket) {
      this.socket.send(messageStr);
    } else {
      // 等待连接建立后发送
      this.once('connection', () => {
        if (this.socket) {
          this.socket.send(messageStr);
        }
      });
    }
  }

  getNextId(): string {
    return (++this.idCounter).toString();
  }
}
