import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoPaymentRequired } from '../src/lib/parking-payment.ts';
test('recognizes new and legacy free completed closures, but not active, evaded or unknown totals',()=>{
 assert.equal(isNoPaymentRequired({status:'completed',noPaymentRequired:true}),true);
 assert.equal(isNoPaymentRequired({status:'completed',amountPaid:0,totalCost:0}),true);
 assert.equal(isNoPaymentRequired({status:'completed',amountPaid:30}),false);
 assert.equal(isNoPaymentRequired({status:'completed'}),false);
 assert.equal(isNoPaymentRequired({status:'active',amountPaid:0}),false);
 assert.equal(isNoPaymentRequired({status:'evaded',amountPaid:0}),false);
});
