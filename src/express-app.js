const express = require('express');
const bodyParser = require('body-parser');

const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('./jira-hook-parser');

const app = express();

module.exports = queueFsm => {
    app
        .use(bodyParser.json({
            strict: false,
            limit: '20mb',
        }))
        .post('/', async (req, res, next) => {
            logger.silly('Jira body', req.body);

            // return false if user in body is ignored
            const saveStatus = await getParsedAndSaveToRedis(req.body);

            if (saveStatus) {
                queueFsm.is('empty') ? queueFsm.queueHandler() : queueFsm.wait();
            }

            next();
        })
        .get('/', (req, res) => {
            res.end(`Version ${process.env.npm_package_version}`);
        })

        .use((req, res) => {
            res.end();
        })

        .use((err, req, res, next) => {
            if (err) {
                logger.error(err);
            }
            res.end();
        });

    return app;
};