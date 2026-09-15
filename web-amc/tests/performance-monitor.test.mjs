import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceMonitor} from '../performance-monitor.mjs';

test('monitor calcula P95 y máximos sólo para estado y multimedia dentro de la ventana',()=>{
 let clock=1_000_000;
 const monitor=createPerformanceMonitor({clock:()=>clock,windowMs:900000,maxSamples:1000});
 for(const duration of [100,200,300,400,500,600,700,800,900,1000])monitor.record('/api/state',duration);
 monitor.record('/media/foto-1',3200);
 monitor.record('/healthz',9999);
 const health=monitor.health();
 assert.equal(health.stateRequests15m,10);
 assert.equal(health.stateP95Ms,1000);
 assert.equal(health.stateMaxMs,1000);
 assert.equal(health.mediaRequests15m,1);
 assert.equal(health.mediaP95Ms,3200);
 assert.equal(health.mediaMaxMs,3200);
 clock+=900001;
 assert.deepEqual(monitor.health(),{stateRequests15m:0,stateP95Ms:null,stateMaxMs:null,mediaRequests15m:0,mediaP95Ms:null,mediaMaxMs:null});
});

test('monitor limita memoria y conserva las muestras más recientes',()=>{
 let clock=1;
 const monitor=createPerformanceMonitor({clock:()=>clock++,windowMs:999999,maxSamples:3});
 for(const duration of [10,20,30,40,50])monitor.record('/api/state',duration);
 const health=monitor.health();
 assert.equal(health.stateRequests15m,3);
 assert.equal(health.stateP95Ms,50);
 assert.equal(health.stateMaxMs,50);
});
