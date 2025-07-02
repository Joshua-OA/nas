export const idlFactory = ({ IDL }) => {
  const LogEntry = IDL.Record({
    'id' : IDL.Nat,
    'endpoint' : IDL.Text,
    'data' : IDL.Text,
    'timestamp' : IDL.Int,
  });
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'status_code' : IDL.Nat16,
  });
  return IDL.Service({
    'clearLogs' : IDL.Func([], [], []),
    'getCount' : IDL.Func([], [IDL.Nat], ['query']),
    'getLogs' : IDL.Func([], [IDL.Vec(LogEntry)], ['query']),
    'getLogsByEndpoint' : IDL.Func([IDL.Text], [IDL.Vec(LogEntry)], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'logMes' : IDL.Func([IDL.Text], [IDL.Nat], []),
    'logValidate' : IDL.Func([IDL.Text], [IDL.Nat], []),
  });
};
export const init = ({ IDL }) => { return []; };
