import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClientContacts,contactForRequest,messagesForContact} from '../public/chat-client-thread.js';

const requests=[
 {id:'req-viejo',userId:'cliente-1',name:'Melisa',service:'Albañilería',date:'2026-09-01T10:00:00Z'},
 {id:'req-nuevo',userId:'cliente-1',name:'Melisa',service:'Pintura',date:'2026-09-10T10:00:00Z'},
 {id:'req-otro',userId:'cliente-2',name:'Juan',service:'Plomería',date:'2026-09-11T10:00:00Z'}
];
const messages=[
 {id:'m1',requestId:'req-viejo',text:'Hola viejo',date:'2026-09-12T10:00:00Z'},
 {id:'m2',requestId:'req-nuevo',text:'Hola nuevo',date:'2026-09-13T10:00:00Z'},
 {id:'m3',requestId:'req-otro',text:'Otro cliente',date:'2026-09-13T11:00:00Z'}
];

test('administración conserva un único contacto por cliente con todos sus proyectos',()=>{
 const contacts=buildClientContacts({requests,messages,chatUnread:{'req-viejo':1,'req-nuevo':2},admin:true});
 assert.equal(contacts.length,2);
 const melisa=contacts.find(contact=>contact.name==='Melisa');
 assert.deepEqual(new Set(melisa.requestIds),new Set(['req-viejo','req-nuevo']));
 assert.equal(melisa.unread,3);
 assert.equal(melisa.replyRequestId,'req-nuevo');
 assert.equal(contactForRequest(contacts,'req-viejo'),melisa);
 assert.equal(contactForRequest(contacts,'req-nuevo'),melisa);
 assert.deepEqual(messagesForContact(melisa,messages).map(message=>message.id),['m1','m2']);
});

test('el cliente ve un solo historial con AMC aunque tenga varios proyectos',()=>{
 const contacts=buildClientContacts({requests:requests.slice(0,2),messages,chatUnread:{'req-viejo':1},admin:false});
 assert.equal(contacts.length,1);
 assert.equal(contacts[0].name,'AMC');
 assert.deepEqual(new Set(contacts[0].requestIds),new Set(['req-viejo','req-nuevo']));
 assert.equal(contacts[0].unread,1);
});
