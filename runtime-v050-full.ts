import { McpServer, createMcpHandler } from 'npm:@modelcontextprotocol/server';
import * as z from 'npm:zod/v4';
import { unzipSync } from 'npm:fflate';

const ZIP_SHA='32c1e7e136bb618b5b1de14991fb6770388ad113780cf7010725ddd5e07b7e07';
const REF='62da8df041967d81a58a476fd9e7d21c28c25d74';
const PARTS=['part0.bin','part1a.bin','part1b.bin','part2a.bin','part2b.bin','part3.bin','part4.bin','part5.bin','part6.bin','part7a.bin','part7b0a00.bin','part7b0a01.bin','part7b0a1.bin','part7b0b.bin','part7b1.bin','part8.bin','part9.bin'];
const MCP_SUFFIX='/mcp/everest-mcp-v050-k7f3q9';
let handlerPromise: Promise<any>|null=null;

function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function textB64(text:string){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}

async function getWebhook(){
  const base=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key) throw new Error('Supabase runtime secret is unavailable');
  const r=await fetch(`${base}/rest/v1/rpc/get_everest_b24_webhook_v050`,{method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`},body:'{}'});
  if(!r.ok) throw new Error(`Webhook Vault RPC failed: ${r.status}`);
  const value=await r.json(); if(typeof value!=='string'||!value.includes('/rest/')) throw new Error('Webhook Vault value is invalid'); return value;
}

async function loadZip(){
  const arrays:Uint8Array[]=[]; let total=0;
  for(const name of PARTS){const r=await fetch(`https://raw.githubusercontent.com/ArtemFilin1990/mcp-rest-doc/${REF}/tmp-v050-bin/${name}`);if(!r.ok)throw new Error(`ZIP part ${name}: HTTP ${r.status}`);const a=new Uint8Array(await r.arrayBuffer());arrays.push(a);total+=a.length;}
  const zip=new Uint8Array(total);let off=0;for(const a of arrays){zip.set(a,off);off+=a.length;}
  const sha=hex(await crypto.subtle.digest('SHA-256',zip));if(sha!==ZIP_SHA)throw new Error(`ZIP SHA mismatch: ${sha}`);return zip;
}

function makePolicy(){return `
const POLICY=Object.freeze({allowWrites:true,allowDeletes:true,allowBulkWrites:true,allowAdmin:true,allowReassign:true,allowSends:true,maxBulk:20,auditLog:'console'});
function policyError(code,message){const e=new Error(message);e.code=code;return e;}
function ensureWrites(){if(!POLICY.allowWrites)throw policyError('WRITES_DISABLED','Write operations are disabled.');}
function ensureDeletes(confirm){ensureWrites();if(!POLICY.allowDeletes)throw policyError('DELETES_DISABLED','Delete/destructive operations are disabled.');if(confirm!==true)throw policyError('CONFIRMATION_REQUIRED','This destructive operation requires confirm=true.');}
function ensureBulk(count,confirm){ensureWrites();if(!POLICY.allowBulkWrites)throw policyError('BULK_WRITES_DISABLED','Bulk write operations are disabled.');if(confirm!==true)throw policyError('CONFIRMATION_REQUIRED','Bulk write operations require confirm=true.');if(count>POLICY.maxBulk)throw policyError('BULK_LIMIT_EXCEEDED','Bulk limit exceeded.');}
function ensureAdmin(confirm){ensureWrites();if(!POLICY.allowAdmin)throw policyError('ADMIN_DISABLED','Administrative operations are disabled.');if(confirm!==true)throw policyError('CONFIRMATION_REQUIRED','Administrative operations require confirm=true.');}
function ensureSends(confirm){ensureWrites();if(!POLICY.allowSends)throw policyError('SENDS_DISABLED','Outbound send operations are disabled.');if(confirm!==true)throw policyError('CONFIRMATION_REQUIRED','Outbound send operations require confirm=true.');}
function ensureReassign(fields={}){const keys=Object.keys(fields).map(k=>k.toLowerCase());if((keys.includes('assignedbyid')||keys.includes('assigned_by_id')||keys.includes('responsible_id'))&&!POLICY.allowReassign)throw policyError('REASSIGN_DISABLED','Changing the responsible employee is disabled.');}
async function auditWrite(entry){console.log(JSON.stringify({ts:new Date().toISOString(),service:'everest-bitrix24-mcp-edge',...entry}));}
`;}

function patchClient(source:string){
  source=source.replaceAll('export class ','class ');
  source=source.replace("Buffer.from(buffer).toString('base64')","bytesToBase64(buffer)");
  return `function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}\n${source}`;
}
function patchServer(source:string){
  const imports=`import { McpServer } from '@modelcontextprotocol/server';\nimport * as z from 'zod/v4';\nimport { Bitrix24Client } from './bitrix-client.mjs';\nimport {\n  POLICY,\n  auditWrite,\n  ensureAdmin,\n  ensureBulk,\n  ensureDeletes,\n  ensureReassign,\n  ensureSends,\n  ensureWrites,\n} from './policy.mjs';\n\n`;
  source=source.replace(imports,'');
  const boot=`const WEBHOOK_URL = process.env.B24_WEBHOOK_URL;\n\nif (!WEBHOOK_URL) {\n  console.error('Missing B24_WEBHOOK_URL');\n  process.exit(1);\n}\n\nconst b24 = new Bitrix24Client({ webhookUrl: WEBHOOK_URL });`;
  source=source.replace(boot,'let b24 = null;');
  source=source.replace('export function buildServer() {',"export function buildServer({ webhookUrl } = {}) {\n  if (!webhookUrl) throw new Error('webhookUrl is required');\n  b24 = new Bitrix24Client({ webhookUrl });");
  return source;
}

async function createRuntimeHandler(){
  const [webhook,zip]=await Promise.all([getWebhook(),loadZip()]);
  const files=unzipSync(zip); const dec=new TextDecoder();
  const clientRaw=files['src/bitrix-client.mjs']; const serverRaw=files['src/server.mjs'];
  if(!clientRaw||!serverRaw)throw new Error('Required source files missing from verified ZIP');
  (globalThis as any).__EVEREST_MCP_SERVER=McpServer; (globalThis as any).__EVEREST_ZOD=z;
  const moduleCode=`const McpServer=globalThis.__EVEREST_MCP_SERVER; const z=globalThis.__EVEREST_ZOD;\n${patchClient(dec.decode(clientRaw))}\n${makePolicy()}\n${patchServer(dec.decode(serverRaw))}`;
  const mod=await import(`data:text/javascript;base64,${textB64(moduleCode)}`);
  return createMcpHandler(()=>mod.buildServer({webhookUrl:webhook}));
}
function runtime(){if(!handlerPromise)handlerPromise=createRuntimeHandler();return handlerPromise;}

Deno.serve(async(req)=>{
  const path=new URL(req.url).pathname;
  if(path.endsWith('/healthz'))return Response.json({ok:true,service:'everest-bitrix24-mcp',version:'0.5.0',runtime:'supabase-edge',policy:{writes:true,deletes:true,bulkWrites:true,admin:true,reassign:true,sends:true}});
  if(!path.endsWith(MCP_SUFFIX))return Response.json({error:'not_found'},{status:404});
  if(req.method!=='POST')return new Response('Method Not Allowed',{status:405,headers:{allow:'POST'}});
  try{const h=await runtime();return await h.fetch(req);}catch(e){return Response.json({error:'runtime_error',message:String(e?.message??e)},{status:500});}
});