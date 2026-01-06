import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';

interface TopicOptions {
  ros: RosLike;
  name: string;
  messageType: string;
  compression?: string;
  throttle_rate?: number;
  queue_size?: number;
  latch?: boolean;
  queue_length?: number;
}

export default class Topic extends EventEmitter {
  public readonly ros: RosLike;
  public readonly name: string;
  public readonly messageType: string;
  /// 消息压缩方式，可选值：'none', 'zlib', 'bzip2', 'png', 'cbor'
  public readonly compression?: string;
  /// throttle_rate（可选）限流（毫秒）
  public readonly throttle_rate?: number;
  /// 发布队列大小
  public readonly queue_size?: number;
  /// 是否锁存（latched topic）
  public readonly latch?: boolean;
  /// queue_length（可选）消息队列长度
  public readonly queue_length?: number;
  private isSubscribed = false;
  private isAdvertised = false;

  constructor(options: TopicOptions) {
    super();
    
    this.ros = options.ros;
    this.name = options.name;
    this.messageType = options.messageType;
    this.compression = options.compression;
    this.throttle_rate = options.throttle_rate;
    this.queue_size = options.queue_size;
    this.latch = options.latch;
    this.queue_length = options.queue_length;
  }

  subscribe(callback?: (message: any) => void): void {
    if (this.isSubscribed) {
      return;
    }

    const subscribeMessage = {
      op: 'subscribe',
      topic: this.name,
      type: this.messageType,
      ...(this.compression && { compression: this.compression }),
      ...(this.throttle_rate && { throttle_rate: this.throttle_rate }),
      ...(this.queue_length && { queue_length: this.queue_length })
    };

    this.ros.callOnConnection(subscribeMessage);
    this.isSubscribed = true;

    // 监听来自 ROS 的消息
    this.ros.on(this.name, (message: any) => {
      this.emit('message', message);
      if (callback) {
        callback(message);
      }
    });

    // 监听连接关闭事件，重新订阅
    this.ros.on('close', () => {
      this.isSubscribed = false;
    });

    this.ros.on('connection', () => {
      if (!this.isSubscribed) {
        this.subscribe(callback);
      }
    });
  }

  unsubscribe(): void {
    if (!this.isSubscribed) {
      return;
    }

    const unsubscribeMessage = {
      op: 'unsubscribe',
      topic: this.name
    };

    this.ros.callOnConnection(unsubscribeMessage);
    this.isSubscribed = false;
    
    // 移除事件监听器
    this.ros.off(this.name);
  }

  advertise(): void {
    if (this.isAdvertised) {
      return;
    }

    const advertiseMessage = {
      op: 'advertise',
      topic: this.name,
      type: this.messageType,
      ...(this.latch && { latch: this.latch }),
      ...(this.queue_size && { queue_size: this.queue_size })
    };

    this.ros.callOnConnection(advertiseMessage);
    this.isAdvertised = true;

    // 监听连接关闭事件
    this.ros.on('close', () => {
      this.isAdvertised = false;
    });

    this.ros.on('connection', () => {
      if (!this.isAdvertised) {
        this.advertise();
      }
    });
  }

  unadvertise(): void {
    if (!this.isAdvertised) {
      return;
    }

    const unadvertiseMessage = {
      op: 'unadvertise',
      topic: this.name
    };

    this.ros.callOnConnection(unadvertiseMessage);
    this.isAdvertised = false;
  }

  publish(message: any): void {
    if (!this.isAdvertised) {
      this.advertise();
    }

    const publishMessage = {
      op: 'publish',
      topic: this.name,
      msg: message
    };

    this.ros.callOnConnection(publishMessage);
  }
}
