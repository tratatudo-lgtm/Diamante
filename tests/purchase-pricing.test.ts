import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote } from '../src/lib/purchase-pricing';

const prices = [{qualityId:'19k',centsPerGram:3300},{qualityId:'18k',centsPerGram:3000}];
test('different qualities and weights are priced independently',()=>{
 const quote=calculateQuote([{qualityId:'19k',weightMilligrams:5000},{qualityId:'18k',weightMilligrams:12000}],prices);
 assert.equal(quote.totalCents,52500);
 assert.equal(quote.totalWeightMilligrams,17000);
});
test('manual final price is not discounted again',()=>{
 assert.equal(calculateQuote([{qualityId:'19k',weightMilligrams:10000}],prices).totalCents,33000);
});
test('rejects missing prices, duplicate prices and invalid weights',()=>{
 assert.throws(()=>calculateQuote([{qualityId:'9k',weightMilligrams:1000}],prices));
 assert.throws(()=>calculateQuote([{qualityId:'19k',weightMilligrams:0}],prices));
 assert.throws(()=>calculateQuote([{qualityId:'19k',weightMilligrams:1000}],[...prices,prices[0]]));
});
test('rounds each piece to the nearest cent',()=>{
 assert.equal(calculateQuote([{qualityId:'x',weightMilligrams:1500}],[{qualityId:'x',centsPerGram:101}]).totalCents,152);
});
