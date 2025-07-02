import HashMap "mo:base/HashMap";
import Nat "mo:base/Nat";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";

actor USSDGateway {

  type Transaction = {
    tx_type: Text;
    amount: Nat;
    to: ?Text;
    timestamp: Int;
  };

  type User = {
    phone: Text;
    pin: Text;
    balance: Nat;
    history: [Transaction];
    is_registered: Bool;
  };

  type RegistrationSession = {
    phone: Text;
    pin: Text;
    stage: Text; // "phone", "pin", "confirm"
  };

  // Storage
  private var users = HashMap.HashMap<Text, User>(10, Text.equal, Text.hash); // phone -> User
  private var sessions = HashMap.HashMap<Text, RegistrationSession>(10, Text.equal, Text.hash); // msisdn -> session

  // Check if user is registered by phone number
  public func isUserRegistered(phone: Text) : async Bool {
    switch (users.get(phone)) {
      case (?user) user.is_registered;
      case null false;
    };
  };

  // Start registration process
  public func startRegistration(phone: Text) : async Text {
    let session : RegistrationSession = {
      phone = phone;
      pin = "";
      stage = "phone";
    };
    sessions.put(phone, session);
    return "Registration started";
  };

  // Validate phone number format
  public func validatePhone(phone: Text) : async Bool {
    // Basic validation: should be 12 digits starting with 233
    let phoneLength = Text.size(phone);
    phoneLength == 12 and Text.startsWith(phone, #text "233")
  };

  // Set phone in registration
  public func setRegistrationPhone(msisdn: Text, phone: Text) : async Text {
    let isValid = await validatePhone(phone);
    if (not isValid) {
      return "Invalid phone number format";
    };

    // Check if phone already registered
    switch (users.get(phone)) {
      case (?_) return "Phone number already registered";
      case null {
        let session : RegistrationSession = {
          phone = phone;
          pin = "";
          stage = "pin";
        };
        sessions.put(msisdn, session);
        return "Phone number saved. Enter PIN";
      };
    };
  };

  // Validate PIN format (4 digits)
  public func validatePin(pin: Text) : async Bool {
    let pinLength = Text.size(pin);
    pinLength == 4
    // Add digit validation if needed
  };

  // Set PIN in registration
  public func setRegistrationPin(msisdn: Text, pin: Text) : async Text {
    let isValid = await validatePin(pin);
    if (not isValid) {
      return "PIN must be 4 digits";
    };

    switch (sessions.get(msisdn)) {
      case null return "Registration session not found";
      case (?session) {
        let updatedSession : RegistrationSession = {
          phone = session.phone;
          pin = pin;
          stage = "confirm";
        };
        sessions.put(msisdn, updatedSession);
        return "PIN saved. Confirm PIN";
      };
    };
  };

  // Confirm PIN and complete registration
  public func confirmRegistrationPin(msisdn: Text, confirmPin: Text) : async Text {
    switch (sessions.get(msisdn)) {
      case null return "Registration session not found";
      case (?session) {
        if (session.pin != confirmPin) {
          return "PIN confirmation failed. Try again";
        };

        // Create user account
        let newUser : User = {
          phone = session.phone;
          pin = session.pin;
          balance = 0;
          history = [];
          is_registered = true;
        };

        users.put(session.phone, newUser);
        sessions.delete(msisdn);
        return "Registration successful";
      };
    };
  };

  // Get user by phone
  public func getUserByPhone(phone: Text) : async ?User {
    users.get(phone)
  };

  // Transfer money
  public func transfer(fromPhone: Text, toPhone: Text, amount: Nat, pin: Text) : async Text {
    switch (users.get(fromPhone)) {
      case null return "Sender not registered";
      case (?sender) {
        if (sender.pin != pin) return "Invalid PIN";
        if (sender.balance < amount) return "Insufficient funds";

        switch (users.get(toPhone)) {
          case null return "Recipient not found";
          case (?receiver) {
            let senderTransaction : Transaction = {
              tx_type = "Transfer Sent";
              amount = amount;
              to = ?toPhone;
              timestamp = Time.now();
            };

            let receiverTransaction : Transaction = {
              tx_type = "Transfer Received";
              amount = amount;
              to = ?fromPhone;
              timestamp = Time.now();
            };

            let updatedSender : User = {
              phone = sender.phone;
              pin = sender.pin;
              balance = sender.balance - amount;
              history = Array.append(sender.history, [senderTransaction]);
              is_registered = sender.is_registered;
            };

            let updatedReceiver : User = {
              phone = receiver.phone;
              pin = receiver.pin;
              balance = receiver.balance + amount;
              history = Array.append(receiver.history, [receiverTransaction]);
              is_registered = receiver.is_registered;
            };

            users.put(fromPhone, updatedSender);
            users.put(toPhone, updatedReceiver);
            return "Transfer successful";
          };
        };
      };
    };
  };

  // Get balance
  public func getBalance(phone: Text) : async Nat {
    switch (users.get(phone)) {
      case null 0;
      case (?user) user.balance;
    };
  };

  // Add funds for testing
  public func addFunds(phone: Text, amount: Nat) : async Text {
    switch (users.get(phone)) {
      case null "User not found";
      case (?user) {
        let updatedUser : User = {
          phone = user.phone;
          pin = user.pin;
          balance = user.balance + amount;
          history = user.history;
          is_registered = user.is_registered;
        };
        users.put(phone, updatedUser);
        return "Funds added successfully";
      };
    };
  };
}
