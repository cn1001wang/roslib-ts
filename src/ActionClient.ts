import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';
import Topic from './Topic';

export interface ActionClientOptions {
  ros: RosLike;
  serverName: string;
  actionName: string;
  timeout?: number;
  omitFeedback?: boolean;
  omitStatus?: boolean;
  omitResult?: boolean;
}

export default class ActionClient extends EventEmitter {
  public ros: RosLike;
  public serverName: string;
  public actionName: string;
  public timeout?: number;
  public omitFeedback?: boolean;
  public omitStatus?: boolean;
  public omitResult?: boolean;
  public goals: { [key: string]: EventEmitter };
  
  public feedbackListener: Topic;
  public statusListener: Topic;
  public resultListener: Topic;
  public goalTopic: Topic;
  public cancelTopic: Topic;

  private receivedStatus: boolean = false;

  constructor(options: ActionClientOptions) {
    super();
    this.ros = options.ros;
    this.serverName = options.serverName;
    this.actionName = options.actionName;
    this.timeout = options.timeout;
    this.omitFeedback = options.omitFeedback;
    this.omitStatus = options.omitStatus;
    this.omitResult = options.omitResult;
    this.goals = {};

    // create the topics associated with actionlib
    this.feedbackListener = new Topic({
      ros: this.ros,
      name: this.serverName + '/feedback',
      messageType: this.actionName + 'Feedback'
    });

    this.statusListener = new Topic({
      ros: this.ros,
      name: this.serverName + '/status',
      messageType: 'actionlib_msgs/GoalStatusArray'
    });

    this.resultListener = new Topic({
      ros: this.ros,
      name: this.serverName + '/result',
      messageType: this.actionName + 'Result'
    });

    this.goalTopic = new Topic({
      ros: this.ros,
      name: this.serverName + '/goal',
      messageType: this.actionName + 'Goal'
    });

    this.cancelTopic = new Topic({
      ros: this.ros,
      name: this.serverName + '/cancel',
      messageType: 'actionlib_msgs/GoalID'
    });

    // advertise the goal and cancel topics
    this.goalTopic.advertise();
    this.cancelTopic.advertise();

    // subscribe to the status topic
    if (!this.omitStatus) {
      this.statusListener.subscribe((statusMessage: any) => {
        this.receivedStatus = true;
        if (statusMessage.status_list) {
          statusMessage.status_list.forEach((status: any) => {
            const goal = this.goals[status.goal_id.id];
            if (goal) {
              goal.emit('status', status);
            }
          });
        }
      });
    }

    // subscribe the the feedback topic
    if (!this.omitFeedback) {
      this.feedbackListener.subscribe((feedbackMessage: any) => {
        const goal = this.goals[feedbackMessage.status.goal_id.id];
        if (goal) {
          goal.emit('status', feedbackMessage.status);
          goal.emit('feedback', feedbackMessage.feedback);
        }
      });
    }

    // subscribe to the result topic
    if (!this.omitResult) {
      this.resultListener.subscribe((resultMessage: any) => {
        const goal = this.goals[resultMessage.status.goal_id.id];
        if (goal) {
          goal.emit('status', resultMessage.status);
          goal.emit('result', resultMessage.result);
        }
      });
    }

    // If timeout specified, emit a 'timeout' event if the action server does not respond
    if (this.timeout) {
      setTimeout(() => {
        if (!this.receivedStatus) {
          this.emit('timeout');
        }
      }, this.timeout);
    }
  }

  /**
   * Cancel all goals associated with this ActionClient.
   */
  cancel(): void {
    const cancelMessage = {};
    this.cancelTopic.publish(cancelMessage);
  }

  /**
   * Unsubscribe and unadvertise all topics associated with this ActionClient.
   */
  dispose(): void {
    this.goalTopic.unadvertise();
    this.cancelTopic.unadvertise();
    if (!this.omitStatus) {
      this.statusListener.unsubscribe();
    }
    if (!this.omitFeedback) {
      this.feedbackListener.unsubscribe();
    }
    if (!this.omitResult) {
      this.resultListener.unsubscribe();
    }
  }
}
