import * as amqp from 'amqplib';

export interface ISubscribeOptions {
    queueOptions?: amqp.Options.AssertQueue;
    consumeOptions?: amqp.Options.Consume;
    requeue?: boolean;
    prefetch?: number;
}