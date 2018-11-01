import { expect } from 'chai';
import * as rabbit from './index';

describe('rabbitmq', () => {
    before(async () => {
        await rabbit.connect();
    });

    after(async () => {
        await rabbit.closeConnection();
    });

    describe('#assertExchange', () => {
        it('should create exchange', async () => {
            await rabbit.assertExchange('test', 'topic');
        });
    });

    describe('#subscribe', () => {
        it('should create and queue and subscribe', async () => {
            const channel = await rabbit.subscribe('action-queue',
            { exchange : 'test', pattern : 'source.event.status' },
            async (message: Object) => { console.log(`got this message: ${message}`); });
            expect(channel).to.exist;
        });
    });

    describe('#publish', () => {
        it('should publish to exchange', async () => {
            rabbit.publish('test', 'source.event.status', { body : 'test message'});
        });
    });

    describe('#integration test', () => {
        it('should publish a message and consume it', async () => {
            let messageAccepted;
            await rabbit.assertExchange('integration-test', 'topic');
    
            const channel = await rabbit.subscribe('int-test-queue',
            { exchange : 'integration-test', pattern : 'source.event.status' },
            async (message : Object) => { messageAccepted = message });
            
            
            rabbit.publish('integration-test', 'source.event.status',{ body : 'test message' });
            
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(messageAccepted).to.exist;
            expect(messageAccepted).to.be.an('object');
            expect(messageAccepted).to.have.property('body', 'test message');
        });
    });
});