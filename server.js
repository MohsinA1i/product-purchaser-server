const Http = require('http');
const WebSocket = require('ws');
const Server = Http.createServer();
const WebSocketServer = new WebSocket.Server({ noServer: true });

const FunctionManager = require('./function-manager.js');
const functionManager = new FunctionManager();

const awaitingClients = {};
const type = {
    CLIENT: 0,
    FUNCTION: 1
}

WebSocketServer.on('connection', function connection(connection) {
    connection.socket.on('message', function incoming(message) {
        if (connection.type === type.FUNCTION) {
            connection.client.socket.send(message);
        } else if (connection.type === type.CLIENT) {
            if (connection.function) {
                connection.function.socket.send(message);
            } else {
                try {
                    const request = JSON.parse(message);
                    if (request.function === 'task') {
                        const token = functionManager.invoke('product-purchaser-TaskFunction-432SLL7MB6I4', request.data);
                        awaitingClients[token] = connection;
                        console.log(`Invoked function ${request.function} with token ${token}`);
                    } else if (request.function === 'test') {
                        const token = functionManager.invoke('product-purchaser-TestFunction-CP6ST80NZ07R', request.data);
                        awaitingClients[token] = connection;
                        console.log(`Invoked function ${request.function} with token ${token}`);
					}	
                } catch (error) { console.log(error.message) }
            }
        }
    });

    connection.socket.on('close', function close(code, reason) {
        if (code >= 1004 || code <= 1006) code = 1001;
        if (connection.type === type.FUNCTION) {
            if (connection.client && connection.client.socket.readyState === WebSocket.OPEN)
                connection.client.socket.close(code, reason);
        } else if (connection.type === type.CLIENT) {
            if (connection.function && connection.function.socket.readyState === WebSocket.OPEN)
                connection.function.socket.close(code, reason);
        }
        delete connection;
    });
});

Server.on('upgrade', function upgrade(request, socket, head) {
    const connection = {};

    const token = request.headers['function'];
    if (token) {
        const client = awaitingClients[token];
        delete awaitingClients[token];
        if (client === undefined || client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED) {
            socket.destroy();
            console.log(`No client for token ${token}`);
            return;
        } else {
            connection.type = type.FUNCTION;
            connection.client = client;
            client.function = connection;
            console.log(`Function connected with token ${token}`);
        }    
    } else {
        connection.type = type.CLIENT;
        console.log(`Client connected`);
    }

    WebSocketServer.handleUpgrade(request, socket, head, function done(webSocket) {
        connection.socket = webSocket;
        WebSocketServer.emit('connection', connection);
    });
});
  

Server.listen(8080);