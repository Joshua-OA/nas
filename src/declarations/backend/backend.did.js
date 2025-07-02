export const idlFactory = ({ IDL }) => {
  const Transaction = IDL.Record({
    'to' : IDL.Opt(IDL.Text),
    'timestamp' : IDL.Int,
    'tx_type' : IDL.Text,
    'amount' : IDL.Nat,
  });
  const User = IDL.Record({
    'pin' : IDL.Text,
    'balance' : IDL.Nat,
    'history' : IDL.Vec(Transaction),
    'phone' : IDL.Text,
    'is_registered' : IDL.Bool,
  });
  return IDL.Service({
    'addFunds' : IDL.Func([IDL.Text, IDL.Nat], [IDL.Text], []),
    'confirmRegistrationPin' : IDL.Func([IDL.Text, IDL.Text], [IDL.Text], []),
    'getBalance' : IDL.Func([IDL.Text], [IDL.Nat], []),
    'getUserByPhone' : IDL.Func([IDL.Text], [IDL.Opt(User)], []),
    'isUserRegistered' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'setRegistrationPhone' : IDL.Func([IDL.Text, IDL.Text], [IDL.Text], []),
    'setRegistrationPin' : IDL.Func([IDL.Text, IDL.Text], [IDL.Text], []),
    'startRegistration' : IDL.Func([IDL.Text], [IDL.Text], []),
    'transfer' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat, IDL.Text],
        [IDL.Text],
        [],
      ),
    'validatePhone' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'validatePin' : IDL.Func([IDL.Text], [IDL.Bool], []),
  });
};
export const init = ({ IDL }) => { return []; };
