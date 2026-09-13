import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClientContacts,contactForReference,messagesForContact} from '../public/chat-client-thread.js';

const clients=[{id:'cliente-1',name:'Melisa'},{id:'cliente-2',name:'Juan'}];
const requests=[
 {id:'req-viejo',userId:'cliente-1',service:'Albañilería'},
 {id:'req-nuevo',userId:'cliente-1',service:'Pintura'},
 {id:'req-otro',userId:'cliente-2',service:'Plomería'}
];
const messages=[
 {id:'m1',userId:'cliente-1',requestId:'req-viejo',text:'Mensaje histórico',date:'2026-09-12T10:00:00Z'},
 {id:'m2',clientId:'cliente-1',userId:'cliente-1',text:'Mensaje directo',date:'2026-09-13T10:00:00Z'},
 {id:'m3',userId:'cliente-2',requestId:'req-otro',text:'Otro cliente',date:'2026-09-13T11:00:00Z'}
];

test('administración muestra exactamente un chat por usuario cliente',()=>{
 const contacts=buildClientContacts({clients,messages,clientChatUnread:{'cliente-1':2},admin:true});
 assert.equal(contacts.length,2);
 const melisa=contacts.find(contact=>contact.id==='cliente-1');
 assert.equal(melisa.name,'Melisa');
 assert.equal(melisa.unread,2);
 assert.equal(melisa.last,'Mensaje directo');
 assert.deepEqual(messagesForContact(melisa,messages).map(message=>message.id),['m1','m2']);
 assert.equal(contactForReference({contacts,reference:'req-viejo',requests,self:null}),melisa);
 assert.equal(contactForReference({contacts,reference:'cliente-1',requests,self:null}),melisa);
});

test('el cliente tiene un único chat con AMC aunque no tenga obras',()=>{
 const self={id:'cliente-1',name:'Melisa'},contacts=buildClientContacts({clients:[],messages:[],clientChatUnread:{},admin:false,self});
 assert.equal(contacts.length,1);
 assert.equal(contacts[0].id,'cliente-1');
 assert.equal(contacts[0].name,'AMC');
 assert.equal(contacts[0].service,'Chat permanente');
});
