import { DurableObject } from 'cloudflare:workers';
import worker from './index.mjs';
import { TokenClaims } from './token-guard.mjs';

export class FeedbackTokenGuard extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => {
            this.claims = new TokenClaims(ctx.storage);
        });
    }

    claim() {
        return this.claims.claim();
    }

    alarm() {
        return this.claims.prune();
    }
}

export default worker;
