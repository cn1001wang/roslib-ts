import {Ros} from 'roslib-ts'
/**
 * Topic 消息回调函数
 * @param msg 从机器人 / ROS / WS 收到的原始消息
 */
export type Callback = (msg: any) => void;

/**
 * 被 TopicManager 管理的 Topic 实例
 */
export interface ManagedTopic {
  /** 底层 Topic 实例（如 ROSLIB.Topic） */
  topic: Topic;

  /** ROS 消息类型，如 std_msgs/String */
  messageType: string;

  /** 当前订阅该 Topic 的所有回调 */
  callbacks: Set<Callback>;
}

export class TopicManager {
  /**
   * 已管理的 Topic 映射表
   * key: topic name
   */
  private topics: Map<string, ManagedTopic> = new Map();

  /**
   * 订阅一个 Topic
   *
   * - 若 Topic 不存在：创建 Topic 并 subscribe
   * - 若 Topic 已存在：仅追加 callback
   *
   * @param name Topic 名称（如 /cmd_vel）
   * @param messageType ROS 消息类型
   * @param callback 消息回调
   */
  subscribe(
    name: string,
    messageType: string,
    callback: Callback
  ): void {
    // implementation
  }

  /**
   * 取消订阅 Topic
   *
   * - 若传入 callback：仅移除该回调
   * - 若未传 callback：移除该 Topic 的所有回调
   * - 当 callbacks 为空时：自动 unsubscribe 并销毁 Topic
   *
   * @param name Topic 名称
   * @param callback （可选）指定要移除的回调
   */
  unsubscribe(
    name: string,
    callback?: Callback
  ): void {
    // implementation
  }

  /**
   * 发布消息到指定 Topic
   *
   * - 若 Topic 不存在：可选择自动 advertise
   * - 用于指令下发，如速度 / 姿态 / 动作控制
   *
   * @param name Topic 名称
   * @param messageType ROS 消息类型
   * @param data 要发送的数据
   */
  publish(
    name: string,
    messageType: string,
    data: any
  ): void {
    // implementation
  }

  /**
   * 声明一个 Topic（Publisher）
   *
   * - 用于主动发布消息前初始化 Topic
   * - 多次调用应保持幂等
   *
   * @param name Topic 名称
   * @param messageType ROS 消息类型
   */
  advertise(
    name: string,
    messageType: string
  ): void {
    // implementation
  }

  /**
   * 取消 Topic 的发布声明
   *
   * - 用于页面卸载 / 模块销毁
   * - 会释放底层资源
   *
   * @param name Topic 名称
   */
  unadvertise(name: string): void {
    // implementation
  }

  /**
   * 清空所有 Topic
   *
   * - 取消所有订阅
   * - 取消所有发布
   * - 常用于：
   *   - WebSocket 断连
   *   - 用户退出
   *   - 机器人切换
   */
  clearAll(): void {
    // implementation
  }

}
// ---

const ros =new Ros({
  url: 'ws://localhost:9090'
});
/**
 * 全局唯一 TopicManager 实例
 */
export const topicManager = new TopicManager();

// Usage 
topicManager.subscribe(
  '/joint_states',
  'sensor_msgs/JointState',
  (msg) => {
    console.log(msg);
  }
);

// 页面卸载
topicManager.unsubscribe('/joint_states');
