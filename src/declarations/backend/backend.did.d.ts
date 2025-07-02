import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'status_code' : number,
}
export interface LogEntry {
  'id' : bigint,
  'endpoint' : string,
  'data' : string,
  'timestamp' : bigint,
}
export interface _SERVICE {
  'clearLogs' : ActorMethod<[], undefined>,
  'getCount' : ActorMethod<[], bigint>,
  'getLogs' : ActorMethod<[], Array<LogEntry>>,
  'getLogsByEndpoint' : ActorMethod<[string], Array<LogEntry>>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'logMes' : ActorMethod<[string], bigint>,
  'logValidate' : ActorMethod<[string], bigint>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
