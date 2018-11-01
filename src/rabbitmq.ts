import * as amqp from 'amqplib';
import { ISubscribeOptions } from './options.interface';
import { IConfig } from './config.interface';
import { IBinding } from './binding.interface';
import { isJson } from './utils';


let consumeConnection: amqp.Connection;
let publishConnection: amqp.Connection;
let publishChannel: amqp.Channel;
let _config: IConfig = {
    username : 'guest',
    password: 'guest',
    port: 5672,
    host: 'localhost',
    json: true,
}

export function configure(config: IConfig) {
    _config = { ..._config, ...config }
}

export async function assertExchange (
    exchange: string,
    type: string,
    options?: amqp.Options.AssertExchange,
) {
    const defaultOptions: amqp.Options.AssertExchange = { durable: true };
    const _options: amqp.Options.AssertExchange = { ...defaultOptions, ...options };
    let channel;
    if (consumeConnection) channel = await createChannel(consumeConnection);
    else if (publishConnection) channel = await createChannel(publishConnection);
    else throw "no connection available";
    channel.assertExchange(exchange, type, options);
    // channel.close();
}

export async function connect(select?: string): Promise<void> {
    switch (select) {
    case 'consume':
        consumeConnection = await createConnection();
        break;
    case 'publish':
        publishConnection = await createConnection();
        publishChannel = await createChannel(publishConnection);
        break;
    default:
        consumeConnection = await createConnection();
        publishConnection = await createConnection();
        publishChannel = await createChannel(publishConnection);
    }
}

async function createConnection(): Promise<amqp.Connection> {

    const connection = await amqp.connect(
        `amqp://${_config.username}:${_config.password}@${_config.host}:${_config.port}`,
        _config.socketOptions
    );

    console.log('[RabbitMQ] connected');

    return connection;
}

async function createChannel(connection: amqp.Connection) {
    const channel = await connection.createChannel();
    return channel;
}

export async function subscribe(queue: string, bindings: IBinding | IBinding[],
                                messageHandler: (message: string | Object) => any,
                                options?: ISubscribeOptions ,
    ) {
    const defaultOptions: ISubscribeOptions = 
    { requeue: false, queueOptions : { durable: true }, consumeOptions : { noAck : false } };

    const _options : ISubscribeOptions = { ...defaultOptions, ...options };
    
    const consumeChannel = await createChannel(consumeConnection);
    if (_options.prefetch) consumeChannel.prefetch(_options.prefetch);

    const _queue = await consumeChannel.assertQueue(queue, _options.queueOptions);

    if ( !Array.isArray(bindings) ) bindings = [bindings];
    (bindings as IBinding[]).forEach((binding) => {
        consumeChannel.bindQueue(_queue.queue, binding.exchange, binding.pattern);
    });

    consumeChannel.consume(_queue.queue, async (message: amqp.ConsumeMessage | null) => {
        try {
            if (message) {
                const messageContent : string = message.content.toString();
                await messageHandler(isJson(messageContent) ? JSON.parse(messageContent) : messageContent);
            }

            consumeChannel.ack(message as amqp.Message);
        } catch (error) {
            consumeChannel.reject(message as amqp.Message, _options.requeue);
        }
    }, _options.consumeOptions);
    return consumeChannel;
}

export function publish(exchange: string, routingKey: string, message: string | Object, options?: amqp.Options.Publish
    ) {
    const defaultOptions: amqp.Options.Publish = { persistent: true };
    options = { ...defaultOptions, ...options };
    if(_config.json) message = JSON.stringify(message);
    // NOTICE: should add here publish confirm
    publishChannel.publish(exchange, routingKey, Buffer.from(message as string), options);
}

export function closeConnection() {
    console.log('[RabbitMQ] Connections closed');
    if (publishConnection) publishConnection.close();
    if (consumeConnection) consumeConnection.close();
}

