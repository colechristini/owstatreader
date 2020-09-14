const express = require("express");
const fs = require("fs");
const app = express();
const https = require('https');
const bodyParser = require('body-parser');
const prompt = require('password-prompt')
const statreader = require('./statread.js');
const winston = require('winston');
const port = process.env.PORT || 8080; //default to port 8080, but uses https, doesn't work on 443let drivers = [];
const fields = ['file', 'timestamps'];
const opts = { fields };
const logger = winston.createLogger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: '../logs/combined.log' })
    ]
  });

(async function () {
    https.createServer({ //Initialize server
        key: fs.readFileSync('ssl/key.pem'),
        cert: fs.readFileSync('ssl/cert.pem'),
        passphrase: await prompt('password: ')
    }, app)
        .listen(port);//load certificate and create secure server
    app.use(bodyParser.json());//setup parser
    logger.info("Server up and running at port: " + port);
})();
// POST method route
app.post('/uploadVideo', function (req, res) { //add new driver
    let result = statreader.extractKeyframes(req.query.file, req.query.timestamps);
    res.send(result);
});
