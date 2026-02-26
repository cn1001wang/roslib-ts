import EventEmitter from './EventEmitter';
import ActionClient from './ActionClient';

export interface GoalOptions {
  actionClient: ActionClient;
  goalMessage: any;
}

export default class Goal extends EventEmitter {
  public actionClient: ActionClient;
  public goalMessage: any;
  public isFinished: boolean = false;
  public goalID: string;
  public status: any;
  public result: any;
  public feedback: any;

  constructor(options: GoalOptions) {
    super();
    this.actionClient = options.actionClient;
    this.goalMessage = options.goalMessage;

    // Used to create random IDs
    const date = new Date();

    // Create a random ID
    this.goalID = 'goal_' + Math.random() + '_' + date.getTime();
    
    // Fill in the goal message
    this.goalMessage = {
      goal_id : {
        stamp : {
          secs : 0,
          nsecs : 0
        },
        id : this.goalID
      },
      goal : this.goalMessage
    };

    this.on('status', (status: any) => {
      this.status = status;
    });

    this.on('result', (result: any) => {
      this.isFinished = true;
      this.result = result;
    });

    this.on('feedback', (feedback: any) => {
      this.feedback = feedback;
    });

    // Add the goal
    this.actionClient.goals[this.goalID] = this;
  }

  /**
   * Send the goal to the action server.
   *
   * @param timeout - A timeout length for the goal's result.
   */
  send(timeout?: number): void {
    this.actionClient.goalTopic.publish(this.goalMessage);
    if (timeout) {
      setTimeout(() => {
        if (!this.isFinished) {
          this.emit('timeout');
        }
      }, timeout);
    }
  }

  /**
   * Cancel the current goal.
   */
  cancel(): void {
    const cancelMessage = {
      id : this.goalID
    };
    this.actionClient.cancelTopic.publish(cancelMessage);
  }
}
