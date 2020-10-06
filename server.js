const Http = require('http');
const WebSocket = require('ws');
const Server = Http.createServer();
const WebSocketServer = new WebSocket.Server({ noServer: true });

const FunctionManager = require('./function-manager');
const functionManager = new FunctionManager();

const connectionType = {
    CLIENT: 0,
    FUNCTION: 1
}

const awaitingClients = {};

Server.on('upgrade', function upgrade(request, socket, head) {
    const connection = {};

    const functionId = request.headers['function'];
    if (functionId) {
        const client = awaitingClients[functionId];
        delete awaitingClients[functionId];
        if (client === undefined || client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED) {
            socket.destroy();
            console.log(`No client for functionId ${functionId}`);
            return;
        } else {
            connection.type = connectionType.FUNCTION;
            connection.client = client;
            client.function = connection;
            console.log(`Function connected with functionId ${functionId}`);
        }    
    } else {
        connection.type = connectionType.CLIENT;
        console.log(`Client connected`);
    }

    WebSocketServer.handleUpgrade(request, socket, head, function done(webSocket) {
        connection.socket = webSocket;
        WebSocketServer.emit('connection', connection);
    });
});

WebSocketServer.on('connection', function connection(connection) {
    connection.socket.on('message', function incoming(message) {
        if (connection.type === connectionType.FUNCTION) {
            connection.client.socket.send(message);
        } else if (connection.type === connectionType.CLIENT) {
            if (connection.function) {
                connection.function.socket.send(message);
            } else {
                try {
                    const request = JSON.parse(message);
                    if (request.function === 'task') {
                        const functionId = functionManager.invoke('product-purchaser-TaskFunction-432SLL7MB6I4', request.data);
                        awaitingClients[functionId] = connection;
                        console.log(`Invoked function ${request.function} with functionId ${functionId}`);
                    } else if (request.function === 'test') {
                        const token = functionManager.invoke('product-purchaser-TestFunction-CP6ST80NZ07R', request.data);
                        awaitingClients[token] = connection;
                        console.log(`Invoked function ${request.function} with functionId ${token}`);
					}	
                } catch (error) { console.log(error.message) }
            }
        }
    });

    connection.socket.on('close', function close(code, reason) {
        if (code >= 1004 || code <= 1006) code = 1001;
        if (connection.type === connectionType.FUNCTION) {
            if (connection.client && connection.client.socket.readyState === WebSocket.OPEN)
                connection.client.socket.close(code, reason);
        } else if (connection.type === connectionType.CLIENT) {
            if (connection.function && connection.function.socket.readyState === WebSocket.OPEN)
                connection.function.socket.close(code, reason);
        }
        delete connection;
    });
});

Server.listen(8080);