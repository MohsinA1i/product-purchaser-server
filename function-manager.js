const Uuid = require('uuid');
const Aws = require('aws-sdk');
Aws.config.loadFromPath('./config.json');
const Lambda = new Aws.Lambda({ httpOptions: { timeout: 180000 } });

class FunctionManager {
    invoke(name, data) {
        const functionId = Uuid.v4();
        const params = {
            FunctionName: name, 
            Payload: JSON.stringify({ body: data, functionId: functionId }),
        };
        Lambda.invoke(params, function(error, data) {
            if (error) console.log(error, error.stack);
        });
        return functionId;
    }
}

module.exports = FunctionManager;