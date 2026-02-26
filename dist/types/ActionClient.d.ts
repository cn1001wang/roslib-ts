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
    ros: RosLike;
    serverName: string;
    actionName: string;
    timeout?: number;
    omitFeedback?: boolean;
    omitStatus?: boolean;
    omitResult?: boolean;
    goals: {
        [key: string]: EventEmitter;
    };
    feedbackListener: Topic;
    statusListener: Topic;
    resultListener: Topic;
    goalTopic: Topic;
    cancelTopic: Topic;
    private receivedStatus;
    constructor(options: ActionClientOptions);
    /**
     * Cancel all goals associated with this ActionClient.
     */
    cancel(): void;
    /**
     * Unsubscribe and unadvertise all topics associated with this ActionClient.
     */
    dispose(): void;
}
//# sourceMappingURL=ActionClient.d.ts.map