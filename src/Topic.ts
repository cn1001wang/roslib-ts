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
/** 存储绑定的重连处理器，便于精准卸载 */
  private _reconnectHandler: () => void;

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

    // 预定义重连逻辑
    this._reconnectHandler = () => {
      if (this.isSubscribed) {
        this._sendSubscribe();
      }
      if (this.isAdvertised) {
        this._sendAdvertise();
      }
    };
  }

  /** 发送底层的订阅协议包 */
  private _sendSubscribe(): void {
    this.isSubscribed = true;
    const subscribeMessage = {
      op: 'subscribe',
      topic: this.name,
      type: this.messageType,
      ...(this.compression && { compression: this.compression }),
      ...(this.throttle_rate && { throttle_rate: this.throttle_rate }),
      ...(this.queue_length && { queue_length: this.queue_length }),
    };
    this.ros.callOnConnection(subscribeMessage);
  }

  /** 发送底层的公告协议包 */
  private _sendAdvertise(): void {
    this.isAdvertised = true;
    const advertiseMessage = {
      op: 'advertise',
      topic: this.name,
      type: this.messageType,
      ...(this.latch && { latch: this.latch }),
      ...(this.queue_size && { queue_size: this.queue_size }),
    };
    this.ros.callOnConnection(advertiseMessage);
  }

  /**
   * 订阅话题
   * @param callback 接收消息的回调函数
   */
  subscribe(callback?: (message: any) => void): void {
    if (this.isSubscribed) return;

    // 1. 先尝试移除已有的监听，防止重复挂载
    this.ros.off('connection', this._reconnectHandler);
    this.ros.off('close', this._handleClose);

    // 2. 挂载监听
    this.ros.on('connection', this._reconnectHandler);
    this.ros.on('close', this._handleClose);

    // 3. 执行物理订阅
    this._sendSubscribe();

    // 4. 监听来自 ROS 的消息分发
    this.ros.on(this.name, (message: any) => {
      this.emit('message', message);
      if (callback) callback(message);
    });
  }

  /** 取消订阅 */
  unsubscribe(): void {
    if (!this.isSubscribed) return;

    const unsubscribeMessage = {
      op: 'unsubscribe',
      topic: this.name,
    };

    this.ros.callOnConnection(unsubscribeMessage);
    this.isSubscribed = false;

    // 彻底清理：移除重连监听和消息监听

    this.ros.off(this.name);
    if(!this.isAdvertised){
      this.ros.off('connection', this._reconnectHandler);
      this.ros.off('close', this._handleClose);
    }
  }

  /** 公告话题（作为发布者） */
  advertise(): void {
    if (this.isAdvertised) return;

    this.ros.off('connection', this._reconnectHandler);
    this.ros.on('connection', this._reconnectHandler);
    this.ros.on('close', this._handleClose);

    this._sendAdvertise();
  }

  /** 取消公告 */
  unadvertise(): void {
    if (!this.isAdvertised) return;

    const unadvertiseMessage = {
      op: 'unadvertise',
      topic: this.name,
    };

    this.ros.callOnConnection(unadvertiseMessage);
    this.isAdvertised = false;

    // 如果当前也没有订阅，则可以安全移除重连处理器
    if (!this.isSubscribed) {
      this.ros.off('connection', this._reconnectHandler);
      this.ros.off('close', this._handleClose);
    }
  }

  /** 发布消息 */
  publish(message: any): void {
    if (!this.isAdvertised) {
      this.advertise();
    }

    const publishMessage = {
      op: 'publish',
      topic: this.name,
      msg: message,
    };

    this.ros.callOnConnection(publishMessage);
  }

  /** 内部状态处理：连接关闭时重置标志位 */
  private _handleClose = () => {
    this.isSubscribed = false;
    this.isAdvertised = false;
  };
}
