import Debug "mo:base/Debug";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Blob "mo:base/Blob";

actor TwoEndpointLogger {
    
    // Simple log entry structure
    public type LogEntry = {
        id: Nat;
        timestamp: Int;
        endpoint: Text;
        data: Text;
    };
    
    // Keep stable variables simple
    private stable var logCounter: Nat = 0;
    private stable var logEntries: [LogEntry] = [];
    
    // HTTP request/response types
    public type HttpRequest = {
        method: Text;
        url: Text;
        headers: [(Text, Text)];
        body: Blob;
    };
    
    public type HttpResponse = {
        status_code: Nat16;
        headers: [(Text, Text)];
        body: Blob;
    };
    
    // HTTP endpoint router
    public query func http_request(req: HttpRequest) : async HttpResponse {
        let bodyText = switch (Text.decodeUtf8(req.body)) {
            case (?text) { text };
            case null { "[Binary data]" };
        };
        
        // Add debug print to see what URL we're actually getting
        Debug.print("🔍 Incoming URL: " # req.url);
        Debug.print("🔍 Method: " # req.method);
        
        // Check which endpoint was called
        if (Text.contains(req.url, #text "/validate")) {
            // /validate endpoint
            Debug.print("✅ /validate endpoint called");
            Debug.print("📦 Data: " # bodyText);
            Debug.print("🕐 Time: " # debug_show(Time.now()));
            Debug.print("=====================================");
            
            {
                status_code = 200;
                headers = [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*")];
                body = Text.encodeUtf8("{\"message\":\"You are not registerd\",\"action\":\"back\"}");
            }
        } else if (Text.contains(req.url, #text "/mes")) {
            // /mes endpoint
            Debug.print("📨 /mes endpoint called");
            Debug.print("📦 Data: " # bodyText);
            Debug.print("🕐 Time: " # debug_show(Time.now()));
            Debug.print("=====================================");
            
            {
                status_code = 200;
                headers = [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*")];
                body = Text.encodeUtf8("{\"message\":\"You are registerd\",\"action\":\"next\"}");
            }
        } else {
            // Unknown endpoint
            Debug.print("❌ Unknown endpoint: " # req.url);
            Debug.print("=====================================");
            
            {
                status_code = 404;
                headers = [("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*")];
                body = Text.encodeUtf8("{\"error\":\"Endpoint not found\"}");
            }
        }
    };
    
    // Function to log /validate calls (called after HTTP request)
    public func logValidate(data: Text) : async Nat {
        let entry: LogEntry = {
            id = logCounter;
            timestamp = Time.now();
            endpoint = "/validate";
            data = data;
        };
        
        logEntries := Array.append(logEntries, [entry]);
        logCounter += 1;
        
        Debug.print("✅ Validate logged #" # debug_show(entry.id));
        Debug.print("📄 Data: " # data);
        
        entry.id
    };
    
    // Function to log /mes calls (called after HTTP request)
    public func logMes(data: Text) : async Nat {
        let entry: LogEntry = {
            id = logCounter;
            timestamp = Time.now();
            endpoint = "/mes";
            data = data;
        };
        
        logEntries := Array.append(logEntries, [entry]);
        logCounter += 1;
        
        Debug.print("📨 Mes logged #" # debug_show(entry.id));
        Debug.print("📄 Data: " # data);
        
        entry.id
    };
    
    // Get all logs
    public query func getLogs() : async [LogEntry] {
        logEntries
    };
    
    // Get logs by endpoint
    public query func getLogsByEndpoint(endpoint: Text) : async [LogEntry] {
        Array.filter<LogEntry>(logEntries, func(entry) { entry.endpoint == endpoint });
    };
    
    // Get log count
    public query func getCount() : async Nat {
        logCounter
    };
    
    // Clear logs (for testing)
    public func clearLogs() : async () {
        logEntries := [];
        logCounter := 0;
        Debug.print("🗑️ All logs cleared");
    };
}