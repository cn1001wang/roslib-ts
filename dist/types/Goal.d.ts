import EventEmitter from './EventEmitter';
import ActionClient from './ActionClient';
export interface GoalOptions {
    actionClient: ActionClient;
    goalMessage: any;
}
export default class Goal extends EventEmitter {
    actionClient: ActionClient;
    goalMessage: any;
    isFinished: boolean;
    goalID: string;
    status: any;
    result: any;
    feedback: any;
    constructor(options: GoalOptions);
    /**
     * Send the goal to the action server.
     *
     * @param timeout - A timeout length for the goal's result.
     */
    send(timeout?: number): void;
    /**
     * Cancel the current goal.
     */
    cancel(): void;
}
//# sourceMappingURL=Goal.d.ts.map