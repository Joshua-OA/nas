import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Transaction {
  'to' : [] | [string],
  'timestamp' : bigint,
  'tx_type' : string,
  'amount' : bigint,
}
export interface User {
  'pin' : string,
  'balance' : bigint,
  'history' : Array<Transaction>,
  'phone' : string,
  'is_registered' : boolean,
}
export interface _SERVICE {
  'addFunds' : ActorMethod<[string, bigint], string>,
  'confirmRegistrationPin' : ActorMethod<[string, string], string>,
  'getBalance' : ActorMethod<[string], bigint>,
  'getUserByPhone' : ActorMethod<[string], [] | [User]>,
  'isUserRegistered' : ActorMethod<[string], boolean>,
  'setRegistrationPhone' : ActorMethod<[string, string], string>,
  'setRegistrationPin' : ActorMethod<[string, string], string>,
  'startRegistration' : ActorMethod<[string], string>,
  'transfer' : ActorMethod<[string, string, bigint, string], string>,
  'validatePhone' : ActorMethod<[string], boolean>,
  'validatePin' : ActorMethod<[string], boolean>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
