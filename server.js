const Http = require('http');
const WebSocket = require('ws');
const Server = Http.createServer();
const WebSocketServer = new WebSocket.Server({ noServer: true });

const Aws = require('aws-sdk');
Aws.config.loadFromPath('./config.json');
const Lambda = new Aws.Lambda({ httpOptions: { timeout: 180000 } });

const Uuid = require('uuid');
const awaitingClients = {};
const type = {
    CLIENT: 0,
    FUNCTION: 1
}

WebSocketServer.on('connection', function connection(connection) {

    connection.socket.on('message', function incoming(message) {
        if (connection.type === type.FUNCTION) {
            connection.client.socket.send(message);
            return;
        }

        const request = JSON.parse(message);
        if (request.action === 'task') {
            const functionId = Uuid.v4();
            awaitingClients[functionId] = connection;
            const params = {
                FunctionName: 'product-purchaser-TaskFunction-432SLL7MB6I4', 
                Payload: JSON.stringify({ body: request.data, functionId: functionId }),
            };
            Lambda.invoke(params, function(error, data) {
                if (error) console.log(error, error.stack);
            });
        }
    });

    connection.socket.on('close', function close(code, reason) {
        if (connection.type === type.CLIENT) {
            connection.function.socket.close();
        } else if (connection.type === type.FUNCTION) {
            delete connection.client.function
        }
    });
});

Server.on('upgrade', function upgrade(request, socket, head) {
    const connection = {};

    const functionId = request.headers['function'];
    if (functionId) {
        const client = awaitingClients[functionId];
        delete awaitingClients[functionId];

        if (client === undefined || client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED) {
            socket.destroy();
            return;
        } else {
            connection.type = type.FUNCTION;
            connection.client = client;
            client.function = connection;
        }    
    } else {
        connection.type = type.CLIENT;
    }

    WebSocketServer.handleUpgrade(request, socket, head, function done(webSocket) {
        connection.socket = webSocket;
        WebSocketServer.emit('connection', connection);
    });
});
  

Server.listen(8080);